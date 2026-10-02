import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  academicSettingsSchema,
  generalSettingsSchema,
  legalSettingsSchema,
  SETTINGS_SECTIONS,
  type Settings,
  type SettingsSection,
  type SettingsUpdate,
  recordsSettingsSchema,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { MemoryCache } from '../../core/cache/memory-cache.js';
import { ValidationError } from '../../core/http/errors.js';
import { issuesToFieldIssues } from '../../core/http/validation.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

const SECTION_SCHEMAS = {
  general: generalSettingsSchema,
  academic: academicSettingsSchema,
  legal: legalSettingsSchema,
  records: recordsSettingsSchema,
} as const;

/** Typed institute settings stored per section as JSON, with schema defaults filled in. */
@Injectable()
export class SettingsService {
  private readonly cache = new MemoryCache<Settings>(30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async getAll(): Promise<Settings> {
    const cached = this.cache.get('all');
    if (cached) return cached;
    const org = await this.tenant.getOrganization();
    const rows = await this.prisma.setting.findMany({ where: { organizationId: org.id } });
    const stored = new Map(rows.map((r) => [r.key, r.value as Record<string, unknown>]));
    const settings: Settings = {
      general: generalSettingsSchema.parse({
        instituteName: org.name,
        timezone: org.timezone,
        locale: org.locale,
        ...(stored.get('general') ?? {}),
      }),
      academic: academicSettingsSchema.parse(stored.get('academic') ?? {}),
      legal: legalSettingsSchema.parse(stored.get('legal') ?? {}),
      records: recordsSettingsSchema.parse(stored.get('records') ?? {}),
    };
    this.cache.set('all', settings);
    return settings;
  }

  async getSection<K extends SettingsSection>(section: K): Promise<Settings[K]> {
    const all = await this.getAll();
    return all[section];
  }

  async update(patch: SettingsUpdate, actorId: string | null): Promise<Settings> {
    const org = await this.tenant.getOrganization();
    const current = await this.getAll();
    for (const section of SETTINGS_SECTIONS) {
      const partial = patch[section];
      if (!partial) continue;
      const schema = SECTION_SCHEMAS[section];
      const result = schema.safeParse({ ...current[section], ...partial });
      if (!result.success) {
        throw new ValidationError(
          issuesToFieldIssues(result.error.issues).map((i) => ({
            ...i,
            path: `${section}.${i.path}`,
          })),
        );
      }
      await this.prisma.setting.upsert({
        where: { organizationId_key: { organizationId: org.id, key: section } },
        create: { organizationId: org.id, key: section, value: result.data, updatedById: actorId },
        update: { value: result.data, updatedById: actorId },
      });
      if (section === 'general') {
        const general = result.data as Settings['general'];
        await this.prisma.organization.update({
          where: { id: org.id },
          data: { name: general.instituteName, timezone: general.timezone, locale: general.locale },
        });
        this.tenant.invalidate();
      }
      await this.audit.record({
        action: 'settings.updated',
        resourceType: 'settings',
        resourceId: section,
        before: current[section],
        after: result.data,
        summary: `Settings section "${section}" updated`,
      });
    }
    this.cache.clear();
    const updated = await this.getAll();
    this.events.emit('settings.changed', { sections: Object.keys(patch) });
    return updated;
  }

  invalidate(): void {
    this.cache.clear();
  }
}
