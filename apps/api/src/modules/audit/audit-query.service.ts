import { Injectable } from '@nestjs/common';
import type { Paginated } from '@lms/shared';
import { paginate, parseSort, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

export interface AuditRow {
  id: string;
  occurredAt: string;
  actor: { id: string; name: string } | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  requestId: string | null;
}

interface AuditListQuery {
  page: number;
  pageSize: number;
  sort?: string;
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AuditQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  async list(query: AuditListQuery): Promise<Paginated<AuditRow>> {
    const org = await this.tenant.getOrganization();
    const where = {
      organizationId: org.id,
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const orderBy = parseSort(query.sort, ['occurredAt'] as const, {
      field: 'occurredAt',
      direction: 'desc',
    }).map((s) => ({ [s.field]: s.direction }));
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy, ...skipTake(query) }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actorIds = [
      ...new Set(rows.map((r) => r.actorId).filter((id): id is string => Boolean(id))),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const actorById = new Map(actors.map((a) => [a.id, a]));
    return paginate(
      rows.map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt.toISOString(),
        actor: r.actorId
          ? (actorById.get(r.actorId) ?? { id: r.actorId, name: 'Unknown user' })
          : null,
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        summary: r.summary,
        before: r.before,
        after: r.after,
        ip: r.ip,
        requestId: r.requestId,
      })),
      total,
      query,
    );
  }
}
