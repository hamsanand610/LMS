import { Injectable } from '@nestjs/common';
import type { LessonPracticeView, SubmissionInput } from '@lms/shared';
import { EXECUTED_TYPES, OBJECTIVE_TYPES } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { DomainRuleError, ForbiddenError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { QuestionsService } from '../questions/index.js';
import { LessonsService } from './lessons.service.js';

/**
 * A question embedded in a lesson (plan DP-S05). It is answered where it stands rather than
 * through an assignment, and getting it right completes the lesson.
 *
 * Only the types that can be marked without a person reading the answer are answered here. A
 * coding or written question embedded in a lesson is pointed at the place that can mark it — a lab
 * lesson, the Labs or an assignment — rather than accepted and left in limbo.
 */
@Injectable()
export class LessonPracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessons: LessonsService,
    private readonly questions: QuestionsService,
  ) {}

  async get(lessonId: string, user: AuthUser): Promise<LessonPracticeView> {
    const { lesson, studentId } = await this.require(lessonId, user);
    const content = (lesson.content ?? {}) as { questionId?: string | null };
    const questionId = content.questionId ?? null;

    if (!questionId) {
      return {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        courseId: lesson.module.courseId,
        question: null,
        answerable: false,
        reason: 'This lesson has no question attached to it yet.',
        completed: false,
      };
    }

    const question = await this.questions.get(questionId, user, true);
    const answerable = OBJECTIVE_TYPES.includes(question.type);
    const progress = studentId
      ? await this.prisma.lessonProgress.findUnique({
          where: { studentId_lessonId: { studentId, lessonId } },
        })
      : null;

    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      courseId: lesson.module.courseId,
      question,
      answerable,
      reason: answerable
        ? null
        : (EXECUTED_TYPES as readonly string[]).includes(question.type)
          ? 'An exercise that runs code is done in a lab lesson or in the Labs, where the editor and the checks are.'
          : 'This answer needs a person to read it, so it is answered in an assignment.',
      completed: progress?.status === 'completed',
    };
  }

  /** Marks the answer, and completes the lesson when it is right. */
  async submit(
    lessonId: string,
    input: SubmissionInput,
    user: AuthUser,
  ): Promise<{ correct: boolean; explanation: string; completed: boolean }> {
    const { lesson, studentId } = await this.require(lessonId, user);
    if (!studentId) throw new ForbiddenError('Only a learner answers a lesson question.');

    const content = (lesson.content ?? {}) as { questionId?: string | null };
    const questionId = content.questionId ?? null;
    if (!questionId) throw new NotFoundError('Question');

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!question) throw new NotFoundError('Question');
    if (!OBJECTIVE_TYPES.includes(question.type)) {
      throw new DomainRuleError(
        'This kind of question is not answered here.',
        'not_answerable_here',
      );
    }

    const correctIds = question.options.filter((option) => option.isCorrect).map((o) => o.id);
    const chosen = [...new Set(input.optionIds ?? [])];
    const correct =
      chosen.length === correctIds.length && chosen.every((id) => correctIds.includes(id));

    // Getting it right is what completes the lesson; getting it wrong leaves it open to try again.
    let completed = false;
    if (correct) {
      await this.lessons.completeOnCorrectAnswer(lessonId, studentId);
      completed = true;
    }

    return { correct, explanation: correct ? question.explanation : '', completed };
  }

  private async require(lessonId: string, user: AuthUser) {
    const access = await this.lessons.requireLessonAccess(lessonId, user);
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundError('Lesson');
    if (lesson.type !== 'practice') {
      throw new DomainRuleError('That lesson is not a practice question.', 'not_a_practice_lesson');
    }
    return { lesson, studentId: access.studentId };
  }
}
