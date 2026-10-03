import { Injectable } from '@nestjs/common';
import {
  humaniseKey,
  ROLE_HOME_PORTAL,
  SEARCH_TYPES,
  type SearchHit,
  type SearchResponse,
  type SearchType,
  type SystemRoleKey,
} from '@lms/shared';
import { type AuthUser, hasPermission, holdsAtLeast, scopeFor } from '../../core/auth/auth-user.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ModuleStateService } from '../../core/registry/module-state.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { AssignmentsService, reachingPublicationsWhere } from '../assignments/index.js';
import { CoursesService } from '../courses/index.js';
import { LabsStaffService, LIVE_LAB } from '../practice/index.js';
import { QuestionsService } from '../questions/index.js';
import { TestsService } from '../tests/index.js';

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
  question: 'Question bank',
  document: 'Documents',
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
    private readonly courses: CoursesService,
    private readonly assignments: AssignmentsService,
    private readonly tests: TestsService,
    private readonly labs: LabsStaffService,
    private readonly questions: QuestionsService,
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
        const reach = { studentId, batchIds: person.memberBatchIds };
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
      const learnsIn = person.memberBatchIds;
      if (wanted.has('test') && hasPermission(user, 'tests:read') && learnsIn.length > 0) {
        const rows = await this.prisma.test.findMany({
          where: {
            organizationId: org.id,
            deletedAt: null,
            status: 'published',
            title: contains,
            schedules: { some: { batchId: { in: learnsIn } } },
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
      if (wanted.has('document')) {
        groups.push(
          group('document', await this.learnerDocuments(user, studentId, person, query), query.q),
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
      (await this.modules.isEnabledFor('practice', user))
    ) {
      const rows = await this.prisma.question.findMany({
        where: {
          organizationId: org.id,
          ...LIVE_LAB,
          // The catalogue, as the Labs page shows it: a live lab outside it opens nowhere.
          inPractice: true,
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

    // ── What staff can open: the courses, assignments and tests their own list pages show them,
    //    found through those modules' rules (so search never widens them) and linked into the
    //    portal they work in. A trainer who also learns keeps their learner hits beside these.
    const staffSearch = { page: 1, pageSize: query.limit, q: query.q };
    const portal = staffPortalOf(user);
    if (
      wanted.has('course') &&
      (hasPermission(user, 'courses:manage') || holdsAtLeast(user, 'courses:read', 'batch'))
    ) {
      const page = await this.courses.list(staffSearch, user);
      merge(
        groups,
        'course',
        page.data.map((row) => ({
          type: 'course' as const,
          id: row.id,
          title: row.title,
          subtitle: [row.subject && humanise(row.subject), row.status].filter(Boolean).join(' · '),
          route: `/${portal}/courses/${row.id}`,
        })),
        query.q,
        query.limit,
      );
    }
    if (
      wanted.has('assignment') &&
      (hasPermission(user, 'assignments:manage') || holdsAtLeast(user, 'assignments:read', 'batch'))
    ) {
      const page = await this.assignments.list(staffSearch, user);
      merge(
        groups,
        'assignment',
        page.data.map((row) => ({
          type: 'assignment' as const,
          id: row.id,
          title: row.title,
          subtitle: [row.subject && humanise(row.subject), row.status].filter(Boolean).join(' · '),
          route: `/${portal}/assignments/${row.id}`,
        })),
        query.q,
        query.limit,
      );
    }
    if (
      wanted.has('test') &&
      (hasPermission(user, 'tests:manage') || holdsAtLeast(user, 'tests:read', 'batch'))
    ) {
      const page = await this.tests.list(staffSearch, user);
      merge(
        groups,
        'test',
        page.data.map((row) => ({
          type: 'test' as const,
          id: row.id,
          title: row.title,
          subtitle: [row.subject && humanise(row.subject), row.status].filter(Boolean).join(' · '),
          route: `/${portal}/tests/${row.id}`,
        })),
        query.q,
        query.limit,
      );
    }
    // Labs and the question bank as their staff pages list them: a trainer finds their own labs
    // (and published ones when they review practice) and their own questions; managers find all.
    // Hits carry titles only, never a question's body, answers or hidden tests.
    const authors = hasPermission(user, 'questions:read');
    const labIds = new Set<string>();
    if (wanted.has('practice') && authors && (await this.modules.isEnabledFor('practice', user))) {
      const page = await this.labs.list(staffSearch, user);
      for (const row of page.data) labIds.add(row.questionId);
      merge(
        groups,
        'practice',
        page.data.map((row) => ({
          type: 'practice' as const,
          id: row.questionId,
          title: row.title,
          subtitle: [humanise(row.type), row.status].join(' · '),
          route: `/${portal}/labs/${row.questionId}/preview`,
        })),
        query.q,
        query.limit,
      );
    }
    if (wanted.has('question') && authors && (await this.modules.isEnabledFor('questions', user))) {
      const page = await this.questions.list(staffSearch, user);
      groups.push(
        group(
          'question',
          page.data
            // A lab is a question too; it is listed once, with the labs.
            .filter((row) => !labIds.has(row.id))
            .map((row) => ({
              type: 'question' as const,
              id: row.id,
              title: row.title,
              subtitle: [humanise(row.type), row.difficulty && humanise(row.difficulty), row.status]
                .filter(Boolean)
                .join(' · '),
              route: `/${portal}/question-bank/${row.id}`,
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
            // A trainer opens a learner in the trainer portal, within their batches (TRN-02).
            route: `/${staffPortalOf(user)}/students/${row.id}`,
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
            route: everyone ? `/admin/trainers/${row.id}` : '/trainer/profile',
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
            route: batchIds === null ? '/admin/programs' : '/trainer/batches',
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

  /**
   * A learner's documents (Phase 5): their own documents, résumés and issued certificates, and
   * the files attached to the lessons and assignments they reach now — by the same rules as the
   * pages that show them, which sign any download themselves. A hit names a page, never a file.
   */
  private async learnerDocuments(
    user: AuthUser,
    studentId: string,
    person: { memberBatchIds: string[] },
    query: { q: string; limit: number },
  ): Promise<SearchHit[]> {
    const contains = { contains: query.q, mode: 'insensitive' as const };
    const take = query.limit;
    const hits: SearchHit[] = [];
    if (hasPermission(user, 'profile:read')) {
      const [documents, resumes] = await Promise.all([
        this.prisma.document.findMany({
          where: { studentId, OR: [{ title: contains }, { type: contains }] },
          select: { id: true, title: true, type: true, status: true },
          orderBy: { createdAt: 'desc' },
          take,
        }),
        this.prisma.resume.findMany({
          where: { studentId, title: contains },
          select: { id: true, title: true },
          take,
        }),
      ]);
      for (const row of documents) {
        hits.push({
          type: 'document',
          id: row.id,
          title: row.title || humanise(row.type),
          subtitle: `Your document · ${humanise(row.status)}`,
          route: '/profile/documents',
        });
      }
      for (const row of resumes) {
        hits.push({
          type: 'document',
          id: row.id,
          title: row.title || 'Résumé',
          subtitle: 'Your résumé',
          route: '/profile/resumes',
        });
      }
    }
    if (hasPermission(user, 'certificates:read')) {
      // A revoked certificate is no longer the learner's to show.
      const certificates = await this.prisma.certificate.findMany({
        where: { studentId, status: 'issued', courseTitle: contains },
        select: { id: true, courseTitle: true, code: true },
        take,
      });
      for (const row of certificates) {
        hits.push({
          type: 'document',
          id: row.id,
          title: `Certificate: ${row.courseTitle}`,
          subtitle: row.code,
          route: '/certificates',
        });
      }
    }
    if (hasPermission(user, 'courses:read')) {
      // Lesson files of the courses the learner has now: open or finished, published, not deleted.
      const resources = await this.prisma.lessonResource.findMany({
        where: {
          title: contains,
          lesson: {
            module: {
              course: {
                deletedAt: null,
                status: 'published',
                enrollments: { some: { studentId, status: { in: ['active', 'completed'] } } },
              },
            },
          },
        },
        select: {
          id: true,
          title: true,
          lesson: {
            select: {
              id: true,
              title: true,
              module: { select: { course: { select: { id: true, title: true } } } },
            },
          },
        },
        take,
      });
      for (const row of resources) {
        const course = row.lesson.module.course;
        hits.push({
          type: 'document',
          id: row.id,
          title: row.title,
          subtitle: `${course.title} · ${row.lesson.title}`,
          route: `/courses/${course.id}/lessons/${row.lesson.id}`,
        });
      }
    }
    if (hasPermission(user, 'assignments:read')) {
      const reach = { studentId, batchIds: person.memberBatchIds };
      const resources = await this.prisma.assignmentResource.findMany({
        where: {
          title: contains,
          assignment: { publications: { some: reachingPublicationsWhere(reach) } },
        },
        select: { id: true, title: true, assignment: { select: { id: true, title: true } } },
        take,
      });
      for (const row of resources) {
        hits.push({
          type: 'document',
          id: row.id,
          title: row.title,
          subtitle: row.assignment.title,
          route: `/assignments/${row.assignment.id}`,
        });
      }
    }
    return hits.slice(0, take);
  }
}

/**
 * The staff portal a searcher works in, as their roles decide it (the rule `/me` applies): the
 * admin portal for any administrative role, the trainer portal for a trainer. A role the system
 * does not know goes to the admin portal only when it reads courses institute-wide.
 */
function staffPortalOf(user: AuthUser): 'admin' | 'trainer' {
  const portals = user.roleKeys.map((key) => ROLE_HOME_PORTAL[key as SystemRoleKey]);
  if (portals.includes('admin')) return 'admin';
  if (portals.includes('trainer')) return 'trainer';
  return scopeFor(user, 'courses:read') === 'all' ? 'admin' : 'trainer';
}

function humanise(value: string): string {
  return humaniseKey(value);
}

/**
 * Adds hits to the group of their type: a new group, or in front of the hits already there (a
 * staff member's view first), each item once and no more than the limit asked for.
 */
function merge(
  groups: SearchResponse['groups'],
  type: SearchType,
  hits: SearchHit[],
  q: string,
  limit: number,
) {
  const index = groups.findIndex((g) => g.type === type);
  if (index < 0) {
    groups.push(group(type, hits, q));
    return;
  }
  const seen = new Set(hits.map((hit) => hit.id));
  groups[index] = group(
    type,
    [...hits, ...groups[index]!.hits.filter((hit) => !seen.has(hit.id))].slice(0, limit),
    q,
  );
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
