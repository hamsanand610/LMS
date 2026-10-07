import { Injectable } from '@nestjs/common';
import { type AuthUser, hasPermission } from '../../core/auth/auth-user.js';
import { ForbiddenError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ModuleStateService } from '../../core/registry/module-state.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { ProgressService } from '../progress/index.js';
import { COURSES_NOT_OPEN, CoursesService } from './courses.service.js';
import { lockedModules } from './lessons.service.js';

/** How much of a learner's state one read gives, at most: the rest is counted, not listed. */
export const LEARNING_STATE_LIMITS = {
  /** Lessons of one course listed by name, around the next one. */
  lessons: 40,
  /** Modules of one course listed by name, around the next lesson's. */
  modules: 12,
  /** Courses the overview lists. */
  courses: 8,
  /** Characters of any one title. */
  title: 80,
} as const;

export type LearningLessonStatus = 'completed' | 'in_progress' | 'not_started';

export interface LearningStateLesson {
  title: string;
  module: string;
  type: string;
  mandatory: boolean;
  status: LearningLessonStatus;
  /** Whether the learner can open it now: its module is not locked to them. */
  open: boolean;
}

export interface LearningStateModule {
  title: string;
  open: boolean;
  /** While it is locked: the share of the module before it that opens it. */
  unlockPercent: number | null;
  lessons: number;
  completed: number;
}

/** One course as its learner stands in it, read live (Phase 9C; ADR-0040). */
export interface CourseLearningState {
  courseId: string;
  title: string;
  /** The completion the enrolment records, 0–100, as the learner's course page shows it. */
  progressPct: number;
  /** Lessons that count towards completion — the required ones, or every one when none is — and how many are done. */
  countedLessons: number;
  countedCompleted: number;
  lessonCount: number;
  completedLessons: number;
  modules: LearningStateModule[];
  modulesLeftOut: number;
  lessons: LearningStateLesson[];
  lessonsLeftOut: number;
  /** The next lesson that counts and is open to them — or, while that one is locked, what opens it. */
  next: { title: string; module: string; type: string } | null;
  /** The next lesson that counts is in a module still locked to them: which, and what opens it. */
  locked: { title: string; module: string; unlockPercent: number; previousModule: string } | null;
  lastAccessedAt: Date | null;
}

/** A course in the overview of all the learner's courses. */
export interface CourseLearningSummary {
  courseId: string;
  title: string;
  progressPct: number;
  countedLessons: number;
  countedCompleted: number;
  /** The next open lesson that counts (lock-aware), or null. */
  next: string | null;
  lastAccessedAt: Date | null;
}

export interface LearningStateOverview {
  courses: CourseLearningSummary[];
  /** Courses open to them that the overview does not list. */
  coursesLeftOut: number;
}

/** A course as the state is worked out from: the enrolment's completion and the outline. */
export interface LearningStateCourse {
  courseId: string;
  progressPct: number;
  lastAccessedAt: Date | null;
  title: string;
  modules: {
    title: string;
    position: number;
    unlockRule: unknown;
    lessons: { id: string; title: string; type: string; isMandatory: boolean }[];
  }[];
}

/**
 * The learner's own learning state, as SI Academy AI may be told of it (Roadmap Phase 9C;
 * ADR-0040): read live, when it is asked for, from the records that hold it — the course outline,
 * the learner's lesson progress, the enrolment's completion and the course's unlock rules. Never
 * stored, and nothing is changed by reading it: no lesson is marked opened or completed and no
 * course is recomputed (as `LessonsService.get`, the player's own read, does).
 *
 * Every read asks first, itself, whoever calls it — it does not rely on a route's guards: the
 * caller's learner profile is the one named; `courses:read` and the Courses module are on for them;
 * `progress:read` and the Progress module too; and a course is of this institute, published, and
 * one their enrolment still opens. The next lesson follows the player's rule: the first lesson that
 * counts towards completion, not completed, in a module open to them — or, while that module is
 * locked, the lesson of the module before it that opens it.
 */
