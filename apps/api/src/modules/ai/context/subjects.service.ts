import { Injectable } from '@nestjs/common';
import type { AiConversationCreate } from '@lms/shared';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { NotFoundError } from '../../../core/http/errors.js';
import { CoursesService, LessonsService } from '../../courses/index.js';
import { PracticeService } from '../../practice/index.js';
import { AiHintNeedsAttemptError, AiSubjectNotSupportedError } from '../ai-errors.js';
import type { AiRequestSubject } from '../policy/data-class.js';
import { type AiMaterial, courseMaterial, labMaterial, lessonMaterial } from './material.js';

/** A lab hint comes after this many attempts at the lab that were not accepted (ADR-0031). */
export const HINT_AFTER_FAILED_ATTEMPTS = 1;

const NO_SUBJECT: AiRequestSubject = { courseId: null, lessonId: null, questionId: null };

/** The subject columns a conversation is read with. */
interface ConversationSubject {
  purpose: AiConversationCreate['purpose'];
  courseId: string | null;
  lessonId: string | null;
  questionId: string | null;
}

/**
 * What a conversation is about, and what it may bring to a question (Phase 7E; ADR-0031). The
 * browser names a subject by id and nothing more; each one is checked by the service that owns it,
 * with the person's own identity and reach, when the conversation starts and again at every
 * question — reach lost since is reach gone.
 *
 * - A **course** or a **lesson** is asked about from the assistant beside it, and only one the
 *   person reaches as a learner, or teaches, published; a lesson in a module still locked to them
 *   is not reached. Its material is its outline, or the lesson's own words.
 * - A **lab** is asked about from its AI Hint, only a lab the learner may work on, and only after
 *   an attempt that was not accepted. Its material is its statement, its visible examples and the
 *   learner's own latest attempt — never a hidden case, a solution or anybody else's work.
 */
@Injectable()
export class AiSubjectsService {
  constructor(
    private readonly courses: CoursesService,
    private readonly lessons: LessonsService,
    private readonly practice: PracticeService,
  ) {}

  /** The subject a new conversation names, checked, with a lesson's course filled in. */
  async resolve(user: AuthUser, input: AiConversationCreate): Promise<AiRequestSubject> {
    const { courseId, lessonId, questionId } = input.context ?? {};
    if (input.purpose === 'lab_hint') {
      if (courseId || lessonId || !questionId) throw new AiSubjectNotSupportedError();
      await this.practice.requireReachableLab(questionId, user);
      return { ...NO_SUBJECT, questionId };
    }
    if (questionId) throw new AiSubjectNotSupportedError();
    if (!courseId && !lessonId) return NO_SUBJECT;
    if (input.purpose !== 'assistant') throw new AiSubjectNotSupportedError();
    if (lessonId) {
      const lesson = await this.lessons.aiContextFor(lessonId, user);
      // A lesson of another course than the one named is no lesson of it.
      if (courseId && courseId !== lesson.courseId) throw new NotFoundError('Lesson');
      return { ...NO_SUBJECT, courseId: lesson.courseId, lessonId };
    }
    await this.courses.aiContextFor(courseId!, user);
    return { ...NO_SUBJECT, courseId: courseId! };
  }

  /**
   * The material the conversation's subject brings to a question, checked again now; null for a
   * general conversation. A lab hint without an attempt that was not accepted is refused.
   */
  async material(user: AuthUser, conversation: ConversationSubject): Promise<AiMaterial | null> {
    if (conversation.purpose === 'lab_hint') {
      // A lab withdrawn since leaves its hint conversation with nothing to hint at.
      if (!conversation.questionId) throw new NotFoundError('Lab');
      const brief = await this.practice.labHintBrief(conversation.questionId, user);
      if (brief.failedAttempts < HINT_AFTER_FAILED_ATTEMPTS) throw new AiHintNeedsAttemptError();
      return labMaterial(brief);
    }
    if (conversation.lessonId) {
      return lessonMaterial(await this.lessons.aiContextFor(conversation.lessonId, user));
    }
    if (conversation.courseId) {
      return courseMaterial(await this.courses.aiContextFor(conversation.courseId, user));
    }
    return null;
  }
}
