import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ActivityItem,
  CourseProgress,
  LessonProgressInput,
  ProgressOverview,
} from '@lms/shared';
import { NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { SettingsService } from '../settings/settings.service.js';

/** Figures the learning pages will show once their modules exist; never invented in the meantime. */
const PENDING_METRICS = [
  {
    key: 'assignments',
    label: 'Assignments',
    reason: 'Assignments and their grading arrive in Phase 4.',
  },
  { key: 'tests', label: 'Tests', reason: 'Tests and results arrive in Phase 4.' },
  {
    key: 'attendance',
    label: 'Attendance',
    reason: 'Attendance is recorded from Phase 5.',
  },
];

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
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /** Saves a playback position. Auto-completes a `watch` lesson once the configured share is seen. */
  async recordLessonProgress(
    studentId: string,
    lessonId: string,
    input: LessonProgressInput,
  ): Promise<{ status: string; watchedPct: number; completed: boolean; coursePct: number }> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundError('Lesson');

    const settings = await this.settings.getAll();
    const threshold = settings.academic.lessonAutoCompletePct;
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
    const alreadyComplete = existing?.status === 'completed';
    // Watched percentage only ever grows: scrubbing backwards must not undo progress.
    const watchedPct = Math.max(existing?.watchedPct ?? 0, input.watchedPct);
    const shouldComplete =
      alreadyComplete || (lesson.completionRule === 'watch' && watchedPct >= threshold);

    await this.prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: {
        studentId,
        lessonId,
        status: shouldComplete ? 'completed' : 'in_progress',
        positionSeconds: input.positionSeconds,
        watchedPct,
        completedAt: shouldComplete ? new Date() : null,
      },
      update: {
        status: shouldComplete ? 'completed' : 'in_progress',
        positionSeconds: input.positionSeconds,
        watchedPct,
        completedAt: shouldComplete ? (existing?.completedAt ?? new Date()) : null,
        lastAccessedAt: new Date(),
      },
    });

    if (shouldComplete && !alreadyComplete) {
      await this.onLessonCompleted(studentId, lessonId, lesson.title);
    }
    const coursePct = await this.recomputeCourse(studentId, lesson.module.courseId);
    return {
      status: shouldComplete ? 'completed' : 'in_progress',
      watchedPct,
      completed: shouldComplete,
      coursePct,
    };
  }

  /** "Mark complete", for lessons whose rule is `manual`, and for opening a `view` lesson. */
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
    if (existing?.status !== 'completed') {
      await this.prisma.lessonProgress.upsert({
        where: { studentId_lessonId: { studentId, lessonId } },
        create: {
          studentId,
          lessonId,
          status: 'completed',
          completedAt: new Date(),
          watchedPct: 100,
        },
        update: {
          status: 'completed',
          completedAt: new Date(),
          watchedPct: Math.max(existing?.watchedPct ?? 0, 100),
          lastAccessedAt: new Date(),
        },
      });
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
        status: nowComplete ? 'completed' : 'active',
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

  /** Progress for every course a learner is enrolled in. */
  async coursesFor(studentId: string): Promise<CourseProgress[]> {
    const enrolments = await this.prisma.enrollment.findMany({
      where: { studentId },
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

    return Promise.all(
      enrolments.map(async (enrolment) => {
        const lessons = enrolment.course.modules.flatMap((m) => m.lessons);
        const next = lessons.find((l) => !completed.has(l.id)) ?? null;
        return {
          courseId: enrolment.courseId,
          title: enrolment.course.title,
          slug: enrolment.course.slug,
          thumbnailUrl: await this.thumbnailUrl(enrolment.course.thumbnailFileId),
          subject: enrolment.course.subject,
          level: enrolment.course.level,
          lessonCount: lessons.length,
          completedLessons: lessons.filter((l) => completed.has(l.id)).length,
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
        };
      }),
    );
  }

  async overview(studentId: string, userId: string): Promise<ProgressOverview> {
    const courses = await this.coursesFor(studentId);
    const lessons = courses.reduce((n, c) => n + c.lessonCount, 0);
    const completedLessons = courses.reduce((n, c) => n + c.completedLessons, 0);
    const watched = await this.prisma.lessonProgress.findMany({
      where: { studentId },
      select: { positionSeconds: true },
    });
    return {
      overall: {
        courses: courses.length,
        completedCourses: courses.filter((c) => c.status === 'completed').length,
        lessons,
        completedLessons,
        progressPct: lessons === 0 ? 0 : Math.round((completedLessons / lessons) * 100),
        minutesWatched: Math.round(watched.reduce((n, p) => n + p.positionSeconds, 0) / 60),
      },
      courses,
      activity: await this.activity(userId),
      pending: PENDING_METRICS,
    };
  }

  async activity(userId: string, limit = 15): Promise<ActivityItem[]> {
    const rows = await this.prisma.activityEvent.findMany({
      where: { userId },
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

  private async thumbnailUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null;
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.status !== 'ready') return null;
    return file.visibility === 'public' ? this.storage.publicUrl(file.key) : null;
  }
}
