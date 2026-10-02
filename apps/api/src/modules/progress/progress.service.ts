import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  addDaysToDateKey,
  overallPercent,
  slugify,
  toLocalDateKey,
  zonedDateTimeToUtc,
  type ActivityItem,
  type AttendanceSummary,
  type CourseProgress,
  type LessonProgressInput,
  type LessonProgressResult,
  type ProgressOverview,
  type ScheduleDeadline,
} from '@lms/shared';
import { NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { publicationsReaching } from '../../core/scope/publication-reach.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AttendanceService } from '../attendance/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { AssessmentProgressService } from './assessment-progress.service.js';
import { creditWatching } from './watching.js';

/** Nothing on this page is unmeasurable any more; the list stays so a client overlay can add to it. */
const PENDING_METRICS: { key: string; label: string; reason: string }[] = [];

/**
 * One source of truth for "how far has this learner got". Every page that shows a percentage —
 * the player, the course page, the dashboard, the progress page, staff views — reads it from here,
 * so the numbers cannot disagree with each other.
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly settings: SettingsService,
    private readonly assessment: AssessmentProgressService,
    private readonly attendance: AttendanceService,
    private readonly tenant: TenantService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /**
   * The learner's attendance summary, from the same rule the roll call and every report use.
   * Null when no class has ever been marked for them, so the page says so rather than "0%".
   */
  private attendanceFor(
    studentId: string,
    within: string[] | null,
  ): Promise<AttendanceSummary | null> {
    return this.attendance.headlineFor(studentId, within);
  }

  /**
   * Saves a playback position, and credits the watching it shows (Phase 2, D2). Between two reports
   * the credit is how far playback moved, but never more than the time that really passed (allowing
   * playback up to twice as fast) nor more than one report's worth: seeking ahead, or a report that
   * claims more than happened, earns nothing. A `watch` lesson completes once the measured share
   * reaches the configured threshold; the browser's own figures are never trusted for that.
   */
  async recordLessonProgress(
    studentId: string,
    lessonId: string,
    input: LessonProgressInput,
  ): Promise<LessonProgressResult> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundError('Lesson');

    const settings = await this.settings.getAll();
    const threshold = settings.academic.lessonAutoCompletePct;
    // One watch clock per learner: a report is credited only with time since their last report on
    // any lesson, so playing several videos at once earns no more than playing one. A learner's
    // reports are taken one at a time (an advisory lock), so two arriving together cannot both
    // count the same seconds.
    const { watchedPct, completed, alreadyComplete } = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`watch:${studentId}`})::bigint)`;
        const existing = await tx.lessonProgress.findUnique({
          where: { studentId_lessonId: { studentId, lessonId } },
        });
        const elsewhere = await tx.lessonProgress.aggregate({
          where: { studentId, lessonId: { not: lessonId } },
          _max: { lastProgressAt: true },
        });
        const own = existing?.lastProgressAt ?? null;
        const latest = elsewhere._max.lastProgressAt;
        const now = new Date();
        const watchedSeconds = creditWatching({
          watchedSeconds: existing?.watchedSeconds ?? 0,
          previousPosition: existing?.positionSeconds ?? 0,
          // The first report on a lesson only sets its baseline.
          previousReportAt: own && latest && latest > own ? latest : own,
          position: input.positionSeconds,
          now,
          durationSeconds: lesson.durationSeconds,
        });
        const measuredPct =
          lesson.durationSeconds > 0
            ? Math.min(100, Math.floor((watchedSeconds / lesson.durationSeconds) * 100))
            : 0;
        // What the learner is shown never goes backwards; what completes the lesson is only measured.
        const watchedPct = Math.max(existing?.watchedPct ?? 0, measuredPct);
        const alreadyComplete = existing?.status === 'completed';
        const reachesRule =
          lesson.completionRule === 'watch' &&
          lesson.durationSeconds > 0 &&
          measuredPct >= threshold;
        const completed = alreadyComplete || reachesRule;
        await tx.lessonProgress.upsert({
          where: { studentId_lessonId: { studentId, lessonId } },
          create: {
            studentId,
            lessonId,
            status: completed ? 'completed' : 'in_progress',
            positionSeconds: input.positionSeconds,
            watchedPct,
            watchedSeconds,
            lastProgressAt: now,
            completedAt: completed ? now : null,
          },
          update: {
            status: completed ? 'completed' : 'in_progress',
            positionSeconds: input.positionSeconds,
            watchedPct,
            watchedSeconds,
            lastProgressAt: now,
            completedAt: completed ? (existing?.completedAt ?? now) : null,
            lastAccessedAt: now,
          },
        });
        return { watchedPct, completed, alreadyComplete };
      },
    );

    const newlyCompleted = completed && !alreadyComplete;
    if (newlyCompleted) await this.onLessonCompleted(studentId, lessonId, lesson.title);
    const coursePct = await this.recomputeCourse(studentId, lesson.module.courseId);
    return {
      status: completed ? 'completed' : 'in_progress',
      watchedPct,
      completed,
      newlyCompleted,
      coursePct,
    };
  }

  /**
   * "Mark complete", for lessons whose rule is `manual`, for opening a `view` lesson and for
   * passing a lab. Two callers can complete the same lesson at once (a lab lesson's own submission
   * and the progress listener), so the change to `completed` is made only once, and only the call
   * that made it records the activity.
   */
  async completeLesson(
    studentId: string,
    lessonId: string,
  ): Promise<{ status: string; coursePct: number }> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundError('Lesson');
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
    if (existing?.status !== 'completed' && (await this.markCompleted(studentId, lessonId))) {
      await this.onLessonCompleted(studentId, lessonId, lesson.title);
    }
    return {
      status: 'completed',
      coursePct: await this.recomputeCourse(studentId, lesson.module.courseId),
    };
  }

  /** Records that a learner opened a lesson, so "continue learning" knows where they were. */
  async touchLesson(studentId: string, lessonId: string, courseId: string): Promise<void> {
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
    if (!existing) {
      await this.prisma.lessonProgress.create({
        data: { studentId, lessonId, status: 'in_progress' },
      });
    } else {
      await this.prisma.lessonProgress.update({
        where: { id: existing.id },
        data: { lastAccessedAt: new Date() },
      });
    }
    await this.prisma.enrollment.updateMany({
      where: { studentId, courseId },
      data: { lastAccessedAt: new Date() },
    });
  }

  /**
   * Course percentage = completed mandatory lessons ÷ mandatory lessons. A course whose author
   * marked nothing mandatory counts every lesson, so the figure is never divided by zero.
   */
  async recomputeCourse(studentId: string, courseId: string): Promise<number> {
    const lessons = await this.prisma.lesson.findMany({
      where: { module: { courseId } },
      select: { id: true, isMandatory: true },
    });
    const counted = lessons.filter((l) => l.isMandatory);
    const pool = counted.length > 0 ? counted : lessons;
    if (pool.length === 0) return 0;

    const completed = await this.prisma.lessonProgress.count({
      where: { studentId, status: 'completed', lessonId: { in: pool.map((l) => l.id) } },
    });
    const pct = Math.round((completed / pool.length) * 100);
    const enrolment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (!enrolment) return pct;

    const nowComplete = pct >= 100;
    await this.prisma.enrollment.update({
      where: { id: enrolment.id },
      data: {
        progressPct: pct,
        // A withdrawn enrolment keeps its record up to date but does not come back by itself.
        status:
          enrolment.status === 'withdrawn' ? 'withdrawn' : nowComplete ? 'completed' : 'active',
        completedAt: nowComplete ? (enrolment.completedAt ?? new Date()) : null,
      },
    });
    if (nowComplete && !enrolment.completedAt) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true, slug: true },
      });
      await this.addActivity(studentId, {
        type: 'course.completed',
        entityType: 'course',
        entityId: courseId,
        title: `Finished ${course?.title ?? 'a course'}`,
        link: `/courses/${courseId}`,
      });
      this.events.emit('course.completed', { studentId, courseId });
    }
    return pct;
  }

  /**
   * Recomputes every enrolment of a course after its lessons changed (D1): a lesson added after a
   * learner finished, or the last unfinished one removed, changes their figure at once rather than
   * the next time they happen to complete something.
   */
  async recomputeCourseForEveryone(courseId: string): Promise<void> {
    const enrolments = await this.prisma.enrollment.findMany({
      where: { courseId },
      select: { studentId: true },
    });
    for (const enrolment of enrolments) {
      await this.recomputeCourse(enrolment.studentId, courseId);
    }
  }

  /**
   * Progress for every course a learner can open: published, and not withdrawn from (D4). `reach`
   * keeps to the courses some publications give them (a trainer's view, D6).
   */
  async coursesFor(
    studentId: string,
    reach: Prisma.CoursePublicationWhereInput | null = null,
  ): Promise<CourseProgress[]> {
    const enrolments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        status: { in: ['active', 'completed'] },
        course: {
          status: 'published',
          deletedAt: null,
          ...(reach ? { publications: { some: reach } } : {}),
        },
      },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { position: 'asc' },
              include: { lessons: { orderBy: { position: 'asc' } } },
            },
          },
        },
      },
      orderBy: [{ lastAccessedAt: { sort: 'desc', nulls: 'last' } }, { enrolledAt: 'desc' }],
    });
    if (enrolments.length === 0) return [];

    const lessonIds = enrolments.flatMap((e) =>
      e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)),
    );
    const progress = await this.prisma.lessonProgress.findMany({
      where: { studentId, lessonId: { in: lessonIds } },
      select: { lessonId: true, status: true },
    });
    const completed = new Set(
      progress.filter((p) => p.status === 'completed').map((p) => p.lessonId),
    );
    const instructors = await this.instructorsBySubject(studentId);

    return Promise.all(
      enrolments.map(async (enrolment) => {
        const lessons = enrolment.course.modules.flatMap((m) => m.lessons);
        // Counted on the same basis as the percentage: required lessons, when a course has optional ones.
        const required = lessons.filter((l) => l.isMandatory);
        const counted = required.length > 0 ? required : lessons;
        // "Continue" leads to what still counts; a course with only optional lessons left is done.
        const next = counted.find((l) => !completed.has(l.id)) ?? null;
        return {
          courseId: enrolment.courseId,
          title: enrolment.course.title,
          slug: enrolment.course.slug,
          thumbnailUrl: await this.thumbnailUrl(enrolment.course.thumbnailFileId),
          subject: enrolment.course.subject,
          level: enrolment.course.level,
          lessonCount: counted.length,
          completedLessons: counted.filter((l) => completed.has(l.id)).length,
          optionalLessons: lessons.length - counted.length,
          progressPct: enrolment.progressPct,
          status:
            enrolment.progressPct >= 100
              ? ('completed' as const)
              : enrolment.progressPct > 0
                ? ('in_progress' as const)
                : ('not_started' as const),
          nextLessonId: next?.id ?? null,
          nextLessonTitle: next?.title ?? null,
          lastAccessedAt: enrolment.lastAccessedAt?.toISOString() ?? null,
          moduleCount: enrolment.course.modules.length,
          durationMinutes: Math.round(lessons.reduce((n, l) => n + l.durationSeconds, 0) / 60),
          instructors: instructors.get(enrolment.course.subject) ?? [],
        };
      }),
    );
  }

  /**
   * A learner's progress. `within` limits it to some batches, for a trainer's view of the learner
   * (D6): the courses given to those batches, their assignments, tests and classes, and the activity
   * about those. Null is the whole record.
   */
  async overview(
    studentId: string,
    userId: string,
    within: string[] | null = null,
  ): Promise<ProgressOverview> {
    const reach = within === null ? null : await publicationsReaching(this.prisma, within);
    const courses = await this.coursesFor(studentId, reach);
    const lessons = courses.reduce((n, c) => n + c.lessonCount, 0);
    const completedLessons = courses.reduce((n, c) => n + c.completedLessons, 0);
    // Watching the server measured (D2), not where the playhead happens to stand.
    const watched = await this.prisma.lessonProgress.aggregate({
      where: {
        studentId,
        ...(reach ? { lesson: { module: { course: { publications: { some: reach } } } } } : {}),
      },
      _sum: { watchedSeconds: true },
    });
    const batchIds =
      within ??
      (
        await this.prisma.batchMember.findMany({
          where: { studentId, isActive: true },
          select: { batchId: true },
        })
      ).map((m) => m.batchId);
    const about =
      within === null
        ? undefined
        : await this.activityWithin(
            courses.map((c) => c.courseId),
            within,
          );
    return {
      overall: {
        courses: courses.length,
        completedCourses: courses.filter((c) => c.status === 'completed').length,
        lessons,
        completedLessons,
        // Each course counts once, as in the staff reports, so both sides show the same figure.
        progressPct: overallPercent(courses.map((c) => c.progressPct)),
        minutesWatched: Math.round((watched._sum.watchedSeconds ?? 0) / 60),
      },
      courses,
      assessment: await this.assessment.forStudent(studentId, batchIds, within !== null),
      attendance: await this.attendanceFor(studentId, within),
      activity: await this.activity(userId, 15, about),
      pending: PENDING_METRICS,
    };
  }

  /**
   * The learner's deadlines over a range of the institute's days (by default this week and the
   * next four), for the schedule.
   */
  async deadlinesFor(
    studentId: string,
    range: { from?: string; to?: string },
  ): Promise<ScheduleDeadline[]> {
    const zone = (await this.tenant.getOrganization()).timezone;
    const today = toLocalDateKey(new Date(), zone);
    const from = zonedDateTimeToUtc(range.from ?? addDaysToDateKey(today, -7), '00:00', zone);
    const to = zonedDateTimeToUtc(
      addDaysToDateKey(range.to ?? addDaysToDateKey(today, 30), 1),
      '00:00',
      zone,
    );
    const memberships = await this.prisma.batchMember.findMany({
      where: { studentId, isActive: true },
      select: { batchId: true },
    });
    return this.assessment.deadlinesFor(
      studentId,
      memberships.map((m) => m.batchId),
      from,
      to,
    );
  }

  async activity(
    userId: string,
    limit = 15,
    about?: Prisma.ActivityEventWhereInput,
  ): Promise<ActivityItem[]> {
    const rows = await this.prisma.activityEvent.findMany({
      where: { userId, ...about },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      link: row.link,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }

  /**
   * The activity a trainer's view of a learner shows (D6): labs, which belong to no batch, and what
   * concerns the courses, assignments and tests of the batches they see the learner through.
   * Anything else is left out, so a new kind of activity stays hidden until it is placed here.
   */
  private async activityWithin(
    courseIds: string[],
    batchIds: string[],
  ): Promise<Prisma.ActivityEventWhereInput> {
    const [lessons, assignments, tests] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { module: { courseId: { in: courseIds } } },
        select: { id: true },
      }),
      this.prisma.assignmentPublication.findMany({
        where: { batchId: { in: batchIds } },
        select: { assignmentId: true },
      }),
      this.prisma.testSchedule.findMany({
        where: { batchId: { in: batchIds } },
        select: { testId: true },
      }),
    ]);
    return {
      OR: [
        { entityType: 'question' },
        { entityType: 'course', entityId: { in: courseIds } },
        { entityType: 'lesson', entityId: { in: lessons.map((l) => l.id) } },
        { entityType: 'assignment', entityId: { in: assignments.map((a) => a.assignmentId) } },
        { entityType: 'test', entityId: { in: tests.map((t) => t.testId) } },
      ],
    };
  }

  async addActivity(
    studentId: string,
    entry: { type: string; entityType: string; entityId: string; title: string; link: string },
  ): Promise<void> {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });
    if (!student) return;
    await this.prisma.activityEvent.create({
      data: {
        userId: student.userId,
        type: entry.type,
        entityType: entry.entityType,
        entityId: entry.entityId,
        title: entry.title,
        link: entry.link,
      },
    });
  }

  /** Lesson ids the learner has completed, for the pages that draw ticks. */
  async completedLessonIds(studentId: string, lessonIds: string[]): Promise<Set<string>> {
    if (lessonIds.length === 0) return new Set();
    const rows = await this.prisma.lessonProgress.findMany({
      where: { studentId, lessonId: { in: lessonIds }, status: 'completed' },
      select: { lessonId: true },
    });
    return new Set(rows.map((r) => r.lessonId));
  }

  async lessonStates(
    studentId: string,
    lessonIds: string[],
  ): Promise<Map<string, { status: string; positionSeconds: number; watchedPct: number }>> {
    if (lessonIds.length === 0) return new Map();
    const rows = await this.prisma.lessonProgress.findMany({
      where: { studentId, lessonId: { in: lessonIds } },
    });
    return new Map(
      rows.map((r) => [
        r.lessonId,
        { status: r.status, positionSeconds: r.positionSeconds, watchedPct: r.watchedPct },
      ]),
    );
  }

  /** True when this call moved the lesson to `completed`; false when another call already had. */
  private async markCompleted(studentId: string, lessonId: string): Promise<boolean> {
    const now = new Date();
    const completed = { status: 'completed' as const, completedAt: now, watchedPct: 100 };
    const update = () =>
      this.prisma.lessonProgress.updateMany({
        where: { studentId, lessonId, status: { not: 'completed' } },
        data: { ...completed, lastAccessedAt: now },
      });
    if ((await update()).count === 1) return true;
    try {
      await this.prisma.lessonProgress.create({ data: { studentId, lessonId, ...completed } });
      return true;
    } catch (error) {
      // The row appeared meanwhile: opened, or completed by the other caller.
      if ((error as { code?: string }).code !== 'P2002') throw error;
      return (await update()).count === 1;
    }
  }

  private async onLessonCompleted(
    studentId: string,
    lessonId: string,
    lessonTitle: string,
  ): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });
    if (!lesson) return;
    await this.addActivity(studentId, {
      type: 'lesson.completed',
      entityType: 'lesson',
      entityId: lessonId,
      title: `Completed ${lessonTitle}`,
      link: `/courses/${lesson.module.courseId}/lessons/${lessonId}`,
    });
    this.events.emit('lesson.completed', { studentId, lessonId, courseId: lesson.module.courseId });
  }

  /**
   * The trainers who teach each subject to the learner's batches, keyed by the course subject key.
   * Batch assignments name subjects by label ("Core Java"); courses by key ("core-java").
   */
  async instructorsBySubject(studentId: string): Promise<Map<string, string[]>> {
    const memberships = await this.prisma.batchMember.findMany({
      where: { studentId, isActive: true },
      select: { batchId: true },
    });
    if (memberships.length === 0) return new Map();
    const rows = await this.prisma.batchTrainer.findMany({
      where: { batchId: { in: memberships.map((m) => m.batchId) } },
      select: { subject: true, trainer: { select: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const out = new Map<string, string[]>();
    for (const row of rows) {
      const key = slugify(row.subject);
      const names = out.get(key) ?? [];
      if (!names.includes(row.trainer.user.name)) names.push(row.trainer.user.name);
      out.set(key, names);
    }
    return out;
  }

  private async thumbnailUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null;
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.status !== 'ready') return null;
    return file.visibility === 'public' ? this.storage.publicUrl(file.key) : null;
  }
}
