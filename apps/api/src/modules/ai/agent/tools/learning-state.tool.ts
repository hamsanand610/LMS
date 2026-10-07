import { Injectable } from '@nestjs/common';
import { AI_AGENT_STATE_PARTS, LEARNER_STATUS_LABELS } from '@lms/shared';
import { z } from 'zod';
import { AppError } from '../../../../core/http/errors.js';
import { TenantService } from '../../../../core/tenant/tenant.service.js';
import { type AiDueAssignments, LearnerAssignmentsService } from '../../../assignments/index.js';
import {
  type CourseLearningState,
  CourseLearningStateService,
  type LearningStateOverview,
} from '../../../courses/index.js';
import { type AiTestWindow, AttemptsService } from '../../../tests/index.js';
import { AGENT_LIMITS } from '../agent-limits.js';
import { agentCredentialsIn } from '../protected-content.js';
import {
  type AgentTool,
  type AgentToolContext,
  AgentToolError,
  untilAborted,
} from './agent-tool.js';

/** The records a "what is due" passage may be read from. */
export const DUE_SECTIONS = ['assignments', 'tests'] as const;
export type DueSection = (typeof DUE_SECTIONS)[number];

/** No arguments: the learner, the institute and the course are the run's pinned ones, never a model's. */
const learningStateInputSchema = z.object({}).strict();

const statePassageSchema = z
  .object({
    part: z.enum(AI_AGENT_STATE_PARTS),
    title: z.string().min(1).max(200),
    /** The course the passage is about; null for the learner's courses together, or what is due. */
    courseId: z.uuid().nullable(),
    /** What a "what is due" passage was read from: each asked again before an answer is given. */
    sections: z.array(z.enum(DUE_SECTIONS)).max(2),
    text: z.string().min(1),
  })
  .strict();
export type StatePassage = z.infer<typeof statePassageSchema>;

const learningStateOutputSchema = z
  .object({ passages: z.array(statePassageSchema).min(1).max(4) })
  .strict();
export type LearningStateOutput = z.infer<typeof learningStateOutputSchema>;

/** Characters each passage may hold: together within `AGENT_LIMITS.stateCharacters`. */
export const STATE_PASSAGE_CHARACTERS = {
  progress: 1_100,
  lessons: 1_100,
  courses: 2_200,
  due: 700,
} as const;

/** What the learning agent may say of a lesson's kind. */
const LESSON_KIND: Record<string, string> = {
  article: 'reading',
  video: 'video',
  lab: 'lab',
  practice: 'practice',
  quiz: 'quiz',
  live: 'live class',
};

/**
 * `learning_state` (Roadmap Phase 9C; ADR-0040): the learner's own learning state, read live for the
 * run — never stored, never inferred. For the pinned course: their progress (the completion their
 * enrolment records, the lessons that count and how many are done), the next lesson open to them by
 * the player's own unlock rule, the course's modules and lessons as open or locked to them; with no
 * course pinned, their courses. Then what is due: their assignments by state and the next few, and
 * their test windows still to sit — each part only while its own permission and module are on.
 *
 * Personal data (ADR-0024): the tool runs only while `personal` is approved for the provider, and its
 * passages make the run `personal`, which no stand-in unapproved for it receives (ADR-0038). Read
 * through the services that own each record, with their own checks (`CourseLearningStateService`,
 * `LearnerAssignmentsService.aiDueSummary`, `AttemptsService.aiOpenWindows`) — never the player's
 * `LessonsService.get`, which records an opening. Nothing of another learner, a mark scheme, a
 * question or a staff note; facts, never a judgement. At most 3,000 characters and 40 lessons.
 */
@Injectable()
export class LearningStateTool implements AgentTool<
  z.infer<typeof learningStateInputSchema>,
  LearningStateOutput
> {
  readonly name = 'learning_state' as const;
  readonly description =
    "Reads the learner's own progress: their course and its lessons, completed or not, open or locked, the next lesson to study, and what is due.";
  readonly argumentsHint = '{}';
  readonly input = learningStateInputSchema;
  readonly output = learningStateOutputSchema;
  readonly dataClass = 'personal' as const;
  readonly permissions = ['courses:read', 'progress:read'] as const;
  readonly modules = ['courses', 'progress'] as const;
  readonly availableWith = [] as const;
  readonly timeoutMs = AGENT_LIMITS.stateToolMs;
  readonly maxOutputCharacters = AGENT_LIMITS.stateCharacters;
  readonly availableInTimedTest = false as const;
  readonly mutates = false as const;

  constructor(
    private readonly state: CourseLearningStateService,
    private readonly assignments: LearnerAssignmentsService,
    private readonly attempts: AttemptsService,
    private readonly tenant: TenantService,
  ) {}

  characters(output: LearningStateOutput): number {
    return output.passages.reduce((sum, passage) => sum + passage.text.length, 0);
  }

  run(
    context: AgentToolContext,
    _input: z.infer<typeof learningStateInputSchema>,
    signal: AbortSignal,
  ): Promise<LearningStateOutput> {
    return untilAborted(this.read(context), signal);
  }

  private async read(context: AgentToolContext): Promise<LearningStateOutput> {
    const zone = (await this.tenant.getOrganization()).timezone;
    const passages: StatePassage[] = [];
    try {
      if (context.courseId) {
        const course = await this.state.courseState(
          context.user,
          context.studentId,
          context.courseId,
        );
        passages.push(progressPassage(course, zone), lessonsPassage(course));
      } else {
        passages.push(
          coursesPassage(await this.state.overview(context.user, context.studentId), zone),
        );
      }
    } catch (error) {
      if (error instanceof AppError && (error.status === 403 || error.status === 404)) {
        throw new AgentToolError('forbidden', 'state_not_open');
      }
      throw error;
    }
    const due = duePassage(
      await optional(() => this.assignments.aiDueSummary(context.user)),
      await optional(() => this.attempts.aiOpenWindows(context.user)),
      zone,
    );
    if (due) passages.push(due);
    // A title holding a credential is never sent anywhere (ADR-0024): that passage is left out.
    const kept = passages.filter(
      (passage) => agentCredentialsIn(`${passage.title}\n${passage.text}`).length === 0,
    );
    if (kept.length === 0) throw new AgentToolError('restricted', 'credential');
    return { passages: kept };
  }
}

