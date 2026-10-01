import { Injectable } from '@nestjs/common';
import {
  humaniseKey,
  SEARCH_TYPES,
  type SearchHit,
  type SearchResponse,
  type SearchType,
} from '@lms/shared';
import { type AuthUser, hasPermission } from '../../core/auth/auth-user.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

const LABELS: Record<SearchType, string> = {
  student: 'Students',
  trainer: 'Trainers',
  batch: 'Batches',
  program: 'Programmes',
  user: 'Staff',
  course: 'Courses',
  lesson: 'Lessons',
  assignment: 'Assignments',
  practice: 'Practice problems',
};

/**
 * Cross-entity lookup for the command palette. Every group is gated by the permission that
 * guards its own pages, and batch-scoped callers only match records inside their batches, so
 * search can never become a way around authorisation.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
  ) {}

  async search(
    user: AuthUser,
    query: { q: string; types?: SearchType[]; limit: number },
  ): Promise<SearchResponse> {
    const org = await this.tenant.getOrganization();
    const wanted = new Set<SearchType>(query.types?.length ? query.types : [...SEARCH_TYPES]);
    const groups: SearchResponse['groups'] = [];
    const contains = { contains: query.q, mode: 'insensitive' as const };
    const person = await this.scope.personFor(user.id);

    // ── What a learner can reach: their courses and lessons, their batches' assignments, the
    //    practice catalogue. Nothing here widens access; each link opens a page that checks again.
    if (person.studentId) {
      const studentId = person.studentId;
      if (wanted.has('course') && hasPermission(user, 'courses:read')) {
        const rows = await this.prisma.enrollment.findMany({
          where: { studentId, course: { title: contains, deletedAt: null } },
          include: { course: { select: { id: true, title: true, subject: true } } },
          take: query.limit,
        });
        groups.push(
          group(
            'course',
            rows.map((row) => ({
              type: 'course' as const,
              id: row.course.id,
              title: row.course.title,
              subtitle: `${row.progressPct}% complete`,
              route: `/courses/${row.course.id}`,
            })),
          ),
        );
      }
      if (wanted.has('lesson') && hasPermission(user, 'courses:read')) {
        const rows = await this.prisma.lesson.findMany({
          where: {
            title: contains,
            module: { course: { deletedAt: null, enrollments: { some: { studentId } } } },
          },
          include: {
            module: { select: { title: true, course: { select: { id: true, title: true } } } },
          },
          take: query.limit,
        });
        groups.push(
          group(
            'lesson',
            rows.map((row) => ({
              type: 'lesson' as const,
              id: row.id,
              title: row.title,
              subtitle: `${row.module.course.title} · ${row.module.title}`,
              route: `/courses/${row.module.course.id}/lessons/${row.id}`,
            })),
          ),
        );
      }
      if (wanted.has('assignment') && hasPermission(user, 'assignments:read')) {
        const memberships = await this.prisma.batchMember.findMany({
          where: { studentId, isActive: true },
          select: { batchId: true },
        });
        const rows =
          memberships.length === 0
            ? []
            : await this.prisma.assignment.findMany({
                where: {
                  organizationId: org.id,
                  deletedAt: null,
                  title: contains,
                  publications: {
                    some: {
                      batchId: { in: memberships.map((m) => m.batchId) },
                      withdrawnAt: null,
                    },
                  },
                },
                select: { id: true, title: true, subject: true },
                take: query.limit,
              });
        groups.push(
          group(
            'assignment',
            rows.map((row) => ({
              type: 'assignment' as const,
              id: row.id,
              title: row.title,
              subtitle: row.subject ? humanise(row.subject) : 'Assignment',
              route: `/assignments/${row.id}`,
            })),
          ),
        );
      }
    }

    if (wanted.has('practice') && hasPermission(user, 'practice:use')) {
      const rows = await this.prisma.question.findMany({
        where: {
          organizationId: org.id,
          deletedAt: null,
          inPractice: true,
          status: 'published',
          type: 'coding',
          OR: [{ title: contains }, { topic: contains }],
        },
        select: { id: true, slug: true, title: true, difficulty: true, topic: true },
        take: query.limit,
      });
      groups.push(
        group(
          'practice',
          rows.map((row) => ({
            type: 'practice' as const,
            id: row.id,
            title: row.title,
            subtitle: [humanise(row.difficulty), row.topic && humanise(row.topic)]
              .filter(Boolean)
              .join(' · '),
            route: `/practice/${row.slug}`,
          })),
        ),
      );
    }

    if (wanted.has('student') && hasPermission(user, 'students:read')) {
      const batchIds = await this.scope.visibleBatchIds(user, 'students:read');
      const rows = await this.prisma.studentProfile.findMany({
        where: {
          user: { organizationId: org.id, deletedAt: null },
          ...(batchIds === null
            ? {}
            : { members: { some: { batchId: { in: batchIds }, isActive: true } } }),
          OR: [
            { studentCode: contains },
            { user: { name: contains } },
            { user: { email: contains } },
          ],
        },
        include: { user: { select: { name: true, email: true } } },
        take: query.limit,
      });
      groups.push(
        group(
          'student',
          rows.map((row) => ({
            type: 'student' as const,
            id: row.id,
            title: row.user.name,
            subtitle: `${row.studentCode} · ${row.user.email}`,
            route: `/admin/students/${row.id}`,
          })),
        ),
      );
    }

    if (wanted.has('trainer') && hasPermission(user, 'trainers:read')) {
      const rows = await this.prisma.trainerProfile.findMany({
        where: {
          user: { organizationId: org.id, deletedAt: null },
          OR: [{ user: { name: contains } }, { user: { email: contains } }, { headline: contains }],
        },
        include: { user: { select: { name: true, email: true } } },
        take: query.limit,
      });
      groups.push(
        group(
          'trainer',
          rows.map((row) => ({
            type: 'trainer' as const,
            id: row.id,
            title: row.user.name,
            subtitle: row.subjects.length ? row.subjects.join(', ') : row.user.email,
            route: `/admin/trainers/${row.id}`,
          })),
        ),
      );
    }

    if (wanted.has('batch') && hasPermission(user, 'batches:read')) {
      const batchIds = await this.scope.visibleBatchIds(user, 'batches:read');
      const rows = await this.prisma.batch.findMany({
        where: {
          organizationId: org.id,
          deletedAt: null,
          ...(batchIds === null ? {} : { id: { in: batchIds } }),
          OR: [{ name: contains }, { code: contains }],
        },
        include: { program: { select: { name: true } } },
        take: query.limit,
      });
      const trainerOnly = !hasPermission(user, 'batches:manage');
      groups.push(
        group(
          'batch',
          rows.map((row) => ({
            type: 'batch' as const,
            id: row.id,
            title: row.name,
            subtitle: `${row.code} · ${row.program.name} · ${row.status}`,
            route: trainerOnly ? `/trainer/batches/${row.id}` : `/admin/batches/${row.id}`,
          })),
        ),
      );
    }

    if (wanted.has('program') && hasPermission(user, 'batches:read')) {
      const rows = await this.prisma.program.findMany({
        where: {
          organizationId: org.id,
          deletedAt: null,
          OR: [{ name: contains }, { code: contains }],
        },
        take: query.limit,
      });
      groups.push(
        group(
          'program',
          rows.map((row) => ({
            type: 'program' as const,
            id: row.id,
            title: row.name,
            subtitle: `${row.code} · ${row.durationWeeks} weeks`,
            route: `/admin/programs`,
          })),
        ),
      );
    }

    if (wanted.has('user') && hasPermission(user, 'users:read')) {
      const rows = await this.prisma.user.findMany({
        where: {
          organizationId: org.id,
          deletedAt: null,
          OR: [{ name: contains }, { email: contains }],
        },
        include: { roles: { include: { role: { select: { name: true } } } } },
        take: query.limit,
      });
      groups.push(
        group(
          'user',
          rows.map((row) => ({
            type: 'user' as const,
            id: row.id,
            title: row.name,
            subtitle: `${row.email} · ${row.roles.map((r) => r.role.name).join(', ') || 'no role'}`,
            route: `/admin/users`,
          })),
        ),
      );
    }

    const populated = groups.filter((g) => g.hits.length > 0);
    return { groups: populated, total: populated.reduce((n, g) => n + g.hits.length, 0) };
  }
}

function humanise(value: string): string {
  return humaniseKey(value);
}

function group(type: SearchType, hits: SearchHit[]) {
  return { type, label: LABELS[type], hits };
}
