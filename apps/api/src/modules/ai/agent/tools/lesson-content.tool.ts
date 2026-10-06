import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../../../../core/http/errors.js';
import { LessonsService } from '../../../courses/index.js';
import { AGENT_LIMITS } from '../agent-limits.js';
import { agentCredentialsIn, boundText } from '../protected-content.js';
import {
  type AgentTool,
  type AgentToolContext,
  AgentToolError,
  untilAborted,
} from './agent-tool.js';

/** No arguments: the lesson is the run's pinned one, never one a model names. */
const lessonContentInputSchema = z.object({}).strict();

const lessonContentOutputSchema = z
  .object({
    lessonId: z.uuid(),
    courseId: z.uuid(),
    title: z.string(),
    courseTitle: z.string(),
    moduleTitle: z.string(),
    topic: z.string(),
    /** The lesson's own words, at most `AGENT_LIMITS.lessonCharacters`; empty when withheld. */
    text: z.string(),
    truncated: z.boolean(),
    /** Its text held a credential, so none of it is given. */
    withheld: z.boolean(),
  })
  .strict();
export type LessonContent = z.infer<typeof lessonContentOutputSchema>;

/**
 * `lesson_content` (Roadmap Phase 9B; ADR-0039): the text of the lesson the run is pinned to, read
 * through `LessonsService.aiContextFor` — the lesson player's own rule, checked now for this learner:
 * `courses:read` and the Courses module, the institute's own published course, an enrolment that
 * stands, and a module unlocked for them. The lesson's own words only: no resource, no lab or
 * question behind it, so never a hidden test, a reference solution or a staff note. Text holding a
 * credential is withheld whole; the rest is cut to 6,000 characters.
 */
@Injectable()
export class LessonContentTool implements AgentTool<
  z.infer<typeof lessonContentInputSchema>,
  LessonContent
> {
  readonly name = 'lesson_content' as const;
  readonly description = 'Reads the text of the lesson the learner has open.';
  readonly argumentsHint = '{}';
  readonly input = lessonContentInputSchema;
  readonly output = lessonContentOutputSchema;
  readonly dataClass = 'course' as const;
  readonly permissions = ['courses:read'] as const;
  readonly modules = ['courses'] as const;
  readonly availableWith = [] as const;
  readonly timeoutMs = AGENT_LIMITS.contentToolMs;
  readonly maxOutputCharacters = AGENT_LIMITS.lessonCharacters;
  readonly availableInTimedTest = false as const;
  readonly mutates = false as const;

  constructor(private readonly lessons: LessonsService) {}

  characters(output: LessonContent): number {
    return output.text.length;
  }

  async run(
    context: AgentToolContext,
    _input: z.infer<typeof lessonContentInputSchema>,
    signal: AbortSignal,
  ): Promise<LessonContent> {
    if (!context.lessonId) throw new AgentToolError('unavailable', 'no_lesson');
    let lesson;
    try {
      lesson = await untilAborted(
        this.lessons.aiContextFor(context.lessonId, context.user),
        signal,
      );
    } catch (error) {
      if (error instanceof AppError && (error.status === 403 || error.status === 404)) {
        throw new AgentToolError('forbidden', 'lesson_not_open');
      }
      throw error;
    }
    // The pinned lesson of the pinned course, and nothing else.
    if (context.courseId !== null && lesson.courseId !== context.courseId) {
      throw new AgentToolError('forbidden', 'lesson_not_open');
    }
    const withheld =
      agentCredentialsIn(
        [lesson.courseTitle, lesson.moduleTitle, lesson.title, lesson.topic, lesson.text].join(
          '\n',
        ),
      ).length > 0;
    if (withheld) {
      // Nothing of it goes anywhere: not its words, nor its titles.
      return {
        lessonId: lesson.lessonId,
        courseId: lesson.courseId,
        title: '',
        courseTitle: '',
        moduleTitle: '',
        topic: '',
        text: '',
        truncated: false,
        withheld,
      };
    }
    const text = boundText(lesson.text.trim(), AGENT_LIMITS.lessonCharacters);
    return {
      lessonId: lesson.lessonId,
      courseId: lesson.courseId,
      title: lesson.title,
      courseTitle: lesson.courseTitle,
      moduleTitle: lesson.moduleTitle,
      topic: lesson.topic,
      text: text.text,
      truncated: text.truncated,
      withheld,
    };
  }
}
