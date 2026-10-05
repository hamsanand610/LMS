import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  type AiSettings,
  type AiSettingsUpdate,
  type AiSettingsView,
  aiSettingsSchema,
  aiSettingsViewSchema,
} from '@lms/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import { MemoryCache } from '../../../core/cache/memory-cache.js';
import { APP_CONFIG, type AppConfig } from '../../../core/config/env.js';
import { ValidationError } from '../../../core/http/errors.js';
import { issuesToFieldIssues } from '../../../core/http/validation.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { TenantService } from '../../../core/tenant/tenant.service.js';
import type { AiInstituteRouting } from '../routing/model-registry.js';
import { ModelRouter } from '../routing/model-router.js';

/** The settings row the AI settings are stored in: one per institute, beside `general`, `records`… */
export const AI_SETTINGS_KEY = 'ai';

/** Read as stored: a field a later version added is passed over rather than failing the whole row. */
const storedSettingsSchema = z.object(aiSettingsSchema.shape);

/** What applies now: the institute's AI settings over the deployment's configuration. */
export interface AiEffectiveSettings {
  dailyQuestions: number;
  dailyTokens: number;
  /** Millionths of a US dollar; null: no monthly budget. */
  monthlyBudgetMicros: number | null;
  budgetWarningPercent: number;
  conversationRetentionDays: number;
  usageDetailRetentionDays: number;
  cacheTtlHours: number;
  /** The institute's routing choices the deployment cannot honour now, and why; then not applied. */
  ignored: string[];
}

interface Loaded {
  stored: AiSettings;
  effective: AiEffectiveSettings;
}

/** The order a routing problem is matched to the setting it is about. */
const ROUTING_FIELDS = ['taskModels', 'fallbackModel', 'dataClasses', 'monthlyBudgetUsd', 'model'];

/**
 * The institute's AI settings (Phase 7D; ADR-0029, ADR-0030). They are the `ai` row of the
 * platform's settings table — no table of their own — validated by the shared schema, changed by
 * the Super Admin alone (`ai:manage`, at the route) and audited. Each field left empty keeps the
 * deployment's environment variable, which stays the default; an institute narrows the data
 * classes its deployment approved and never widens them, and chooses models among those the model
 * registry lists for the configured provider, checked by the same rules as at start-up.
 *
 * Read through a 30-second cache, as the other settings are. Each read hands the router the
 * institute's routing, so every process — the API and a separate worker — routes by the settings
 * within half a minute of a change. Keys and other secrets never live here.
 */
