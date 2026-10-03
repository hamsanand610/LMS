import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type BrandingIssue,
  type BrandingPublic,
  type BrandingSeeds,
  type BrandingUpdate,
  brandingSeedsSchema,
  type ComputedTokens,
  deriveTokens,
  validateTokens,
  definedFields,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { MemoryCache } from '../../core/cache/memory-cache.js';
import { ValidationError } from '../../core/http/errors.js';
import { issuesToFieldIssues } from '../../core/http/validation.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import type { TemplateBrand } from '../../core/email/templates.js';

export const DEFAULT_PRIMARY_COLOR = '#7F2331';

/** The upload contexts whose files may be used as branding. */
const BRANDING_FILE_CONTEXTS = ['branding-logo', 'branding-favicon', 'branding-background'];

/** Branding seeds → derived tokens; the single source for logos, colours and fonts across web and email. */
@Injectable()
export class BrandingService {
  private readonly cache = new MemoryCache<{
    seeds: BrandingSeeds;
    tokens: ComputedTokens;
    version: number;
  }>(30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  static defaults(brandName: string): BrandingSeeds {
    return brandingSeedsSchema.parse({ brandName, primaryColor: DEFAULT_PRIMARY_COLOR });
  }

  async current(): Promise<{ seeds: BrandingSeeds; tokens: ComputedTokens; version: number }> {
    const cached = this.cache.get('current');
    if (cached) return cached;
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.brandingSettings.findUnique({
      where: { organizationId: org.id },
    });
    const seeds = row ? brandingSeedsSchema.parse(row.seeds) : BrandingService.defaults(org.name);
    /*
     * Tokens are derived from the stored seeds on every read (then cached), not served from the
     * copy computed at save time. The design system evolves with the template; a stored copy
     * would pin every institute to the palette of the day it last saved its branding (ADR-0013).
     * `computedTokens` is still written on save, as the record of what was validated then.
     */
    const tokens: ComputedTokens = deriveTokens(seeds);
    const value = { seeds, tokens, version: row?.version ?? 0 };
    this.cache.set('current', value);
    return value;
  }

  async getPublic(): Promise<BrandingPublic> {
    const { seeds, tokens, version } = await this.current();
    const [logoLightUrl, logoDarkUrl, faviconUrl, backgroundUrl] = await Promise.all([
      this.publicFileUrl(seeds.logoLightFileId),
      this.publicFileUrl(seeds.logoDarkFileId),
      this.publicFileUrl(seeds.faviconFileId),
      this.publicFileUrl(seeds.login.backgroundFileId),
    ]);
    return {
      brandName: seeds.brandName,
      tagline: seeds.tagline,
      logoLightUrl,
      logoDarkUrl,
      faviconUrl,
      fontUi: seeds.fontUi,
      radius: seeds.radius,
      density: seeds.density,
      login: { ...seeds.login, backgroundUrl },
      dashboard: seeds.dashboard,
      tokens,
      version,
    };
  }

  /** Values the transactional email templates need. */
  async emailBrand(): Promise<TemplateBrand> {
    const { seeds, tokens } = await this.current();
    const light = tokens.light;
    return {
      brandName: seeds.brandName,
      footerText: seeds.email.footerText,
      supportEmail: seeds.email.supportEmail,
      // Emails take the same seeds as the web app (plan §16.7), in its light scheme: mail clients
      // choose their own background, and the light palette reads on all of them.
      palette: {
        page: light['--bg']!,
        surface: light['--surface']!,
        border: light['--border']!,
        divider: light['--surface-2']!,
        text: light['--text']!,
        muted: light['--text-muted']!,
        primary: light['--brand-primary']!,
        primaryForeground: light['--brand-primary-foreground']!,
      },
    };
  }

  preview(
    patch: BrandingUpdate,
    base: BrandingSeeds,
  ): { seeds: BrandingSeeds; tokens: ComputedTokens; issues: BrandingIssue[] } {
    // One level deep: a section the patch names is merged over the stored one, field by field.
    const fields = definedFields(patch) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(fields)) {
      const stored = (base as Record<string, unknown>)[key];
      merged[key] =
        isSection(value) && isSection(stored) ? { ...stored, ...definedFields(value) } : value;
    }
    const result = brandingSeedsSchema.safeParse(merged);
    if (!result.success) throw new ValidationError(issuesToFieldIssues(result.error.issues));
    const tokens = deriveTokens(result.data);
    return { seeds: result.data, tokens, issues: validateTokens(tokens) };
  }

  async update(patch: BrandingUpdate, actorId: string | null): Promise<BrandingPublic> {
    const org = await this.tenant.getOrganization();
    const before = await this.current();
    const { seeds, tokens, issues } = this.preview(patch, before.seeds);
    if (issues.length) {
      throw new ValidationError(
        issues.map((i) => ({ path: 'primaryColor', message: i.message, code: 'contrast' })),
        'The chosen colours do not meet the minimum contrast. Adjust the colour or accept a suggested value.',
      );
    }
    await this.assertPublicFiles([
      seeds.logoLightFileId,
      seeds.logoDarkFileId,
      seeds.faviconFileId,
      seeds.login.backgroundFileId,
    ]);
    const row = await this.prisma.brandingSettings.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        seeds,
        computedTokens: tokens,
        version: 1,
        updatedById: actorId,
      },
      update: { seeds, computedTokens: tokens, version: { increment: 1 }, updatedById: actorId },
    });
    this.cache.clear();
    await this.audit.record({
      action: 'branding.updated',
      resourceType: 'branding',
      resourceId: org.id,
      before: before.seeds,
      after: seeds,
      summary: `Branding updated (v${row.version})`,
    });
    this.events.emit('branding.changed', { version: row.version });
    return this.getPublic();
  }

  private async publicFileUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null;
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    // Branding is shown to every visitor, signed in or not: only a public file is ever linked.
    if (!file || file.status !== 'ready' || file.visibility !== 'public') return null;
    return this.storage.publicUrl(file.key);
  }

  private async assertPublicFiles(ids: (string | null)[]): Promise<void> {
    const wanted = ids.filter((id): id is string => Boolean(id));
    if (!wanted.length) return;
    const files = await this.prisma.file.findMany({ where: { id: { in: wanted } } });
    // Only images uploaded for branding: any other file (a learner's document, say) would be
    // published to every visitor of the sign-in page.
    const found = new Set(
      files
        .filter(
          (f) =>
            f.status === 'ready' &&
            f.visibility === 'public' &&
            BRANDING_FILE_CONTEXTS.includes(f.ownerType),
        )
        .map((f) => f.id),
    );
    const missing = wanted.filter((id) => !found.has(id));
    if (missing.length) {
      throw new ValidationError(
        missing.map((id) => ({
          path: 'files',
          message: `File ${id} is not a ready image uploaded for branding`,
        })),
      );
    }
  }
}

function isSection(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
