import { Injectable } from '@nestjs/common';
import {
  humaniseKey,
  SEARCH_TYPES,
  type SearchHit,
  type SearchResponse,
  type SearchType,
} from '@lms/shared';
import { type AuthUser, hasPermission, scopeFor } from '../../core/auth/auth-user.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ModuleStateService } from '../../core/registry/module-state.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { reachingPublicationsWhere } from '../assignments/index.js';
import { LIVE_LAB } from '../practice/index.js';

const LABELS: Record<SearchType, string> = {
  student: 'Students',
  trainer: 'Trainers',
  batch: 'Batches',
  program: 'Programmes',
  user: 'Staff',
  course: 'Courses',
  lesson: 'Lessons',
  assignment: 'Assignments',
  practice: 'Labs',
  test: 'Tests',
  announcement: 'Announcements',
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
    private readonly modules: ModuleStateService,
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
          where: {
            studentId,
            status: { in: ['active', 'completed'] },
            course: { title: contains, deletedAt: null, status: 'published' },
          },
          include: { course: { select: { id: true, title: true, subject: true } } },
          orderBy: { course: { title: 'asc' } },
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
            query.q,
          ),
        );
      }
      if (wanted.has('lesson') && hasPermission(user, 'courses:read')) {
        const rows = await this.prisma.lesson.findMany({
          where: {
            OR: [{ title: contains }, { resources: { some: { title: contains } } }],
            module: {
              course: {
                deletedAt: null,
                status: 'published',
                enrollments: { some: { studentId, status: { in: ['active', 'completed'] } } },
              },
            },
          },
          orderBy: { title: 'asc' },
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
            query.q,
          ),
        );
      }
      if (wanted.has('assignment') && hasPermission(user, 'assignments:read')) {
        const reach = { studentId, batchIds: person.batchIds };
        const rows = await this.prisma.assignment.findMany({
          where: {
            organizationId: org.id,
            deletedAt: null,
            title: contains,
            publications: { some: reachingPublicationsWhere(reach) },
          },
          select: { id: true, title: true, subject: true },
          orderBy: { title: 'asc' },
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
            query.q,
          ),
        );
      }
      // Tests: the windows set for the learner's batches.
      if (wanted.has('test') && hasPermission(user, 'tests:read') && person.batchIds.length > 0) {
        const rows = await this.prisma.test.findMany({
          where: {
            organizationId: org.id,
            deletedAt: null,
            status: 'published',
            title: contains,
            schedules: { some: { batchId: { in: person.batchIds } } },
          },
          select: { id: true, title: true, subject: true },
          orderBy: { title: 'asc' },
          take: query.limit,
        });
        groups.push(
          group(
            'test',
            rows.map((row) => ({
              type: 'test' as const,
              id: row.id,
              title: row.title,
              subtitle: row.subject ? humanise(row.subject) : 'Test',
              route: `/tests/${row.id}`,
            })),
            query.q,
          ),
        );
      }
    }

    // Announcements: only the ones delivered to this person, so an audience is never widened.
    if (wanted.has('announcement')) {
      const rows = await this.prisma.notification.findMany({
        where: {
          userId: user.id,
          category: 'announcement',
          OR: [{ title: contains }, { body: contains }],
        },
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
      });
      groups.push(
        group(
          'announcement',
          rows.map((row) => ({
            type: 'announcement' as const,
            id: row.id,
            title: row.title,
            subtitle: 'Announcement',
            route: '/notifications',
          })),
          query.q,
        ),
      );
    }

    if (
      wanted.has('practice') &&
      hasPermission(user, 'practice:use') &&
      (await this.modules.isEnabled('practice'))
    ) {
      const rows = await this.prisma.question.findMany({
        where: {
          organizationId: org.id,
          ...LIVE_LAB,
          OR: [{ title: contains }, { topic: contains }],
        },
        select: { id: true, slug: true, title: true, difficulty: true, topic: true },
        orderBy: { title: 'asc' },
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
            route: `/labs/${row.slug}`,
          })),
          query.q,
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
      const everyone = scopeFor(user, 'trainers:read') === 'all';
      const rows = await this.prisma.trainerProfile.findMany({
        where: {
          user: { organizationId: org.id, deletedAt: null },
          ...(everyone ? {} : { userId: user.id }),
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
      // Batch-scoped staff find only the programmes of the batches they can see.
      const batchIds = await this.scope.visibleBatchIds(user, 'batches:read');
      const rows = await this.prisma.program.findMany({
        where: {
          organizationId: org.id,
          deletedAt: null,
          ...(batchIds === null ? {} : { batches: { some: { id: { in: batchIds } } } }),
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

/**
 * One group of hits. When a query is given, titles that start with it come first, then the rest
 * in the order the database returned them (by title): the closest matches lead.
 */
function group(type: SearchType, hits: SearchHit[], q?: string) {
  const needle = q?.trim().toLowerCase();
  const ordered = needle
    ? [...hits].sort(
        (a, b) =>
          Number(!a.title.toLowerCase().startsWith(needle)) -
          Number(!b.title.toLowerCase().startsWith(needle)),
      )
    : hits;
  return { type, label: LABELS[type], hits: ordered };
}
