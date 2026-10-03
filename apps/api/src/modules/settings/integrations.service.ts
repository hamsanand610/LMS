import { Inject, Injectable } from '@nestjs/common';
import {
  INTEGRATIONS,
  type IntegrationProvider,
  type IntegrationRecord,
  type IntegrationTestResult,
  type IntegrationUpdateInput,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { sealSecret, secretKey } from '../../core/config/secret-box.js';
import { EmailService } from '../../core/email/email.service.js';
import { NotFoundError } from '../../core/http/errors.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { ExecutionService } from '../execution/index.js';

/**
 * Provider configuration (plan DP-A34).
 *
 * One thing this page is careful about: **the running build takes its drivers from the
 * environment at boot, not from these rows.** So each card shows the driver that is actually in
 * use as a fact, and what is stored here as the configuration a deployment would be given. Saying
 * otherwise would be a page that lies — a driver switch that changed nothing. The test button
 * probes the provider that is actually running.
 *
 * A secret is write-only: it is stored, never returned, and the API will say only whether one is
 * present.
 */
@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly execution: ExecutionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  async list(): Promise<IntegrationRecord[]> {
    const org = await this.tenant.getOrganization();
    const rows = await this.prisma.integrationConfig.findMany({
      where: { organizationId: org.id },
    });
    const byProvider = new Map(rows.map((row) => [row.provider, row]));

    return INTEGRATIONS.map((definition) => {
      const stored = byProvider.get(definition.provider);
      const active = this.activeDriver(definition.provider);
      return {
        ...definition,
        driver: stored?.driver ?? active,
        config: (stored?.config ?? this.activeConfig(definition.provider)) as Record<
          string,
          string
        >,
        hasStoredSecret: Boolean(stored?.secret),
        activeDriver: active,
        updatedAt: stored?.updatedAt.toISOString() ?? null,
      };
    });
  }

  async update(
    provider: IntegrationProvider,
    input: IntegrationUpdateInput,
    actorId: string,
  ): Promise<IntegrationRecord[]> {
    const definition = INTEGRATIONS.find((entry) => entry.provider === provider);
    if (!definition) throw new NotFoundError('Provider');

    const org = await this.tenant.getOrganization();
    // An omitted or empty secret leaves the stored one alone, as the schema says; null clears it;
    // a string replaces it (Phase 6: an empty string used to clear it).
    // Stored sealed: a database dump alone does not give the password away (Phase 6).
    const secret =
      input.secret === undefined || input.secret === ''
        ? undefined
        : input.secret === null
          ? ''
          : sealSecret(input.secret, secretKey(this.config));

    await this.prisma.integrationConfig.upsert({
      where: { organizationId_provider: { organizationId: org.id, provider } },
      create: {
        organizationId: org.id,
        provider,
        driver: input.driver,
        config: asJson(input.config ?? {}),
        secret: secret ?? '',
        updatedById: actorId,
      },
      update: {
        driver: input.driver,
        // An omitted config keeps the stored one (Phase 6).
        ...(input.config === undefined ? {} : { config: asJson(input.config) }),
        ...(secret === undefined ? {} : { secret }),
        updatedById: actorId,
      },
    });

    // The secret is never written into an audit payload, only whether one was set.
    await this.audit.record({
      action: 'integration.updated',
      resourceType: 'integration',
      resourceId: provider,
      summary: `${definition.label}: ${input.driver}`,
      after: { driver: input.driver, config: input.config, secretSet: secret !== undefined },
    });
    return this.list();
  }

  /** Probes the provider the build is actually running, not the row. */
  async test(provider: IntegrationProvider): Promise<IntegrationTestResult> {
    switch (provider) {
      case 'email': {
        const result = await this.email.healthCheck();
        return {
          ok: result.ok,
          detail: result.detail ?? `Reached the ${this.config.EMAIL_DRIVER} driver.`,
        };
      }
      case 'storage': {
        const result = await this.storage.healthCheck();
        return {
          ok: result.ok,
          detail: result.detail ?? `Reached the ${this.storage.name} bucket.`,
        };
      }
      case 'video':
        return {
          ok: true,
          detail:
            'Lesson video is played from the stored file through a signed URL (ADR-0005). A hosted provider would be a second driver behind the same interface.',
        };
      case 'execution': {
        if (!this.execution.available) {
          return {
            ok: false,
            detail:
              'Code execution is switched off: coding answers wait for a trainer to mark them.',
          };
        }
        const result = await this.execution
          .health()
          .catch(() => ({ ok: false, detail: 'The sandbox could not be checked.' }));
        return {
          ok: result.ok,
          detail:
            result.detail ??
            (this.execution.driverName === 'judge0'
              ? 'Judge0 answered.'
              : 'The sandbox runner answered and its image is ready: each run gets its own locked-down container.'),
        };
      }
      default:
        throw new NotFoundError('Provider');
    }
  }

  /** What the environment has this build running right now. */
  private activeDriver(provider: IntegrationProvider): string {
    switch (provider) {
      case 'email':
        return this.config.EMAIL_DRIVER;
      case 'storage':
        return this.storage.name;
      case 'video':
        // One driver in this build; ADR-0005 describes what a second one would look like.
        return 'storage-file';
      case 'execution':
        // The driver the execution module is actually running, as System health reports it.
        return this.execution.driverName;
      default:
        return 'unknown';
    }
  }

  /** The visible half of the running configuration, so a card is not empty before anybody saves. */
  private activeConfig(provider: IntegrationProvider): Record<string, string> {
    switch (provider) {
      case 'email':
        return {
          host: this.config.SMTP_HOST,
          port: String(this.config.SMTP_PORT),
          from: this.config.EMAIL_FROM,
        };
      case 'storage':
        return {
          endpoint: this.config.S3_ENDPOINT,
          region: this.config.S3_REGION,
          bucketPrivate: this.config.S3_BUCKET_PRIVATE,
        };
      case 'execution':
        return {
          url:
            this.execution.driverName === 'judge0'
              ? this.config.JUDGE0_URL
              : this.config.RUNNER_URL,
        };
      default:
        return {};
    }
  }
}
