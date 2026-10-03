import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PUBLICATION_SCOPES,
  type CourseCreateInput,
  type CourseDetail,
  type CourseStatus,
  type CourseSummary,
  type LessonSummary,
  type ModuleSummary,
  type OutlineInput,
  type Paginated,
  type PublicationRecord,
  type PublishInput,
  type UnlockRule,
  DEFAULT_COMPLETION_RULE,
  slugify,
  uniqueSlug,
  type CourseEnrollmentRow,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission, scopeFor } from '../../core/auth/auth-user.js';
import { sanitizeLessonHtml } from '../../core/html/sanitize.js';
import {
  ConflictError,
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { publicationsReaching } from '../../core/scope/publication-reach.js';
import { requireOpenAudience } from '../../core/scope/open-audience.js';
import { batchesOf, ScopeService } from '../../core/scope/scope.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { requireAttachableFile } from '../files/index.js';
import { NotificationsService } from '../notifications/index.js';
import { LIVE_LAB } from '../practice/index.js';
import { EnrollmentService, ProgressService } from '../progress/index.js';
import { TaxonomiesService } from '../settings/taxonomies.service.js';
import { CourseStaffService } from './course-staff.service.js';
import { VIDEO_CONTEXTS } from './video.driver.js';

interface ListQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: CourseStatus;
  level?: string;
  subject?: string;
  batchId?: string;
}