@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);
  private readonly cache = new MemoryCache<Loaded>(30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly router: ModelRouter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** The settings that apply now. Reading them also brings the router up to date. */
  async current(): Promise<AiEffectiveSettings> {
    return (await this.load()).effective;
  }

  /** The Super Admin's view: stored, applied, the choices there are, and what is not honoured. */
  async view(): Promise<AiSettingsView> {
    const { stored, effective } = await this.load();
    const models = this.router.currentModels();
    return aiSettingsViewSchema.parse({
      settings: stored,
      effective: {
        dailyQuestions: effective.dailyQuestions,
        dailyTokens: effective.dailyTokens,
        monthlyBudgetUsd:
          effective.monthlyBudgetMicros === null ? null : effective.monthlyBudgetMicros / 1_000_000,
        budgetWarningPercent: effective.budgetWarningPercent,
        conversationRetentionDays: effective.conversationRetentionDays,
        usageDetailRetentionDays: effective.usageDetailRetentionDays,
        dataClasses: [...this.router.approvedDataClasses()],
        model: models.main,
        taskModels: models.tasks,
        fallbackModel: models.fallback,
        cacheTtlHours: effective.cacheTtlHours,
      },
      models: this.router.availableModels().map((model) => ({
        id: model.id,
        tasks: [...model.tasks],
        // A fallback provider's stand-in is the deployment's alone (ADR-0038).
        mayStandIn: model.fallback && this.router.standInChoosable(),
        priced: this.router.costOf(model.id) !== null,
      })),
      approvableDataClasses: [...this.config.AI_DATA_CLASSES],
      ignored: effective.ignored,
    });
  }

  /**
   * Changes the fields named, after checking the whole result: the shared schema's bounds, then
   * the routing rules. Nothing is stored when anything is wrong.
   */
  async update(patch: AiSettingsUpdate, actorId: string): Promise<AiSettingsView> {
    const org = await this.tenant.getOrganization();
    const before = await this.read(org.id);
    const merged = aiSettingsSchema.safeParse({ ...before, ...patch });
    if (!merged.success) throw new ValidationError(issuesToFieldIssues(merged.error.issues));
    const routing = this.routingOf(merged.data);
    const problems = routing ? this.router.checkInstituteRouting(routing) : [];
    if (problems.length > 0) {
      throw new ValidationError(
        problems.map((message) => ({
          path: ROUTING_FIELDS.find((field) => message.includes(field)) ?? '',
          message,
        })),
        'The AI settings cannot be routed on this installation',
      );
    }
    await this.prisma.setting.upsert({
      where: { organizationId_key: { organizationId: org.id, key: AI_SETTINGS_KEY } },
      create: {
        organizationId: org.id,
        key: AI_SETTINGS_KEY,
        value: merged.data,
        updatedById: actorId,
      },
      update: { value: merged.data, updatedById: actorId },
    });
    await this.audit.record({
      action: 'ai.settings.updated',
      resourceType: 'settings',
      resourceId: AI_SETTINGS_KEY,
      before,
      after: merged.data,
      summary: 'SI Academy AI settings updated',
    });
    this.cache.clear();
    return this.view();
  }

  /** Drops the cached settings, so the next read takes them from the database. */
  invalidate(): void {
    this.cache.clear();
  }

  private async load(): Promise<Loaded> {
    const cached = this.cache.get(AI_SETTINGS_KEY);
    if (cached) return cached;
    const org = await this.tenant.getOrganization();
    const stored = await this.read(org.id);
    const ignored = this.router.useInstituteRouting(this.routingOf(stored));
    const loaded = { stored, effective: { ...this.effectiveOf(stored), ignored } };
    this.cache.set(AI_SETTINGS_KEY, loaded);
    return loaded;
  }

  private async read(organizationId: string): Promise<AiSettings> {
    const row = await this.prisma.setting.findUnique({
      where: { organizationId_key: { organizationId, key: AI_SETTINGS_KEY } },
    });
    const parsed = storedSettingsSchema.safeParse(row?.value ?? {});
    if (parsed.success) return parsed.data;
    // Only a hand edit of the row gets here: the deployment's configuration applies meanwhile.
    this.logger.warn('The stored AI settings are unreadable; the deployment configuration applies');
    return aiSettingsSchema.parse({});
  }

  private effectiveOf(stored: AiSettings): Omit<AiEffectiveSettings, 'ignored'> {
    const budgetUsd = stored.monthlyBudgetUsd ?? this.config.AI_ORG_MONTHLY_BUDGET_USD;
    return {
      dailyQuestions: stored.dailyQuestions ?? this.config.AI_USER_DAILY_REQUESTS,
      dailyTokens: stored.dailyTokens ?? this.config.AI_USER_DAILY_TOKENS,
      monthlyBudgetMicros: budgetUsd === null ? null : Math.round(budgetUsd * 1_000_000),
      budgetWarningPercent: stored.budgetWarningPercent,
      conversationRetentionDays: stored.conversationRetentionDays,
      usageDetailRetentionDays: stored.usageDetailRetentionDays,
      cacheTtlHours: stored.cacheTtlHours,
    };
  }

  /** The routing choices the institute made, or null when it made none: the deployment's as is. */
  private routingOf(stored: AiSettings): AiInstituteRouting | null {
    const budget =
      stored.monthlyBudgetUsd !== null
        ? 'settings'
        : this.config.AI_ORG_MONTHLY_BUDGET_USD !== null
          ? 'deployment'
          : null;
    const taskModels = Object.fromEntries(
      Object.entries(stored.taskModels).filter(([, model]) => Boolean(model)),
    );
    const chose =
      stored.model !== null ||
      stored.fallbackModel !== null ||
      stored.dataClasses !== null ||
      Object.keys(taskModels).length > 0 ||
      budget === 'settings';
    if (!chose) return null;
    return {
      model: stored.model,
      taskModels,
      fallbackModel: stored.fallbackModel,
      dataClasses: stored.dataClasses,
      budget,
    };
  }
}
