import { Injectable } from '@nestjs/common';
import type { DashboardMetric, DashboardResponse } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

/**
 * The admin dashboard for Phase 2. Only the people metrics are measurable today; the tiles the
 * customer asked for that depend on later modules are returned with `value: null` and the reason,
 * so the page states what is missing instead of showing an invented number (plan DP-A01).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
  ) {}

  async build(
    user: AuthUser,
    query: { from?: string; to?: string; programId?: string; batchId?: string },
  ): Promise<DashboardResponse> {
    const org = await this.tenant.getOrganization();
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const visible = await this.scope.visibleBatchIds(user, 'reports:read');

    const batchFilter = {
      ...(visible === null ? {} : { id: { in: visible } }),
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.batchId ? { id: query.batchId } : {}),
    };
    const memberFilter = {
      isActive: true,
      batch: { organizationId: org.id, deletedAt: null, ...batchFilter },
    };

    const [totalStudents, activeStudents, newStudents, batches, trainerCount, recent] =
      await this.prisma.$transaction([
        this.prisma.batchMember.count({ where: memberFilter }),
        this.prisma.batchMember.count({
          where: {
            ...memberFilter,
            student: { user: { lastLoginAt: { gte: sevenDaysBefore(to) } } },
          },
        }),
        this.prisma.batchMember.count({
          where: { ...memberFilter, student: { createdAt: { gte: from, lte: to } } },
        }),
        this.prisma.batch.findMany({
          where: { organizationId: org.id, deletedAt: null, ...batchFilter },
          orderBy: { startDate: 'desc' },
          take: 8,
          include: { _count: { select: { members: { where: { isActive: true } } } } },
        }),
        this.prisma.batchTrainer.findMany({
          where: { batch: { organizationId: org.id, deletedAt: null, ...batchFilter } },
          select: { trainerId: true },
          distinct: ['trainerId'],
        }),
        this.prisma.studentProfile.findMany({
          where: {
            user: { organizationId: org.id, deletedAt: null },
            ...(visible === null
              ? {}
              : { members: { some: { batchId: { in: visible }, isActive: true } } }),
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { user: { select: { name: true } } },
        }),
      ]);

    const runningBatches = batches.filter((b) => b.status === 'running').length;
    const metrics: DashboardMetric[] = [
      metric('students.total', 'Students in batches', totalStudents, 'count', {
        definition: 'Active memberships across the batches you can see.',
      }),
      metric('students.active_7d', 'Active in 7 days', activeStudents, 'count', {
        definition: 'Students whose last sign-in was within seven days of the end of the range.',
      }),
      metric('students.new', 'Added in range', newStudents, 'count', {
        definition: 'Student records created between the selected dates.',
      }),
      metric('batches.running', 'Running batches', runningBatches, 'count', {
        definition: 'Batches with status "running".',
      }),
      metric('trainers.assigned', 'Trainers assigned', trainerCount.length, 'count', {
        definition: 'Distinct trainers assigned to the batches you can see.',
      }),
      pending(
        'attendance.percentage',
        'Attendance',
        'percent',
        'Attendance is recorded from Phase 5.',
      ),
      pending(
        'progress.completion',
        'Course completion',
        'percent',
        'Courses and progress arrive in Phase 3.',
      ),
      pending(
        'assessments.average',
        'Assessment average',
        'percent',
        'Tests and assignments arrive in Phase 4.',
      ),
    ];

    return {
      asOf: new Date().toISOString(),
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      metrics,
      batches: batches.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        status: b.status,
        studentCount: b._count.members,
        capacity: b.capacity,
        startDate: b.startDate.toISOString().slice(0, 10),
      })),
      recentStudents: recent.map((s) => ({
        id: s.id,
        name: s.user.name,
        studentCode: s.studentCode,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }
}

function sevenDaysBefore(date: Date): Date {
  return new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
}

function metric(
  key: string,
  label: string,
  value: number,
  unit: 'count' | 'percent',
  extra: { definition: string; delta?: number | null },
): DashboardMetric {
  return {
    key,
    label,
    value,
    unit,
    delta: extra.delta ?? null,
    definition: extra.definition,
    pending: null,
  };
}

function pending(
  key: string,
  label: string,
  unit: 'count' | 'percent',
  reason: string,
): DashboardMetric {
  return { key, label, value: null, unit, delta: null, definition: reason, pending: reason };
}