/** Negative positions used while an outline is being reordered, to clear the unique index. */
const REORDER_OFFSET = -100_000;

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly scope: ScopeService,
    private readonly enrollments: EnrollmentService,
    private readonly progress: ProgressService,
    private readonly notifications: NotificationsService,
    private readonly taxonomies: TaxonomiesService,
    private readonly staff: CourseStaffService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  // ───────────────────────── catalogue ─────────────────────────

  /**
   * The course catalogue. Someone who manages courses sees drafts too; everyone else sees only
   * what has been published to them, so the same endpoint serves the admin list and a learner's.
   */
  async list(query: ListQuery, user: AuthUser): Promise<Paginated<CourseSummary>> {
    const org = await this.tenant.getOrganization();
    const manages = hasPermission(user, 'courses:manage');
    // Course staff also see the courses they are in charge of, drafts included (ADR-0023).
    const staffed = manages ? [] : await this.staff.courseIdsOf(user);
    const byPermission = manages ? null : [...(await this.reachableCourseIds(user)), ...staffed];
    const byBatch = query.batchId ? await this.coursesPublishedToBatch(query.batchId) : null;
    const reachable =
      byPermission === null
        ? byBatch
        : byBatch === null
          ? byPermission
          : byPermission.filter((id) => byBatch.includes(id));

    const where = {
      organizationId: org.id,
      deletedAt: null,
      ...(reachable === null ? {} : { id: { in: reachable } }),
      ...(query.level ? { level: query.level } : {}),
      ...(query.subject ? { subject: query.subject } : {}),
      AND: [
        // Only course managers choose a status; everyone else sees published courses whatever they
        // ask, and staff their own in any state.
        manages
          ? query.status
            ? { status: query.status }
            : {}
          : { OR: [{ status: 'published' as const }, { id: { in: staffed } }] },
        query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' as const } },
                { description: { contains: query.q, mode: 'insensitive' as const } },
              ],
            }
          : {},
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
        include: COURSE_COUNTS,
      }),
      this.prisma.course.count({ where }),
    ]);
    const summaries = await Promise.all(rows.map((row) => this.toSummary(row)));
    return paginate(summaries, total, query);
  }

  /** One course with its outline. Learners get their own progress and the unlock state with it. */
  async get(id: string, user: AuthUser): Promise<CourseDetail> {
    const course = await this.find(id);
    const manages = hasPermission(user, 'courses:manage');
    const person = await this.scope.personFor(user.id);
    const canEdit = await this.mayAuthor(id, user);

    if (!manages && !canEdit) {
      const reachable = await this.reachableCourseIds(user);
      if (!reachable.includes(id)) {
        throw new ForbiddenError('That course has not been published to you');
      }
    }

    const modules = await this.prisma.courseModule.findMany({
      where: { courseId: id },
      orderBy: { position: 'asc' },
      include: {
        lessons: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { resources: true } } },
        },
      },
    });

    const summary = await this.toSummary({
      ...course,
      _count: {
        modules: modules.length,
        publications: await this.prisma.coursePublication.count({
          where: { courseId: id, unpublishedAt: null },
        }),
      },
      lessonCount: modules.reduce((n, m) => n + m.lessons.length, 0),
    });

    if (!person.studentId || canEdit) {
      return { ...summary, canEdit, modules: modules.map((m) => toModuleSummary(m, null, true)) };
    }

    const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
    const states = await this.progress.lessonStates(person.studentId, lessonIds);
    const enrolment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: person.studentId, courseId: id } },
    });

    const rendered: ModuleSummary[] = [];
    let previousComplete = 100;
    for (const [index, module] of modules.entries()) {
      const rule = module.unlockRule as UnlockRule;
      const required = rule.type === 'after_previous' ? rule.minPercent : 0;
      const unlocked = index === 0 || rule.type === 'always' || previousComplete >= required;
      rendered.push(
        toModuleSummary(module, states, unlocked, unlocked ? undefined : lockReason(required)),
      );
      previousComplete = modulePercent(module.lessons, states);
    }

    // "Continue" leads to what still counts towards the course: mandatory lessons, when it has any.
    const allLessons = modules.flatMap((m) => m.lessons);
    const mandatory = allLessons.filter((l) => l.isMandatory);
    const nextLesson = (mandatory.length > 0 ? mandatory : allLessons).find(
      (l) => states.get(l.id)?.status !== 'completed',
    );
    return {
      ...summary,
      canEdit,
      modules: rendered,
      progressPct: enrolment?.progressPct ?? 0,
      nextLessonId: nextLesson?.id ?? null,
      enrolled: Boolean(enrolment),
      instructors:
        (await this.progress.instructorsBySubject(person.studentId)).get(summary.subject) ?? [],
    };
  }

  // ───────────────────────── authoring ─────────────────────────

  async create(input: CourseCreateInput, user: AuthUser): Promise<CourseSummary> {
    const org = await this.tenant.getOrganization();
    await this.checkTerms(input);
    const taken = new Set(
      (await this.prisma.course.findMany({ select: { slug: true } })).map((c) => c.slug),
    );
    const course = await this.prisma.course.create({
      data: {
        organizationId: org.id,
        slug: uniqueSlug(slugify(input.title), taken),
        title: input.title,
        description: input.description,
        level: input.level,
        subject: input.subject,
        tags: input.tags,
        thumbnailFileId: input.thumbnailFileId,
        estimatedMinutes: input.estimatedMinutes,
        ownerId: user.id,
        createdById: user.id,
      },
      include: COURSE_COUNTS,
    });
    await this.audit.record({
      action: 'course.created',
      resourceType: 'course',
      resourceId: course.id,
      summary: `Course ${course.title} created`,
      after: { title: course.title, level: course.level, subject: course.subject },
    });
    return this.toSummary(course);
  }

  async update(
    id: string,
    input: Partial<CourseCreateInput>,
    user: AuthUser,
  ): Promise<CourseSummary> {
    const course = await this.find(id);
    await this.requireAuthor(id, user);
    await this.checkTerms(input);
    const updated = await this.prisma.course.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.level === undefined ? {} : { level: input.level }),
        ...(input.subject === undefined ? {} : { subject: input.subject }),
        ...(input.tags === undefined ? {} : { tags: input.tags }),
        ...(input.thumbnailFileId === undefined ? {} : { thumbnailFileId: input.thumbnailFileId }),
        ...(input.estimatedMinutes === undefined
          ? {}
          : { estimatedMinutes: input.estimatedMinutes }),
      },
      include: COURSE_COUNTS,
    });
    await this.audit.record({
      action: 'course.updated',
      resourceType: 'course',
      resourceId: id,
      summary: `Course ${updated.title} updated`,
      before: { title: course.title, level: course.level, subject: course.subject },
      after: { title: updated.title, level: updated.level, subject: updated.subject },
      actorId: user.id,
    });
    return this.toSummary(updated);
  }

  /** Archiving withdraws a course from every learner but keeps the content and the progress. */
  async archive(id: string, user: AuthUser): Promise<{ withdrawn: number }> {
    const course = await this.find(id);
    await this.prisma.coursePublication.updateMany({
      where: { courseId: id, unpublishedAt: null },
      data: { unpublishedAt: new Date() },
    });
    const withdrawn = await this.enrollments.syncUnpublication(id);
    await this.prisma.course.update({ where: { id }, data: { status: 'archived' } });
    await this.audit.record({
      action: 'course.archived',
      resourceType: 'course',
      resourceId: id,
      summary: `Course ${course.title} archived`,
      actorId: user.id,
    });
    this.events.emit('course.unpublished', { courseId: id });
    return { withdrawn };
  }

  /**
   * Replaces the outline. Modules and lessons that keep their id keep their progress, so editing
   * a course never resets what learners have already done; only what the author removed is lost.
   */
  async saveOutline(id: string, outline: OutlineInput, user: AuthUser): Promise<CourseDetail> {
    const course = await this.find(id);
    await this.requireAuthor(id, user);
    const existing = await this.prisma.courseModule.findMany({
      where: { courseId: id },
      include: { lessons: { select: { id: true, type: true, content: true } } },
    });
    const keptModules = new Set(outline.modules.map((m) => m.id).filter(Boolean) as string[]);
    const keptLessons = new Set(
      outline.modules.flatMap((m) => m.lessons.map((l) => l.id).filter(Boolean) as string[]),
    );
    const knownModules = new Set(existing.map((m) => m.id));
    const knownLessons = new Set(existing.flatMap((m) => m.lessons.map((l) => l.id)));
    for (const moduleId of keptModules) {
      if (!knownModules.has(moduleId)) throw new NotFoundError('Module');
    }
    for (const lessonId of keptLessons) {
      if (!knownLessons.has(lessonId)) throw new NotFoundError('Lesson');
    }
    await this.checkOutlineFiles(outline);
    await this.checkOutlineQuestions(
      outline,
      new Map(existing.flatMap((m) => m.lessons.map((l) => [l.id, l]))),
      user,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.lesson.deleteMany({
        where: { module: { courseId: id }, id: { notIn: [...keptLessons, ZERO_UUID] } },
      });
      await tx.courseModule.deleteMany({
        where: { courseId: id, id: { notIn: [...keptModules, ZERO_UUID] } },
      });
      // Park what survives out of the way so reordering cannot collide on (course, position).
      let parked = REORDER_OFFSET;
      for (const moduleId of keptModules) {
        await tx.courseModule.update({ where: { id: moduleId }, data: { position: parked } });
        parked += 1;
      }
      for (const lessonId of keptLessons) {
        await tx.lesson.update({ where: { id: lessonId }, data: { position: parked } });
        parked += 1;
      }

      for (const [moduleIndex, moduleInput] of outline.modules.entries()) {
        const moduleId = moduleInput.id
          ? (
              await tx.courseModule.update({
                where: { id: moduleInput.id },
                data: {
                  title: moduleInput.title,
                  position: moduleIndex,
                  unlockRule: asJson(moduleInput.unlockRule),
                },
              })
            ).id
          : (
              await tx.courseModule.create({
                data: {
                  courseId: id,
                  title: moduleInput.title,
                  position: moduleIndex,
                  unlockRule: asJson(moduleInput.unlockRule),
                },
              })
            ).id;

        for (const [lessonIndex, lesson] of moduleInput.lessons.entries()) {
          // Stored already cleaned, so every reader of the body gets the safe version.
          const content = lesson.content
            ? { ...lesson.content, html: sanitizeLessonHtml(lesson.content.html) }
            : undefined;
          const data = {
            title: lesson.title,
            type: lesson.type,
            position: lessonIndex,
            durationSeconds: lesson.durationSeconds || content?.video?.durationSeconds || 0,
            completionRule: lesson.completionRule ?? DEFAULT_COMPLETION_RULE[lesson.type],
            isMandatory: lesson.isMandatory,
            topic: lesson.topic,
          };
          // An editor that did not load a lesson's body sends no content, and the body is kept.
          const lessonId = lesson.id
            ? (
                await tx.lesson.update({
                  where: { id: lesson.id },
                  data: {
                    ...data,
                    moduleId,
                    ...(content
                      ? { content: asJson(content as unknown as Record<string, unknown>) }
                      : {}),
                  },
                })
              ).id
            : (
                await tx.lesson.create({
                  data: {
                    ...data,
                    moduleId,
                    content: asJson(
                      (content ?? { html: '', video: null, questionId: null }) as unknown as Record<
                        string,
                        unknown
                      >,
                    ),
                  },
                })
              ).id;

          await tx.lessonResource.deleteMany({ where: { lessonId } });
          if (lesson.resources.length > 0) {
            await tx.lessonResource.createMany({
              data: lesson.resources.map((resource, position) => ({
                lessonId,
                title: resource.title,
                fileId: resource.fileId,
                url: resource.url,
                position,
              })),
            });
          }
        }
      }
      await tx.course.update({ where: { id }, data: { version: { increment: 1 } } });
    });

    await this.audit.record({
      action: 'course.outline_saved',
      resourceType: 'course',
      resourceId: id,
      summary: `${course.title}: ${outline.modules.length} modules`,
      after: {
        modules: outline.modules.length,
        lessons: outline.modules.reduce((n, m) => n + m.lessons.length, 0),
      },
      actorId: user.id,
    });
    // Lessons added or removed change every learner's figure now, not at their next completion.
    await this.progress.recomputeCourseForEveryone(id);
    return this.get(id, user);
  }

  // ───────────────────────── publication ─────────────────────────

  /**
   * Who a course has been given to. Authors and publishers see every audience; anyone else on staff
   * (a trainer) sees a course their batches have, and only the audiences that reach those batches.
   */
  async publications(id: string, user: AuthUser): Promise<PublicationRecord[]> {
    await this.find(id);
    // Institute-wide publishers and the course's own staff see every audience of it.
    const institute =
      hasPermission(user, 'courses:manage') || scopeFor(user, 'courses:publish') === 'all';
    const seesAll = institute || (await this.staff.isStaff(id, user));
    if (!seesAll && !(await this.reachableCourseIds(user)).includes(id)) {
      throw new ForbiddenError('That course has not been published to you');
    }
    const rows = await this.prisma.coursePublication.findMany({
      where: { courseId: id, unpublishedAt: null },
      orderBy: { publishedAt: 'desc' },
    });
    let shown = rows;
    if (!seesAll) {
      // The publications that concern the caller: to batches they learn in or teach.
      const batchIds = batchesOf(await this.scope.personFor(user.id));
      const programIds = (
        await this.prisma.batch.findMany({
          where: { id: { in: batchIds } },
          select: { programId: true },
        })
      ).map((b) => b.programId);
      shown = rows.filter(
        (row) =>
          row.scopeType === 'all' ||
          (row.scopeType === 'batch' && batchIds.includes(row.scopeId ?? '')) ||
          (row.scopeType === 'program' && programIds.includes(row.scopeId ?? '')),
      );
    }
    // Course staff who teach some batches see who the course was given to on their own only
    // for the learners of those batches (D6); anyone else is "a learner".
    const known = institute
      ? null
      : new Set(
          (
            await this.prisma.batchMember.findMany({
              where: {
                batchId: { in: (await this.scope.personFor(user.id)).taughtBatchIds },
                isActive: true,
              },
              select: { studentId: true },
            })
          ).map((member) => member.studentId),
        );
    return Promise.all(
      shown.map(async (row) => {
        const record = await this.toPublicationRecord(row);
        if (row.scopeType !== 'learner' || known === null || known.has(row.scopeId ?? '')) {
          return record;
        }
        return { ...record, scopeId: null, scopeLabel: 'A learner, on their own' };
      }),
    );
  }

  /** Publishing derives the enrolments, which is what makes the course appear for those learners. */
  async publish(id: string, input: PublishInput, user: AuthUser): Promise<PublicationRecord> {
    const course = await this.find(id);
    await this.requirePublishable(id, input, user);
    await requireOpenAudience(
      this.prisma,
      input.scopeType === 'batch' && input.scopeId
        ? { batchIds: [input.scopeId] }
        : input.scopeType === 'program' && input.scopeId
          ? { programIds: [input.scopeId] }
          : {},
    );
    const lessons = await this.prisma.lesson.count({ where: { module: { courseId: id } } });
    if (lessons === 0) {
      throw new DomainRuleError(
        'Add at least one lesson before publishing this course',
        'course_has_no_lessons',
      );
    }
    const live = await this.prisma.coursePublication.findFirst({
      where: {
        courseId: id,
        unpublishedAt: null,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
      },
    });
    if (live) throw new ConflictError('That audience already has this course', 'already_published');
    await this.checkScope(input);

    const publication = await this.prisma.coursePublication.create({
      data: {
        courseId: id,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        version: course.version,
        note: input.note,
        publishedById: user.id,
      },
    });
    await this.prisma.course.update({ where: { id }, data: { status: 'published' } });
    const enrolled = await this.enrollments.syncPublication(id, input.scopeType, input.scopeId);

    await this.audit.record({
      action: 'course.published',
      resourceType: 'course',
      resourceId: id,
      summary: `${course.title} published to ${input.scopeType}: ${enrolled} learners enrolled`,
      after: { scopeType: input.scopeType, scopeId: input.scopeId, enrolled },
      actorId: user.id,
    });
    this.events.emit('course.published', {
      courseId: id,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
    });
    await this.announce(id, course.title, input);
    return this.toPublicationRecord({ ...publication, enrolled });
  }

  /** Withdrawing a publication. A course nobody can reach any more goes back to draft. */
  async unpublish(id: string, publicationId: string, user: AuthUser): Promise<{ removed: number }> {
    const course = await this.find(id);
    const publication = await this.prisma.coursePublication.findFirst({
      where: { id: publicationId, courseId: id, unpublishedAt: null },
    });
    if (!publication) throw new NotFoundError('Publication');
    await this.requirePublishable(id, publication, user);

    await this.prisma.coursePublication.update({
      where: { id: publicationId },
      data: { unpublishedAt: new Date() },
    });
    const removed = await this.enrollments.syncUnpublication(id);
    const remaining = await this.prisma.coursePublication.count({
      where: { courseId: id, unpublishedAt: null },
    });
    if (remaining === 0 && course.status === 'published') {
      await this.prisma.course.update({ where: { id }, data: { status: 'draft' } });
    }
    await this.audit.record({
      action: 'course.unpublished',
      resourceType: 'course',
      resourceId: id,
      summary: `${course.title} withdrawn from ${publication.scopeType}`,
      before: { scopeType: publication.scopeType, scopeId: publication.scopeId },
      actorId: user.id,
    });
    this.events.emit('course.unpublished', { courseId: id, publicationId });
    return { removed };
  }

  /**
   * Everyone enrolled in a course, however they came (D8): through the institute, a programme, a
   * batch, or on their own, with the publication to withdraw for the last.
   */
  async enrolmentsOf(
    id: string,
    query: {
      page: number;
      pageSize: number;
      q?: string;
      status?: 'active' | 'completed' | 'withdrawn';
    },
  ): Promise<Paginated<CourseEnrollmentRow>> {
    await this.find(id);
    const where = {
      courseId: id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            student: {
              OR: [
                { studentCode: { contains: query.q, mode: 'insensitive' as const } },
                { user: { name: { contains: query.q, mode: 'insensitive' as const } } },
              ],
            },
          }
        : {}),
    };
    const [rows, total, individual] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        orderBy: { enrolledAt: 'desc' },
        ...skipTake(query),
        include: { student: { select: { studentCode: true, user: { select: { name: true } } } } },
      }),
      this.prisma.enrollment.count({ where }),
      this.prisma.coursePublication.findMany({
        where: { courseId: id, scopeType: 'learner', unpublishedAt: null },
        select: { id: true, scopeId: true },
      }),
    ]);
    const byLearner = new Map(individual.map((p) => [p.scopeId, p.id]));
    return paginate(
      rows.map((row) => ({
        studentId: row.studentId,
        name: row.student.user.name,
        studentCode: row.student.studentCode,
        status: row.status as CourseEnrollmentRow['status'],
        progressPct: row.progressPct,
        source: (PUBLICATION_SCOPES as readonly string[]).includes(row.source)
          ? (row.source as CourseEnrollmentRow['source'])
          : 'all',
        enrolledAt: row.enrolledAt.toISOString(),
        individualPublicationId: byLearner.get(row.studentId) ?? null,
      })),
      total,
      query,
    );
  }

  // ───────────────────────── shared helpers ─────────────────────────

  /**
   * Whether the caller may change a course's content (ADR-0023): `courses:manage`, or
   * `courses:author` for every course or for the courses they are staff of.
   */
  async mayAuthor(courseId: string, user: AuthUser): Promise<boolean> {
    if (hasPermission(user, 'courses:manage')) return true;
    const scope = scopeFor(user, 'courses:author');
    if (scope === 'all') return true;
    return scope === 'own' && (await this.staff.isStaff(courseId, user));
  }

  private async requireAuthor(courseId: string, user: AuthUser): Promise<void> {
    if (!(await this.mayAuthor(courseId, user))) {
      throw new ForbiddenError(
        'Only the course’s staff change its content; an administrator can add you to it',
      );
    }
  }

  /**
   * An institute-wide publisher gives a course to anyone. A trainer gives a course they are staff
   * of to a batch they teach, and takes back only such a publication (ADR-0023).
   */
  private async requirePublishable(
    courseId: string,
    audience: { scopeType: string; scopeId: string | null },
    user: AuthUser,
  ): Promise<void> {
    if (scopeFor(user, 'courses:publish') === 'all') return;
    if (audience.scopeType !== 'batch' || !audience.scopeId) {
      throw new ForbiddenError(
        'You publish to the batches you teach; a programme or the whole institute is an administrator’s choice',
      );
    }
    const taught = await this.scope.visibleBatchIds(user, 'courses:publish');
    if (taught !== null && !taught.includes(audience.scopeId)) {
      throw new ForbiddenError('That batch is not one of yours');
    }
    if (!(await this.staff.isStaff(courseId, user))) {
      throw new ForbiddenError('Only the course’s staff publish it; an administrator can add you');
    }
  }

  /** Course ids a live publication reaches for one batch, directly or through its programme. */
  async coursesPublishedToBatch(batchId: string): Promise<string[]> {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, deletedAt: null },
      select: { id: true, programId: true },
    });
    if (!batch) throw new NotFoundError('Batch');
    const publications = await this.prisma.coursePublication.findMany({
      where: {
        unpublishedAt: null,
        OR: [
          { scopeType: 'all' },
          { scopeType: 'batch', scopeId: batch.id },
          { scopeType: 'program', scopeId: batch.programId },
        ],
      },
      select: { courseId: true },
    });
    return [...new Set(publications.map((p) => p.courseId))];
  }

  /** Course ids a learner can reach through their enrolments. */
  async reachableCourseIds(user: AuthUser): Promise<string[]> {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId) {
      // Staff without `courses:manage` (a trainer) see what the batches they teach have been given.
      const publications = await this.prisma.coursePublication.findMany({
        where: await publicationsReaching(this.prisma, person.taughtBatchIds),
        select: { courseId: true },
      });
      return [...new Set(publications.map((p) => p.courseId))];
    }
    // A learner opens a course while it is published and they have not been withdrawn from it
    // (ADR-0010's remedies: archive the course, or move the learner's batch).
    const enrolments = await this.prisma.enrollment.findMany({
      where: {
        studentId: person.studentId,
        status: { in: ['active', 'completed'] },
        course: { status: 'published', deletedAt: null },
      },
      select: { courseId: true },
    });
    return enrolments.map((e) => e.courseId);
  }

  async find(id: string) {
    const org = await this.tenant.getOrganization();
    const course = await this.prisma.course.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
    });
    if (!course) throw new NotFoundError('Course');
    return course;
  }

  /** Level and subject must name a live term, so the catalogue filters keep working. */
  private async checkTerms(input: Partial<CourseCreateInput>): Promise<void> {
    if (input.thumbnailFileId) {
      await requireAttachableFile(this.prisma, input.thumbnailFileId, {
        contexts: ['course-thumbnail'],
      });
    }
    const issues: { path: string; message: string }[] = [];
    if (input.level && !(await this.taxonomies.isValid('course-level', input.level))) {
      issues.push({ path: 'level', message: `"${input.level}" is not one of the course levels` });
    }
    if (input.subject && !(await this.taxonomies.isValid('subject', input.subject))) {
      issues.push({ path: 'subject', message: `"${input.subject}" is not one of the subjects` });
    }
    if (issues.length > 0) throw new ValidationError(issues);
  }

  private async checkScope(input: PublishInput): Promise<void> {
    if (input.scopeType === 'all' || !input.scopeId) return;
    if (input.scopeType === 'learner') {
      const org = await this.tenant.getOrganization();
      const learner = await this.prisma.studentProfile.findFirst({
        where: { id: input.scopeId, user: { organizationId: org.id, deletedAt: null } },
        select: { id: true },
      });
      if (!learner) throw new NotFoundError('Student');
      return;
    }
    const found =
      input.scopeType === 'batch'
        ? await this.prisma.batch.findFirst({ where: { id: input.scopeId, deletedAt: null } })
        : await this.prisma.program.findFirst({ where: { id: input.scopeId, deletedAt: null } });
    if (!found) throw new NotFoundError(input.scopeType === 'batch' ? 'Batch' : 'Programme');
  }

  private async announce(courseId: string, title: string, input: PublishInput): Promise<void> {
    const studentIds = await this.enrollments.studentsInScope(input.scopeType, input.scopeId);
    if (studentIds.length === 0) return;
    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: studentIds } },
      select: { userId: true },
    });
    await this.notifications.deliver({
      category: 'content',
      type: 'course.published',
      title: `New course: ${title}`,
      body: 'It is in your courses now.',
      link: `/courses/${courseId}`,
      channels: ['in_app'],
      userIds: students.map((s) => s.userId),
    });
  }

  private async toPublicationRecord(row: {
    id: string;
    scopeType: string;
    scopeId: string | null;
    note: string;
    publishedAt: Date;
    publishedById: string | null;
    enrolled?: number;
  }): Promise<PublicationRecord> {
    return {
      id: row.id,
      scopeType: row.scopeType as PublicationRecord['scopeType'],
      scopeId: row.scopeId,
      scopeLabel: await this.scopeLabel(row.scopeType, row.scopeId),
      note: row.note,
      publishedAt: row.publishedAt.toISOString(),
      publishedBy: row.publishedById,
      enrolled:
        row.enrolled ?? (await this.enrollments.studentsInScope(row.scopeType, row.scopeId)).length,
    };
  }

  private async scopeLabel(scopeType: string, scopeId: string | null): Promise<string> {
    if (scopeType === 'all' || !scopeId) return 'Everyone';
    if (scopeType === 'batch') {
      const batch = await this.prisma.batch.findUnique({
        where: { id: scopeId },
        select: { code: true, name: true },
      });
      return batch ? `${batch.code} — ${batch.name}` : 'Batch';
    }
    if (scopeType === 'learner') {
      const learner = await this.prisma.studentProfile.findUnique({
        where: { id: scopeId },
        select: { studentCode: true, user: { select: { name: true } } },
      });
      return learner ? `${learner.user.name} (${learner.studentCode}), on their own` : 'A learner';
    }
    const program = await this.prisma.program.findUnique({
      where: { id: scopeId },
      select: { name: true },
    });
    return program?.name ?? 'Programme';
  }

  private async toSummary(row: {
    id: string;
    slug: string;
    title: string;
    description: string;
    level: string;
    subject: string;
    tags: string[];
    status: string;
    thumbnailFileId: string | null;
    estimatedMinutes: number;
    createdAt: Date;
    lessonCount?: number;
    _count: { modules: number; publications: number };
    staff?: { trainerId: string; trainer: { user: { name: string } } }[];
  }): Promise<CourseSummary> {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      level: row.level,
      subject: row.subject,
      tags: row.tags,
      status: row.status as CourseStatus,
      thumbnailUrl: await this.thumbnailUrl(row.thumbnailFileId),
      moduleCount: row._count.modules,
      lessonCount:
        row.lessonCount ??
        (await this.prisma.lesson.count({ where: { module: { courseId: row.id } } })),
      estimatedMinutes: row.estimatedMinutes,
      publicationCount: row._count.publications,
      staff: row.staff
        ? row.staff.map((s) => ({ trainerId: s.trainerId, name: s.trainer.user.name }))
        : await this.staff.list(row.id),
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Every file an outline points at must be a finished upload of the kind its place calls for, so a
   * lesson can never hand learners a file that was uploaded for something else (a learner's
   * document, say) by quoting its id.
   */
  private async checkOutlineFiles(outline: OutlineInput): Promise<void> {
    const wanted = new Map<string, readonly string[]>();
    for (const module of outline.modules) {
      for (const lesson of module.lessons) {
        if (lesson.content?.video) wanted.set(lesson.content.video.key, VIDEO_CONTEXTS);
        for (const resource of lesson.resources) {
          if (resource.fileId) wanted.set(resource.fileId, ['lesson-resource']);
        }
      }
    }
    if (wanted.size === 0) return;
    const ids = [...wanted.keys()].filter((id) => UUID.test(id));
    const files = await this.prisma.file.findMany({
      where: { id: { in: ids } },
      select: { id: true, ownerType: true, status: true },
    });
    const byId = new Map(files.map((file) => [file.id, file]));
    for (const [id, contexts] of wanted) {
      const file = byId.get(id);
      if (!file || file.status !== 'ready' || !contexts.includes(file.ownerType)) {
        throw new ValidationError([
          {
            path: 'modules',
            message: 'A lesson points at a file that was not uploaded for lessons',
          },
        ]);
      }
    }
  }

  /**
   * A lesson that names a question must name one it can use: a practice lesson a published
   * question, a lab lesson a published lab that has passed its own checks (ADR-0018). Only the
   * references this save adds or changes are checked, so a lab withdrawn later does not block
   * unrelated edits; the player shows that lesson as unavailable instead.
   */
  private async checkOutlineQuestions(
    outline: OutlineInput,
    stored: Map<string, { type: string; content: unknown }>,
    user: AuthUser,
  ): Promise<void> {
    const labs = new Set<string>();
    const questions = new Set<string>();
    for (const module of outline.modules) {
      for (const lesson of module.lessons) {
        if (lesson.type !== 'lab' && lesson.type !== 'practice') continue;
        const before = lesson.id ? stored.get(lesson.id) : undefined;
        const storedId = before ? questionIdOf(before.content) : null;
        // An editor that did not load the body sends no content, and the stored body is kept.
        const questionId = lesson.content ? lesson.content.questionId : storedId;
        if (lesson.type === 'lab' && !questionId) {
          throw new ValidationError([
            { path: 'modules', message: `Choose the lab that "${lesson.title}" opens` },
          ]);
        }
        if (!questionId || (before?.type === lesson.type && storedId === questionId)) continue;
        (lesson.type === 'lab' ? labs : questions).add(questionId);
      }
    }
    if (labs.size === 0 && questions.size === 0) return;
    const org = await this.tenant.getOrganization();
    const [liveLabs, published] = await Promise.all([
      this.prisma.question.findMany({
        where: { id: { in: [...labs] }, organizationId: org.id, ...LIVE_LAB },
        select: { id: true },
      }),
      this.prisma.question.findMany({
        where: {
          id: { in: [...questions] },
          organizationId: org.id,
          deletedAt: null,
          status: 'published',
          // As on a paper (SEC-02): someone who reads only their own questions embeds only those,
          // or a lesson would mark another author's question, perhaps one sat in a test.
          ...(hasPermission(user, 'questions:manage') || scopeFor(user, 'questions:read') === 'all'
            ? {}
            : { authorId: user.id }),
        },
        select: { id: true },
      }),
    ]);
    if (liveLabs.length !== labs.size) {
      throw new ValidationError([
        {
          path: 'modules',
          message: 'A lab lesson must open a published lab that has passed its checks',
        },
      ]);
    }
    if (published.length !== questions.size) {
      throw new ValidationError([
        {
          path: 'modules',
          message: 'A practice lesson must embed a published question you may use',
        },
      ]);
    }
  }

  private async thumbnailUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null;
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.status !== 'ready') return null;
    return file.visibility === 'public' ? this.storage.publicUrl(file.key) : null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The question a stored lesson body names, when it names a well-formed one. */
