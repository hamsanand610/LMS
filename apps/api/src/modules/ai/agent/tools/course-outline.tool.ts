import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../../../../core/http/errors.js';
import { CoursesService } from '../../../courses/index.js';
import { courseMaterial } from '../../context/material.js';
import { AGENT_LIMITS } from '../agent-limits.js';
import { agentCredentialsIn, boundText } from '../protected-content.js';
import {
  type AgentTool,
  type AgentToolContext,
  AgentToolError,
  untilAborted,
} from './agent-tool.js';

/** No arguments: the course is the run's pinned one, never one a model names. */
const courseOutlineInputSchema = z.object({}).strict();

const courseOutlineOutputSchema = z
  .object({
    courseId: z.uuid(),
    title: z.string(),
    /**
     * The outline as text, at most `AGENT_LIMITS.outlineCharacters`: the course's description, its
     * modules and their lessons' titles — empty when withheld.
     */
    text: z.string(),
    truncated: z.boolean(),
    /** Its words held a credential, so none of them is given. */
    withheld: z.boolean(),
  })
  .strict();
export type CourseOutline = z.infer<typeof courseOutlineOutputSchema>;

/**
 * `course_outline` (ADR-0044): the outline of the course the run is pinned to, when no lesson is
 * open — what "What does this course cover?" needs, and the Phase 7E assistant already read for a
 * course. Read through `CoursesService.aiContextFor`, the course page's own rule checked now for this
 * learner: `courses:read` and the Courses module, the institute's own published course, one
 * published to them. Titles and the description only: no lesson's text, resource, lab or question,
 * so never a hidden test, a solution or a staff note. Words holding a credential are withheld whole;
 * the rest is cut to 4,000 characters.
 */
@Injectable()
export class CourseOutlineTool implements AgentTool<
  z.infer<typeof courseOutlineInputSchema>,
  CourseOutline
> {
  readonly name = 'course_outline' as const;
  readonly description =
    'Reads the outline of the course the learner has open: its modules and lessons.';
  readonly argumentsHint = '{}';
  readonly input = courseOutlineInputSchema;
  readonly output = courseOutlineOutputSchema;
  readonly dataClass = 'course' as const;
  readonly permissions = ['courses:read'] as const;
  readonly modules = ['courses'] as const;
  readonly availableWith = [] as const;
  readonly timeoutMs = AGENT_LIMITS.contentToolMs;
  readonly maxOutputCharacters = AGENT_LIMITS.outlineCharacters;
  readonly availableInTimedTest = false as const;
  readonly mutates = false as const;

  constructor(private readonly courses: CoursesService) {}

  characters(output: CourseOutline): number {
    return output.text.length;
  }

  async run(
    context: AgentToolContext,
    _input: z.infer<typeof courseOutlineInputSchema>,
    signal: AbortSignal,
  ): Promise<CourseOutline> {
    // A lesson open is the lesson's to explain; a lab's the lab's. The outline is for a course page.
    if (!context.courseId || context.lessonId || context.questionId) {
      throw new AgentToolError('unavailable', 'no_course');
    }
    let course;
    try {
      course = await untilAborted(
        this.courses.aiContextFor(context.courseId, context.user),
        signal,
      );
    } catch (error) {
      if (error instanceof AppError && (error.status === 403 || error.status === 404)) {
        throw new AgentToolError('forbidden', 'course_not_open');
      }
      throw error;
    }
    const outline = courseMaterial(course).text;
    if (agentCredentialsIn(outline).length > 0) {
      // Nothing of it goes anywhere: not its words, nor its title.
      return { courseId: course.courseId, title: '', text: '', truncated: false, withheld: true };
    }
    const text = boundText(outline, AGENT_LIMITS.outlineCharacters);
    return {
      courseId: course.courseId,
      title: course.title,
      text: text.text,
      truncated: text.truncated,
      withheld: false,
    };
  }
}
