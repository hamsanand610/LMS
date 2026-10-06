import { Injectable } from '@nestjs/common';
import type { AiConversationCreate } from '@lms/shared';
import { type AuthUser, hasPermission } from '../../../core/auth/auth-user.js';
import { ForbiddenError, NotFoundError } from '../../../core/http/errors.js';
import { ModuleStateService } from '../../../core/registry/module-state.service.js';
import { ScopeService } from '../../../core/scope/scope.service.js';
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
 * - A **course** or a **lesson** is asked about from the assistant beside it, by someone who may
 *   read courses (`courses:read`, the Courses module on for them), and only one they reach as a
 *   learner, or teach, published; a lesson in a module still locked to them is not reached. Its
 *   material is its outline, or the lesson's own words.
 * - The **learning agent** (Phase 9B; ADR-0039) is a learner's alone, about a course or lesson as
 *   the assistant's is, or about nothing in particular; its runs check that subject again, each time.
 * - A **lab** is asked about from its AI Hint, by a learner (never staff, whatever a role grants),
 *   with Labs switched on for them, on a lab they may work on now — in the Labs catalogue, or opened
 *   by a lesson they can open, as the player decides (Phase 7F) — and only after a submission that
 *   was not accepted. Its material is its statement, its visible examples and the learner's own
 *   latest attempt — never a hidden case, a solution or anybody else's work.
 */
@Injectable()
export class AiSubjectsService {
  constructor(
    private readonly courses: CoursesService,
    private readonly lessons: LessonsService,
    private readonly practice: PracticeService,
    private readonly scope: ScopeService,
    private readonly modules: ModuleStateService,
  ) {}

  /** The subject a new conversation names, checked, with a lesson's course filled in. */
  async resolve(user: AuthUser, input: AiConversationCreate): Promise<AiRequestSubject> {
    const { courseId, lessonId, questionId } = input.context ?? {};
    if (input.purpose === 'lab_hint') {
      if (courseId || lessonId || !questionId) throw new AiSubjectNotSupportedError();
      await this.requireHintableLab(user, questionId);
      return { ...NO_SUBJECT, questionId };
    }
    if (questionId) throw new AiSubjectNotSupportedError();
    // The learning agent is a learner's (Phase 9B; ADR-0039), whatever a role grants.
    if (input.purpose === 'agent') await this.requireLearner(user);
    if (!courseId && !lessonId) return NO_SUBJECT;
    if (input.purpose !== 'assistant' && input.purpose !== 'agent') {
      throw new AiSubjectNotSupportedError();
    }
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
      await this.requireHintableLab(user, conversation.questionId);
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

  /**
   * A lab a hint may be about (Phase 7F): the person is a learner, Labs are switched on for them,
   * and the lab is one they may work on now — in the Labs catalogue, with `practice:use`, or opened
   * by a lab lesson they can open (published, reached, its module open). A lab reached only through
   * a withdrawn enrolment, an archived course or a locked module gets no hint, nor does anyone in a
   * staff role, whose labs are previews.
   */
  private async requireHintableLab(user: AuthUser, questionId: string): Promise<void> {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId) throw new ForbiddenError('AI Hint is for learners working on a lab.');
    if (!(await this.modules.isEnabledFor('practice', user))) {
      throw new ForbiddenError('Labs are not switched on for you.');
    }
    const reached = await this.practice.requireReachableLab(questionId, user);
    if (reached === 'catalogue' && hasPermission(user, 'practice:use')) return;
    await this.lessons.requireOpenLabLesson(questionId, user);
  }

  /** Someone with a learner's profile: staff are refused the agent, whatever their role grants. */
  private async requireLearner(user: AuthUser): Promise<void> {
    if (!(await this.scope.personFor(user.id)).studentId) {
      throw new ForbiddenError('The learning agent is for learners.');
    }
  }
}