function questionIdOf(content: unknown): string | null {
  const value = (content as { questionId?: unknown } | null)?.questionId;
  return typeof value === 'string' && UUID.test(value) ? value : null;
}

/** A uuid that matches nothing, so `notIn` stays valid when the keep list is empty. */
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

const COURSE_COUNTS = {
  _count: { select: { modules: true, publications: { where: { unpublishedAt: null } } } },
  staff: {
    orderBy: { assignedAt: 'asc' },
    select: { trainerId: true, trainer: { select: { user: { select: { name: true } } } } },
  },
} as const;

interface LessonRow {
  id: string;
  title: string;
  type: string;
  durationSeconds: number;
  completionRule: string;
  isMandatory: boolean;
  topic: string;
  _count?: { resources: number };
}

type States = Map<string, { status: string; positionSeconds: number; watchedPct: number }> | null;

function toModuleSummary(
  module: {
    id: string;
    title: string;
    position: number;
    unlockRule: unknown;
    lessons: LessonRow[];
  },
  states: States,
  unlocked: boolean,
  lockReason?: string,
): ModuleSummary {
  return {
    id: module.id,
    title: module.title,
    position: module.position,
    unlockRule: module.unlockRule as UnlockRule,
    lessons: module.lessons.map((lesson) => toLessonSummary(lesson, states)),
    ...(states === null ? {} : { unlocked, ...(lockReason ? { lockReason } : {}) }),
  };
}

function toLessonSummary(lesson: LessonRow, states: States): LessonSummary {
  const state = states?.get(lesson.id);
  return {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type as LessonSummary['type'],
    durationSeconds: lesson.durationSeconds,
    completionRule: lesson.completionRule as LessonSummary['completionRule'],
    isMandatory: lesson.isMandatory,
    resourceCount: lesson._count?.resources ?? 0,
    topic: lesson.topic,
    ...(states === null
      ? {}
      : {
          status: (state?.status ?? 'not_started') as LessonSummary['status'],
          positionSeconds: state?.positionSeconds ?? 0,
        }),
  };
}

/** Share of a module's mandatory lessons that are complete. */
function modulePercent(lessons: LessonRow[], states: States): number {
  const counted = lessons.filter((l) => l.isMandatory);
  const pool = counted.length > 0 ? counted : lessons;
  if (pool.length === 0) return 100;
  const done = pool.filter((l) => states?.get(l.id)?.status === 'completed').length;
  return Math.round((done / pool.length) * 100);
}

function lockReason(required: number): string {
  return required >= 100
    ? 'Finish the previous module to open this one'
    : `Reach ${required}% of the previous module to open this one`;
}