@Injectable()
export class CourseLearningStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
    private readonly modules: ModuleStateService,
    private readonly courses: CoursesService,
    private readonly progress: ProgressService,
  ) {}

  /** One course, as the learner stands in it now. Refused unless all of the above hold. */
  async courseState(
    user: AuthUser,
    studentId: string,
    courseId: string,
  ): Promise<CourseLearningState> {
    await this.assertMayRead(user, studentId, courseId);
    const [course] = await this.load(studentId, [courseId]);
    if (!course) throw new NotFoundError('Course');
    return learningStateOf(course, await this.completedIn(studentId, [course]));
  }

  /** Every course open to the learner, most recently opened first: at most eight, the rest counted. */
  async overview(user: AuthUser, studentId: string): Promise<LearningStateOverview> {
    await this.assertMayRead(user, studentId, null);
    const reachable = await this.courses.reachableCourseIds(user);
    const loaded = await this.load(studentId, reachable, LEARNING_STATE_LIMITS.courses);
    const states = await this.completedIn(studentId, loaded);
    return {
      courses: loaded.map((course) => {
        const state = learningStateOf(course, states);
        return {
          courseId: state.courseId,
          title: state.title,
          progressPct: state.progressPct,
          countedLessons: state.countedLessons,
          countedCompleted: state.countedCompleted,
          next: state.next?.title ?? null,
          lastAccessedAt: state.lastAccessedAt,
        };
      }),
      coursesLeftOut: Math.max(0, reachable.length - loaded.length),
    };
  }

  /**
   * Whether this person may be told their own learning state now — of one course, or of their
   * courses — refused (`ForbiddenError`) unless: they are the learner named, `courses:read` and the
   * Courses module, `progress:read` and the Progress module, and the course still open to them.
   * Asked again before an answer drawn from it is given (the learning agent's last check).
   */
  async assertMayRead(user: AuthUser, studentId: string, courseId: string | null): Promise<void> {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId || person.studentId !== studentId) {
      throw new ForbiddenError(
        'Only a learner may be told their own learning state',
        'not_learner',
      );
    }
    if (!(await this.courses.readableBy(user))) throw new ForbiddenError(COURSES_NOT_OPEN);
    if (
      !hasPermission(user, 'progress:read') ||
      !(await this.modules.isEnabledFor('progress', user))
    ) {
      throw new ForbiddenError('Progress is not open to you');
    }
    if (courseId !== null && !(await this.courses.reachableCourseIds(user)).includes(courseId)) {
      throw new ForbiddenError('That course has not been published to you');
    }
  }

  /**
   * The learner's enrolments that stand, in courses of this institute that are published, with
   * their outlines — only reads.
   */
  private async load(
    studentId: string,
    courseIds: readonly string[],
    take?: number,
  ): Promise<LearningStateCourse[]> {
    if (courseIds.length === 0) return [];
    const org = await this.tenant.getOrganization();
    const rows = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        courseId: { in: [...courseIds] },
        status: { in: ['active', 'completed'] },
        course: { organizationId: org.id, status: 'published', deletedAt: null },
      },
      orderBy: [{ lastAccessedAt: { sort: 'desc', nulls: 'last' } }, { enrolledAt: 'desc' }],
      ...(take ? { take } : {}),
      select: {
        courseId: true,
        progressPct: true,
        lastAccessedAt: true,
        course: {
          select: {
            title: true,
            modules: {
              orderBy: { position: 'asc' },
              select: {
                title: true,
                position: true,
                unlockRule: true,
                lessons: {
                  orderBy: { position: 'asc' },
                  select: { id: true, title: true, type: true, isMandatory: true },
                },
              },
            },
          },
        },
      },
    });
    return rows.map((row) => ({
      courseId: row.courseId,
      progressPct: row.progressPct,
      lastAccessedAt: row.lastAccessedAt,
      title: row.course.title,
      modules: row.course.modules,
    }));
  }

  /** Each lesson's status for the learner, read — never written — through the progress module. */
  private async completedIn(
    studentId: string,
    courses: readonly LearningStateCourse[],
  ): Promise<Map<string, LearningLessonStatus>> {
    const lessonIds = courses.flatMap((course) =>
      course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)),
    );
    const states = await this.progress.lessonStates(studentId, lessonIds);
    return new Map(
      [...states.entries()].map(([lessonId, state]) => [
        lessonId,
        state.status === 'completed' || state.status === 'in_progress'
          ? state.status
          : 'not_started',
      ]),
    );
  }
}

