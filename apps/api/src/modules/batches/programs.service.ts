import { Injectable } from '@nestjs/common';
import type {
  Paginated,
  ProgramCreateInput,
  ProgramSummary,
  ProgramUpdateInput,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { ConflictError, DomainRuleError, NotFoundError } from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

/** Curriculum templates. Courses attach to programmes in Phase 3. */
@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
  ) {}

  async list(query: {
    page: number;
    pageSize: number;
    q?: string;
  }): Promise<Paginated<ProgramSummary>> {
    const org = await this.tenant.getOrganization();
    const where = {
      organizationId: org.id,
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { code: { contains: query.q.toUpperCase() } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
        include: { _count: { select: { batches: true } } },
      }),
      this.prisma.program.count({ where }),
    ]);
    return paginate(rows.map(toSummary), total, query);
  }

  async create(input: ProgramCreateInput, actor: AuthUser): Promise<ProgramSummary> {
    const org = await this.tenant.getOrganization();
    const existing = await this.prisma.program.findUnique({ where: { code: input.code } });
    if (existing)
      throw new ConflictError(`A programme with code ${input.code} already exists`, 'code_taken');
    const row = await this.prisma.program.create({
      data: {
        organizationId: org.id,
        code: input.code,
        name: input.name,
        durationWeeks: input.durationWeeks,
        description: input.description,
        createdById: actor.id,
      },
      include: { _count: { select: { batches: true } } },
    });
    await this.audit.record({
      action: 'programs.created',
      resourceType: 'program',
      resourceId: row.id,
      after: input,
      summary: `Programme ${input.code} created`,
    });
    return toSummary(row);
  }

  async update(id: string, patch: ProgramUpdateInput, actor: AuthUser): Promise<ProgramSummary> {
    const before = await this.find(id);
    if (patch.status === 'archived') {
      const running = await this.prisma.batch.count({
        where: { programId: id, deletedAt: null, status: { in: ['planned', 'running'] } },
      });
      if (running > 0) {
        throw new DomainRuleError(
          `Archive the ${running} planned or running batch(es) of this programme first`,
          'program_in_use',
        );
      }
    }
    const row = await this.prisma.program.update({
      where: { id },
      data: {
        name: patch.name,
        durationWeeks: patch.durationWeeks,
        description: patch.description,
        status: patch.status,
      },
      include: { _count: { select: { batches: true } } },
    });
    await this.audit.record({
      action: 'programs.updated',
      resourceType: 'program',
      resourceId: id,
      before: { name: before.name, durationWeeks: before.durationWeeks, status: before.status },
      after: patch,
      summary: `Programme ${before.code} updated`,
      actorId: actor.id,
    });
    return toSummary(row);
  }

  async find(id: string) {
    const org = await this.tenant.getOrganization();
    const program = await this.prisma.program.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
    });
    if (!program) throw new NotFoundError('Programme');
    return program;
  }
}

function toSummary(row: {
  id: string;
  code: string;
  name: string;
  durationWeeks: number;
  description: string;
  status: string;
  createdAt: Date;
  _count: { batches: number };
}): ProgramSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    durationWeeks: row.durationWeeks,
    description: row.description,
    status: row.status as ProgramSummary['status'],
    batchCount: row._count.batches,
    createdAt: row.createdAt.toISOString(),
  };
}
