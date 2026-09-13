import { Injectable, Logger } from '@nestjs/common';
import { getRequestContext } from '../http/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantService } from '../tenant/tenant.service.js';

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
  /** Override the actor (e.g. system jobs). Defaults to the request's user. */
  actorId?: string | null;
}

/** Sensitive keys are never written into audit payloads. */
const REDACTED_KEYS = new Set([
  'passwordHash',
  'password',
  'refreshTokenHash',
  'tokenHash',
  'secret',
  'secretCiphertext',
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACTED_KEYS.has(k) ? '[redacted]' : redact(v);
    }
    return out;
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Append-only audit trail. Services call `record` explicitly for every sensitive mutation;
 * the route-table test and module tests assert coverage.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    const ctx = getRequestContext();
    const organization = await this.tenant.getOrganization();
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: organization.id,
          actorId: entry.actorId === undefined ? (ctx?.userId ?? null) : entry.actorId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId ?? null,
          summary: (entry.summary ?? '').slice(0, 240),
          before: entry.before === undefined ? undefined : (redact(entry.before) as object),
          after: entry.after === undefined ? undefined : (redact(entry.after) as object),
          ip: ctx?.ip ?? null,
          userAgent: ctx?.userAgent ?? null,
          requestId: ctx?.requestId ?? null,
        },
      });
    } catch (error) {
      // Audit failures must not break the business operation, but they are loud.
      this.logger.error({ err: error, action: entry.action }, 'Failed to write audit log');
    }
  }
}