/**
 * One course as its learner stands in it (pure: the reads are done): the lessons that count and
 * how many are done; the modules locked to them, by the player's rule (`lockedModules`); the next
 * lesson that counts and is open — or, while it is in a locked module, what opens it; and the
 * lessons and modules around where they are, within `LEARNING_STATE_LIMITS`.
 */
export function learningStateOf(
  course: LearningStateCourse,
  statuses: ReadonlyMap<string, LearningLessonStatus>,
): CourseLearningState {
  const completed = new Set(
    [...statuses.entries()].filter(([, status]) => status === 'completed').map(([id]) => id),
  );
  const locked = lockedModules(course.modules, completed);
  const all = course.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({ ...lesson, module })),
  );
  const required = all.filter((lesson) => lesson.isMandatory);
  const counted = required.length > 0 ? required : all;
  const isOpen = (position: number) => !locked.has(position);

  let next: CourseLearningState['next'] = null;
  let blocked: CourseLearningState['locked'] = null;
  const left = counted.find((lesson) => !completed.has(lesson.id));
  if (left && isOpen(left.module.position)) {
    next = { title: clip(left.title), module: clip(left.module.title), type: left.type };
  } else if (left) {
    const at = course.modules.indexOf(left.module);
    const previous = at > 0 ? course.modules[at - 1]! : null;
    blocked = {
      title: clip(left.title),
      module: clip(left.module.title),
      unlockPercent: locked.get(left.module.position) ?? 100,
      previousModule: clip(previous?.title ?? ''),
    };
    // What opens it: a lesson of the module before, of the share its unlock rule counts.
    if (previous && isOpen(previous.position)) {
      const pool = previous.lessons.some((lesson) => lesson.isMandatory)
        ? previous.lessons.filter((lesson) => lesson.isMandatory)
        : previous.lessons;
      const opener = pool.find((lesson) => !completed.has(lesson.id));
      if (opener) {
        next = { title: clip(opener.title), module: clip(previous.title), type: opener.type };
      }
    }
  }

  // The lessons around where the learner is: from a little before the next one.
  const focus = Math.max(
    0,
    all.findIndex((lesson) => !completed.has(lesson.id)),
  );
  const lessonStart = Math.max(0, Math.min(focus - 10, all.length - LEARNING_STATE_LIMITS.lessons));
  const lessons = all
    .slice(lessonStart, lessonStart + LEARNING_STATE_LIMITS.lessons)
    .map((lesson) => ({
      title: clip(lesson.title),
      module: clip(lesson.module.title),
      type: lesson.type,
      mandatory: lesson.isMandatory,
      status: statuses.get(lesson.id) ?? 'not_started',
      open: isOpen(lesson.module.position),
    }));
  const focusModule = all[focus] ? course.modules.indexOf(all[focus]!.module) : 0;
  const moduleStart = Math.max(
    0,
    Math.min(focusModule - 3, course.modules.length - LEARNING_STATE_LIMITS.modules),
  );
  const modules = course.modules
    .slice(moduleStart, moduleStart + LEARNING_STATE_LIMITS.modules)
    .map((module) => ({
      title: clip(module.title),
      open: isOpen(module.position),
      unlockPercent: locked.get(module.position) ?? null,
      lessons: module.lessons.length,
      completed: module.lessons.filter((lesson) => completed.has(lesson.id)).length,
    }));

  return {
    courseId: course.courseId,
    title: clip(course.title),
    progressPct: course.progressPct,
    countedLessons: counted.length,
    countedCompleted: counted.filter((lesson) => completed.has(lesson.id)).length,
    lessonCount: all.length,
    completedLessons: all.filter((lesson) => completed.has(lesson.id)).length,
    modules,
    modulesLeftOut: course.modules.length - modules.length,
    lessons,
    lessonsLeftOut: all.length - lessons.length,
    next,
    locked: blocked,
    lastAccessedAt: course.lastAccessedAt,
  };
}

/** A title on one line, at most `LEARNING_STATE_LIMITS.title` characters. */
function clip(title: string): string {
  const line = title.replace(/\s+/g, ' ').trim();
  return line.length <= LEARNING_STATE_LIMITS.title
    ? line
    : `${line.slice(0, LEARNING_STATE_LIMITS.title - 1).trimEnd()}…`;
}
