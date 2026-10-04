import { Inject, Injectable } from '@nestjs/common';
import {
  type LessonContent,
  type LessonDetail,
  type LessonLabSummary,
  type LessonProgressInput,
  type UnlockRule,
  lessonContentSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { sanitizeLessonHtml } from '../../core/html/sanitize.js';
import { htmlToText } from '../../core/html/text.js';
import {
  AppError,
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ModuleStateService } from '../../core/registry/module-state.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { signedDownload } from '../../core/storage/signed-download.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { ACCEPTED_PRACTICE_RUN } from '../execution/index.js';
import { LIVE_LAB } from '../practice/index.js';
import { ProgressService } from '../progress/index.js';
import { CoursesService } from './courses.service.js';
import { type PlaybackUrl, VideoService } from './video.driver.js';

/** How long a resource download link stays valid. */
const RESOURCE_TTL_SECONDS = 15 * 60;

/** A lesson as SI Academy AI may be told of it: its place and its own words (Phase 7E). */
export interface AiLessonContext {
  lessonId: string;
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  title: string;
  type: string;
  topic: string;
  /** The lesson's text as the player shows it, as plain words; empty for a video or a lab. */
  text: string;
}

interface LessonAccess {
  lessonId: string;
  courseId: string;
  moduleId: string;
  /** Present when the caller is a learner; staff previewing a course have none. */
  studentId: string | null;
}

/**
 * The learning player's side of a course: opening a lesson, playing its video, taking its
 * resources and recording how far the learner got. Every read here goes through the same access
 * check, so a lesson cannot be reached by guessing its id.
 */
@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly courses: CoursesService,
    private readonly progress: ProgressService,
    private readonly video: VideoService,
    private readonly modules: ModuleStateService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /** One lesson as the player shows it, with the learner's own position in it. */
  async get(lessonId: string, user: AuthUser): Promise<LessonDetail> {
    const access = await this.requireAccess(lessonId, user);
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: {
        resources: { orderBy: { position: 'asc' } },
        module: { include: { course: { select: { id: true, title: true } } } },
      },
    });
    const siblings = await this.prisma.lesson.findMany({
      where: { module: { courseId: access.courseId } },
      orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true },
    });
    const index = siblings.findIndex((l) => l.id === lessonId);
    const state = access.studentId
      ? (await this.progress.lessonStates(access.studentId, [lessonId])).get(lessonId)
      : undefined;
    const lab =
      lesson.type === 'lab' ? await this.labSummary(lesson.content, user, access.studentId) : null;
    // A `view` lesson is done the moment it is opened. A lab lesson whose lab the learner has
    // already passed — in the catalogue, or before the lesson was added — is done as well.
    const completes =
      lesson.completionRule === 'view' ||
      (lesson.completionRule === 'pass' && lab?.solved === true);

    if (access.studentId) {
      await this.progress.touchLesson(access.studentId, lessonId, access.courseId);
      if (completes && state?.status !== 'completed') {
        await this.progress.completeLesson(access.studentId, lessonId);
      }
    }

    const fileIds = lesson.resources.map((r) => r.fileId).filter(Boolean) as string[];
    const files = await this.prisma.file.findMany({
      where: { id: { in: fileIds } },
      select: { id: true, mime: true, size: true },
    });
    const byId = new Map(files.map((f) => [f.id, f]));

    return {
      id: lesson.id,
      courseId: lesson.module.course.id,
      courseTitle: lesson.module.course.title,
      moduleId: lesson.moduleId,
      moduleTitle: lesson.module.title,
      title: lesson.title,
      type: lesson.type,
      durationSeconds: lesson.durationSeconds,
      completionRule: lesson.completionRule,
      isMandatory: lesson.isMandatory,
      topic: lesson.topic,
      content: parseContent(lesson.content),
      resources: lesson.resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        fileId: resource.fileId,
        url: resource.url,
        mime: resource.fileId ? (byId.get(resource.fileId)?.mime ?? '') : '',
        size: resource.fileId ? (byId.get(resource.fileId)?.size ?? 0) : 0,
      })),
      status: completes
        ? 'completed'
        : ((state?.status ?? 'not_started') as LessonDetail['status']),
      positionSeconds: state?.positionSeconds ?? 0,
      watchedPct: state?.watchedPct ?? 0,
      previousLessonId: index > 0 ? (siblings[index - 1]?.id ?? null) : null,
      nextLessonId:
        index >= 0 && index < siblings.length - 1 ? (siblings[index + 1]?.id ?? null) : null,
      ...(lesson.type === 'lab' ? { lab } : {}),
    };
  }

  /**
   * What SI Academy AI may be told of a lesson (Phase 7E): the words its player shows the learner,
   * of a published course they reach as a learner — the module open to them — or teach. Unlike
   * `get`, nothing is recorded (the lesson is not marked as opened), and no draft is reached
   * through authoring rights. Only the lesson's own text: no resources, no lab or question
   * behind it. Phase 8's retrieval replaces this with the course's indexed material.
   */
  async aiContextFor(lessonId: string, user: AuthUser): Promise<AiLessonContext> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          select: {
            title: true,
            position: true,
            course: { select: { id: true, title: true, status: true, deletedAt: true } },
          },
        },
      },
    });
    if (!lesson) throw new NotFoundError('Lesson');
    const course = lesson.module.course;
    if (
      course.status !== 'published' ||
      course.deletedAt ||
      !(await this.courses.reachableCourseIds(user)).includes(course.id)
    ) {
      throw new ForbiddenError('That lesson is not part of a course you can open');
    }
    const person = await this.scope.personFor(user.id);
    if (person.studentId) {
      await this.requireUnlocked(course.id, lesson.module.position, person.studentId);
    }
    return {
      lessonId,
      courseId: course.id,
      courseTitle: course.title,
      moduleTitle: lesson.module.title,
      title: lesson.title,
      type: lesson.type,
      topic: lesson.topic,
      text: htmlToText(parseContent(lesson.content).html),
    };
  }

  /**
   * A lab lesson opening this lab that the learner can open now (Phase 7F, for SI Academy AI's lab
   * hints): of a published course they reach, in a module open to them — the player's own rule
   * (`aiContextFor`), with no authoring rights counted and nothing recorded. Refused when there is
   * none: a lab reached only through a withdrawn enrolment, an archived course or a locked module
   * is not one they may be helped with.
   */
  async requireOpenLabLesson(questionId: string, user: AuthUser): Promise<void> {
    const lessons = await this.prisma.lesson.findMany({
      where: { type: 'lab', content: { path: ['questionId'], equals: questionId } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    let refusal: unknown = new ForbiddenError('That lab is not open to you in any of your courses');
    for (const lesson of lessons) {
      try {
        await this.aiContextFor(lesson.id, user);
        return;
      } catch (error) {
        if (!(error instanceof AppError) || (error.status !== 403 && error.status !== 404)) {
          throw error;
        }
        refusal = error;
      }
    }
    throw refusal;
  }

  /** A short-lived link the player uses to stream the video. */
  async playback(lessonId: string, user: AuthUser): Promise<PlaybackUrl> {
    await this.requireAccess(lessonId, user);
    const lesson = await this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    const content = parseContent(lesson.content);
    if (!content.video) throw new NotFoundError('Video');
    return this.video.playback(content.video);
  }

  /** A short-lived link for one of the lesson's downloads. */
  async resourceUrl(
    lessonId: string,
    resourceId: string,
    user: AuthUser,
  ): Promise<{ url: string; expiresAt: string | null }> {
    await this.requireAccess(lessonId, user);
    const resource = await this.prisma.lessonResource.findFirst({
      where: { id: resourceId, lessonId },
    });
    if (!resource) throw new NotFoundError('Resource');
    if (!resource.fileId) {
      if (!resource.url) throw new NotFoundError('Resource');
      return { url: resource.url, expiresAt: null };
    }
    const file = await this.prisma.file.findUnique({ where: { id: resource.fileId } });
    if (!file || file.status !== 'ready') throw new NotFoundError('Resource');
    if (file.visibility === 'public') {
      return { url: this.storage.publicUrl(file.key), expiresAt: null };
    }
    const url = await signedDownload(
      this.storage,
      'private',
      file.key,
      'Resource',
      RESOURCE_TTL_SECONDS,
      file.originalName,
    );
    return { url, expiresAt: new Date(Date.now() + RESOURCE_TTL_SECONDS * 1000).toISOString() };
  }

  /** Saves how far through a video the learner is, and completes the lesson when the rule says so. */
  async recordProgress(lessonId: string, input: LessonProgressInput, user: AuthUser) {
    const access = await this.requireAccess(lessonId, user);
    if (!access.studentId) {
      throw new ForbiddenError('Only a learner records progress through a lesson');
    }
    return this.progress.recordLessonProgress(access.studentId, lessonId, input);
  }

  /**
   * "Mark complete", for `manual` and `view` lessons. A lesson an answer, a pass or measured watching
   * completes cannot be marked by hand; the one exception is a video whose length is not known,
   * because its watching cannot be measured.
   */
  async complete(lessonId: string, user: AuthUser) {
    const access = await this.requireAccess(lessonId, user);
    if (!access.studentId) {
      throw new ForbiddenError('Only a learner completes a lesson');
    }
    const lesson = await this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    if (lesson.completionRule === 'watch' && lesson.durationSeconds > 0) {
      throw new DomainRuleError(
        'This lesson completes itself once you have watched it',
        'lesson_completes_on_watch',
      );
    }
    if (lesson.completionRule === 'pass') {
      throw lesson.type === 'practice'
        ? new DomainRuleError(
            'This lesson completes itself once you answer its question correctly',
            'lesson_completes_on_answer',
          )
        : new DomainRuleError(
            'This lesson completes itself once you pass its lab',
            'lesson_completes_on_pass',
          );
    }
    return this.progress.completeLesson(access.studentId, lessonId);
  }

  /** A practice lesson's `pass`: its question was answered correctly (checked by the caller). */
  completeOnCorrectAnswer(lessonId: string, studentId: string) {
    return this.progress.completeLesson(studentId, lessonId);
  }

  /**
   * The lab a lab lesson opens, as the player shows it before the lab itself is opened. Null when
   * the lab has been withdrawn, or Labs are switched off.
   */
  private async labSummary(
    content: unknown,
    user: AuthUser,
    studentId: string | null,
  ): Promise<LessonLabSummary | null> {
    const questionId = parseContent(content).questionId;
    if (!questionId || !(await this.modules.isEnabledFor('practice', user))) return null;
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, ...LIVE_LAB },
      select: { title: true, type: true, difficulty: true },
    });
    if (!question) return null;
    const solved =
      studentId !== null &&
      (await this.prisma.executionRun.count({
        where: { userId: user.id, questionId, ...ACCEPTED_PRACTICE_RUN },
      })) > 0;
    return {
      questionId,
      title: question.title,
      type: question.type as LessonLabSummary['type'],
      difficulty: question.difficulty,
      solved,
    };
  }

  // ───────────────────────── access ─────────────────────────

  /**
   * Establishes that the caller may open this lesson: staff who manage courses always may, a
   * learner only when they are enrolled and the module ahead of it has been unlocked.
   */
  /** Shared with the lesson's own practice question, which needs the same answer. */
  requireLessonAccess(lessonId: string, user: AuthUser): Promise<LessonAccess> {
    return this.requireAccess(lessonId, user);
  }

  private async requireAccess(lessonId: string, user: AuthUser): Promise<LessonAccess> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { id: true, courseId: true, position: true } } },
    });
    if (!lesson) throw new NotFoundError('Lesson');
    const courseId = lesson.module.courseId;
    const person = await this.scope.personFor(user.id);

    if (await this.courses.mayAuthor(courseId, user)) {
      return { lessonId, courseId, moduleId: lesson.moduleId, studentId: person.studentId };
    }
    const reachable = await this.courses.reachableCourseIds(user);
    if (!reachable.includes(courseId)) {
      throw new ForbiddenError('That lesson is not part of a course you can open');
    }
    if (!person.studentId) {
      return { lessonId, courseId, moduleId: lesson.moduleId, studentId: null };
    }
    await this.requireUnlocked(courseId, lesson.module.position, person.studentId);
    return { lessonId, courseId, moduleId: lesson.moduleId, studentId: person.studentId };
  }

  /** Walks the modules in order, so a locked module cannot be skipped by opening a lesson inside it. */
  private async requireUnlocked(
    courseId: string,
    position: number,
    studentId: string,
  ): Promise<void> {
    if (position === 0) return;
    const modules = await this.prisma.courseModule.findMany({
      where: { courseId, position: { lte: position } },
      orderBy: { position: 'asc' },
      include: { lessons: { select: { id: true, isMandatory: true } } },
    });
    const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
    const completed = await this.progress.completedLessonIds(studentId, lessonIds);

    let previousPercent = 100;
    for (const module of modules) {
      const rule = module.unlockRule as UnlockRule;
      const required = rule.type === 'after_previous' ? rule.minPercent : 0;
      if (module.position === position && rule.type === 'after_previous') {
        if (previousPercent < required) {
          throw new ForbiddenError(
            required >= 100
              ? 'Finish the previous module to open this one'
              : `Reach ${required}% of the previous module to open this one`,
            'module_locked',
          );
        }
      }
      const counted = module.lessons.filter((l) => l.isMandatory);
      const pool = counted.length > 0 ? counted : module.lessons;
      previousPercent =
        pool.length === 0
          ? 100
          : Math.round((pool.filter((l) => completed.has(l.id)).length / pool.length) * 100);
    }
  }
}

/**
 * Lesson content is stored as JSON; parsing it here keeps a hand-edited row from reaching the UI,
 * and cleaning the body again covers rows written before bodies were cleaned on save.
 */
function parseContent(value: unknown): LessonContent {
  const parsed = lessonContentSchema.safeParse(value ?? {});
  return parsed.success
    ? { ...parsed.data, html: sanitizeLessonHtml(parsed.data.html) }
    : { html: '', video: null, questionId: null };
}
