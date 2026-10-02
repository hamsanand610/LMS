import { Injectable } from '@nestjs/common';
import type {
  LessonLabView,
  PracticeSubmissionDetail,
  PracticeSubmissionRecord,
  PracticeSubmitInput,
  PracticeSubmitOutcome,
  RunInput,
  RunOutcome,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { DomainRuleError, ForbiddenError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ModuleStateService } from '../../core/registry/module-state.service.js';
import { LIVE_LAB, PracticeService } from '../practice/index.js';
import { ProgressService } from '../progress/index.js';
import { LessonsService } from './lessons.service.js';

/**
 * A lab opened from a course lesson (ADR-0018). The lesson's access rules apply — enrolled, and the
 * module unlocked — and passing the lab completes the lesson through the ordinary progress model.
 * The lab itself is the same question the catalogue offers, run the same way in the sandbox.
 */
@Injectable()
export class LessonLabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessons: LessonsService,
    private readonly practice: PracticeService,
    private readonly progress: ProgressService,
    private readonly modules: ModuleStateService,
  ) {}

  async get(lessonId: string, user: AuthUser): Promise<LessonLabView> {
    const { lesson, studentId, question, reason } = await this.require(lessonId, user);
    const siblings = await this.prisma.lesson.findMany({
      where: { module: { courseId: lesson.module.courseId } },
      orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true },
    });
    const index = siblings.findIndex((l) => l.id === lessonId);
    const progress = studentId
      ? await this.prisma.lessonProgress.findUnique({
          where: { studentId_lessonId: { studentId, lessonId } },
        })
      : null;
    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      courseId: lesson.module.courseId,
      courseTitle: lesson.module.course.title,
      problem: question ? await this.practice.detail(question, user) : null,
      available: question !== null,
      reason,
      completed: progress?.status === 'completed',
      nextLessonId:
        index >= 0 && index < siblings.length - 1 ? (siblings[index + 1]?.id ?? null) : null,
    };
  }

  async run(lessonId: string, input: RunInput, user: AuthUser): Promise<RunOutcome> {
    const { question } = await this.requireAvailable(lessonId, user);
    return this.practice.runQuestion(question.id, input, user);
  }

  /** Submits the lab; a pass completes the lesson. */
  async submit(
    lessonId: string,
    input: PracticeSubmitInput,
    user: AuthUser,
  ): Promise<PracticeSubmitOutcome & { lessonCompleted: boolean }> {
    const { question, studentId } = await this.requireAvailable(lessonId, user);
    if (!studentId) throw new ForbiddenError('Only a learner submits a lab; preview it instead');
    const outcome = await this.practice.submitQuestion(question.id, input, user);
    let lessonCompleted = false;
    if (outcome.submission.verdict === 'passed' && outcome.submission.trust === 'trusted') {
      await this.progress.completeLesson(studentId, lessonId);
      lessonCompleted = true;
    }
    return { ...outcome, lessonCompleted };
  }

  async history(lessonId: string, user: AuthUser): Promise<PracticeSubmissionRecord[]> {
    const { question } = await this.requireAvailable(lessonId, user);
    return this.practice.historyFor(question.id, user);
  }

  async submission(
    lessonId: string,
    runId: string,
    user: AuthUser,
  ): Promise<PracticeSubmissionDetail> {
    const { question } = await this.requireAvailable(lessonId, user);
    return this.practice.submissionFor(question.id, runId, user);
  }

  // ───────────────────────── internals ─────────────────────────

  private async require(lessonId: string, user: AuthUser) {
    const access = await this.lessons.requireLessonAccess(lessonId, user);
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true, course: { select: { title: true } } } } },
    });
    if (!lesson) throw new NotFoundError('Lesson');
    if (lesson.type !== 'lab') {
      throw new DomainRuleError('That lesson is not a lab.', 'not_a_lab_lesson');
    }
    const questionId = (lesson.content as { questionId?: string | null } | null)?.questionId;
    if (!(await this.modules.isEnabledFor('practice', user))) {
      return {
        lesson,
        studentId: access.studentId,
        question: null,
        reason: 'Labs are not switched on for you.',
      };
    }
    // A lab withdrawn after the lesson was saved (unpublished, retired, edited and not checked
    // again) is shown as unavailable rather than opened half-working.
    const question = questionId
      ? await this.prisma.question.findFirst({ where: { id: questionId, ...LIVE_LAB } })
      : null;
    return {
      lesson,
      studentId: access.studentId,
      question,
      reason: question ? null : 'This lab is not available right now. Try again later.',
    };
  }

  private async requireAvailable(lessonId: string, user: AuthUser) {
    const found = await this.require(lessonId, user);
    if (!found.question) {
      throw new DomainRuleError(found.reason ?? 'This lab is not available.', 'lab_unavailable');
    }
    return { ...found, question: found.question };
  }
}