/** A part that only some learners may see: none (null) for one their permission or module closes. */
async function optional<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof AppError && error.status === 403) return null;
    throw error;
  }
}

/** The learner's progress in the pinned course, and the next lesson open to them. */
export function progressPassage(state: CourseLearningState, zone: string): StatePassage {
  const counted =
    state.countedLessons === state.lessonCount
      ? `${state.countedCompleted} of ${state.countedLessons} lessons`
      : `${state.countedCompleted} of ${state.countedLessons} required lessons`;
  const lines = [
    `Course: ${state.title}.`,
    state.countedCompleted === 0 && state.progressPct === 0
      ? `You have made no progress in the course ${state.title} yet: you have completed 0 of ${state.countedLessons} lessons.`
      : `Your progress in the course ${state.title}: ${state.progressPct}% complete. You have completed ${counted} in this course.`,
  ];
  if (state.next && !state.locked) {
    lines.push(
      `The next lesson to learn in this course: ${state.next.title}, a ${kind(state.next.type)} lesson in the module ${state.next.module}. It is open to you.`,
    );
  } else if (state.locked) {
    lines.push(
      `The next required lesson, ${state.locked.title}, is in the module ${state.locked.module}, which is locked to you: it opens when you have completed ${state.locked.unlockPercent}% of the module ${state.locked.previousModule}.`,
    );
    if (state.next) {
      lines.push(
        `To open it, the next lesson to learn is ${state.next.title}, in the module ${state.next.module}.`,
      );
    }
  } else {
    lines.push(`Every lesson that counts towards ${state.title} is completed.`);
  }
  lines.push(
    state.lastAccessedAt
      ? `You last opened this course on ${dateOf(state.lastAccessedAt, zone)}.`
      : 'You have not opened this course yet.',
  );
  lines.push(`Modules of ${state.title}:`);
  const modules = state.modules.map((module) =>
    module.open
      ? `- ${module.title}: open, ${module.completed} of ${module.lessons} lessons completed.`
      : `- ${module.title}: locked; it opens when you have completed ${module.unlockPercent ?? 100}% of the module before it.`,
  );
  return {
    part: 'progress',
    title: `Your progress: ${state.title}`,
    courseId: state.courseId,
    sections: [],
    text: fitLines(
      lines,
      modules,
      state.modulesLeftOut,
      'module',
      STATE_PASSAGE_CHARACTERS.progress,
    ),
  };
}

/** The pinned course's lessons around where the learner is, each completed or not, open or locked. */
export function lessonsPassage(state: CourseLearningState): StatePassage {
  const optional = state.countedLessons !== state.lessonCount;
  const lessons = state.lessons.map(
    (lesson) =>
      `- ${lesson.title} (${lesson.module}, ${kind(lesson.type)}${optional && !lesson.mandatory ? ', optional' : ''}): ${STATUS_WORDS[lesson.status]}; ${lesson.open ? 'open' : 'locked'}.`,
  );
  return {
    part: 'lessons',
    title: `Your lessons: ${state.title}`,
    courseId: state.courseId,
    sections: [],
    text: fitLines(
      [`The lessons of ${state.title}, in order, with your status:`],
      lessons,
      state.lessonsLeftOut,
      'lesson',
      STATE_PASSAGE_CHARACTERS.lessons,
    ),
  };
}

/** The learner's courses together, each with its progress and next open lesson. */
export function coursesPassage(overview: LearningStateOverview, zone: string): StatePassage {
  const total = overview.courses.length + overview.coursesLeftOut;
  if (total === 0) {
    return {
      part: 'courses',
      title: 'Your courses',
      courseId: null,
      sections: [],
      text: 'You are not enrolled in any course that is open to you now.',
    };
  }
  const courses = overview.courses.map((course) => {
    const done = `${course.countedCompleted} of ${course.countedLessons} lessons completed`;
    const next = course.next
      ? `next lesson: ${course.next}`
      : course.countedCompleted >= course.countedLessons
        ? 'every lesson that counts is completed'
        : 'no lesson is open to you now';
    const opened = course.lastAccessedAt
      ? `last opened on ${dateOf(course.lastAccessedAt, zone)}`
      : 'not opened yet';
    return `- ${course.title}: ${course.progressPct}% complete; ${done}; ${next}; ${opened}.`;
  });
  return {
    part: 'courses',
    title: 'Your courses',
    courseId: null,
    sections: [],
    text: fitLines(
      [`Your courses (${total}), the most recently opened first:`],
      courses,
      overview.coursesLeftOut,
      'course',
      STATE_PASSAGE_CHARACTERS.courses,
    ),
  };
}

/** What is due: the learner's assignments and their test windows still to sit; null with neither. */
export function duePassage(
  assignments: AiDueAssignments | null,
  tests: readonly AiTestWindow[] | null,
  zone: string,
  now = new Date(),
): StatePassage | null {
  if (!assignments && !tests) return null;
  const lines = [`Today is ${dateOf(now, zone)}.`];
  if (assignments) {
    const counts = assignments.counts;
    const parts = [
      counts.overdue > 0 ? `${counts.overdue} overdue` : null,
      counts.inProgress > 0 ? `${counts.inProgress} in progress` : null,
      counts.notStarted > 0 ? `${counts.notStarted} not started` : null,
      counts.failed > 0 ? `${counts.failed} failed` : null,
      counts.upcoming > 0 ? `${counts.upcoming} upcoming` : null,
      counts.submitted > 0 ? `${counts.submitted} submitted and waiting for review` : null,
      counts.completed > 0 ? `${counts.completed} completed` : null,
    ].filter((part): part is string => part !== null);
    lines.push(
      parts.length > 0
        ? `Your assignments: ${parts.join(', ')}.`
        : 'You have no assignments to do now.',
    );
    for (const item of assignments.next) {
      const status = LEARNER_STATUS_LABELS[item.status].toLowerCase();
      const when =
        item.status === 'upcoming' && item.opensAt
          ? `it opens on ${dateOf(item.opensAt, zone)}`
          : item.dueAt
            ? item.status === 'overdue'
              ? `it was due on ${dateOf(item.dueAt, zone)}`
              : `due on ${dateOf(item.dueAt, zone)}`
            : 'no due date';
      const course = item.courseTitle ? ` (course ${oneLine(item.courseTitle)})` : '';
      lines.push(`- Assignment ${oneLine(item.title)}${course}: ${status}; ${when}.`);
    }
  }
  if (tests) {
    if (tests.length === 0) {
      lines.push('You have no test to sit that is open now or opens in the next two weeks.');
    } else {
      lines.push('Your tests still to sit:');
      for (const test of tests) {
        lines.push(
          test.window === 'live'
            ? `- Test ${oneLine(test.title)}: open now; it closes on ${dateOf(test.closesAt, zone)}.`
            : `- Test ${oneLine(test.title)}: opens on ${dateOf(test.opensAt, zone)} and closes on ${dateOf(test.closesAt, zone)}.`,
        );
      }
    }
  }
  return {
    part: 'due',
    title: 'What is due',
    courseId: null,
    sections: [
      ...(assignments ? ['assignments' as const] : []),
      ...(tests ? ['tests' as const] : []),
    ],
    text: fitLines(lines, [], 0, 'item', STATE_PASSAGE_CHARACTERS.due),
  };
}

const STATUS_WORDS: Record<CourseLearningState['lessons'][number]['status'], string> = {
  completed: 'completed',
  in_progress: 'in progress',
  not_started: 'not started',
};

function kind(type: string): string {
  return LESSON_KIND[type] ?? type;
}

/** A title on one line, at most 80 characters. */
function oneLine(value: string): string {
  const line = value.replace(/\s+/g, ' ').trim();
  return line.length <= 80 ? line : `${line.slice(0, 79).trimEnd()}…`;
}

/** A day as the institute reads it: "7 October 2026". */
function dateOf(date: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: zone,
  }).format(date);
}

/**
 * The opening lines, then the listed items while they fit within `max` characters; those that do
 * not — and `leftOut` more never listed — are counted on a last line instead.
 */
export function fitLines(
  head: readonly string[],
  items: readonly string[],
  leftOut: number,
  noun: string,
  max: number,
): string {
  const lines: string[] = [];
  let size = 0;
  const room = (line: string) => size + line.length + (lines.length > 0 ? 1 : 0) <= max - 60;
  for (const line of head) {
    if (!room(line)) break;
    size += line.length + (lines.length > 0 ? 1 : 0);
    lines.push(line);
  }
  let listed = 0;
  for (const item of items) {
    if (!room(item)) break;
    size += item.length + 1;
    lines.push(item);
    listed += 1;
  }
  const more = items.length - listed + leftOut;
  if (more > 0) lines.push(`(${more} more ${noun}${more === 1 ? ' is' : 's are'} not listed.)`);
  return lines.join('\n');
}
