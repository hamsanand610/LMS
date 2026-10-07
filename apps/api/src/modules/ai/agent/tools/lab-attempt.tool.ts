import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../../../../core/http/errors.js';
import { LessonsService } from '../../../courses/index.js';
import { type AiLabAttempt, type AiLabBrief, PracticeService } from '../../../practice/index.js';
import { AiSubjectsService, HINT_AFTER_FAILED_ATTEMPTS } from '../../context/subjects.service.js';
import { AGENT_LIMITS } from '../agent-limits.js';
import { agentCredentialsIn, boundText } from '../protected-content.js';
import {
  type AgentTool,
  type AgentToolContext,
  AgentToolError,
  untilAborted,
} from './agent-tool.js';

/** No arguments: the lab is the run's pinned one, and the attempt the learner's own — never a model's. */
const labAttemptInputSchema = z.object({}).strict();

const labAttemptOutputSchema = z
  .object({
    questionId: z.uuid(),
    title: z.string(),
    /** Submissions of theirs that were not accepted: at least one, or there is nothing to explain. */
    failedAttempts: z.number().int().min(HINT_AFTER_FAILED_ATTEMPTS),
    /** The lab as the workspace shows it: statement, formats, visible examples. Course material. */
    problem: z.string(),
    /** Their latest failed attempt: its result, the visible examples it missed, their code. Personal. */
    attempt: z.string().min(1),
  })
  .strict();
export type LabAttemptOutput = z.infer<typeof labAttemptOutputSchema>;

/** Characters of each part, within `AGENT_LIMITS.labCharacters` together. */
export const LAB_ATTEMPT_CHARACTERS = {
  statement: 1_200,
  format: 150,
  examples: 2,
  example: 300,
  problem: 3_000,
  labels: 10,
  label: 80,
  code: 2_400,
  attempt: 3_000,
} as const;

/** What the learner is told a verdict means: their workspace's own words. */
const VERDICT_WORDS: Record<string, string> = {
  passed: 'passed',
  failed: 'did not pass',
  wrong_answer: 'wrong answer',
  compile_error: 'did not compile',
  runtime_error: 'stopped with a runtime error',
  timeout: 'ran out of time',
  memory_limit: 'ran out of memory',
  output_limit: 'wrote too much output',
  error: 'could not be checked',
  pending: 'still being checked',
};

/**
 * `lab_attempt` (Roadmap Phase 9C; ADR-0040): the lab the run is pinned to and the learner's own
 * latest attempt at it — what the learner already sees in their workspace, and nothing more. Behind
 * the AI Hint's own rule (`AiSubjectsService.requireHintableLab`, ADR-0031): a learner; Labs on for
 * them; a lab in the catalogue they may practise (`practice:use`), or opened by a lab lesson they can
 * open now; a pinned lab lesson still opening this lab; and at least one attempt that did not pass.
 * Read through `PracticeService.labHintBrief` — the visible examples only, the learner's own runs
 * only, a hidden case's verdict never — so never a hidden test, its label, input or output, the
 * reference solution, the grader's check, a hint, a draft or anybody else's work.
 *
 * It never runs, re-runs or submits anything. Personal data (the learner's own code): the run becomes
 * `personal`. A statement or code holding a credential is withheld. At most 6,000 characters.
 */
@Injectable()
export class LabAttemptTool implements AgentTool<
  z.infer<typeof labAttemptInputSchema>,
  LabAttemptOutput
> {
  readonly name = 'lab_attempt' as const;
  readonly description =
    "Reads the lab the learner has open and their own latest attempt at it: the problem, its visible examples, the attempt's result and their code.";
  readonly argumentsHint = '{}';
  readonly input = labAttemptInputSchema;
  readonly output = labAttemptOutputSchema;
  readonly dataClass = 'personal' as const;
  readonly permissions = [] as const;
  readonly modules = ['practice'] as const;
  readonly availableWith = [] as const;
  readonly timeoutMs = AGENT_LIMITS.labToolMs;
  readonly maxOutputCharacters = AGENT_LIMITS.labCharacters;
  readonly availableInTimedTest = false as const;
  readonly mutates = false as const;

  constructor(
    private readonly subjects: AiSubjectsService,
    private readonly lessons: LessonsService,
    private readonly practice: PracticeService,
  ) {}

  characters(output: LabAttemptOutput): number {
    return output.problem.length + output.attempt.length;
  }

  run(
    context: AgentToolContext,
    _input: z.infer<typeof labAttemptInputSchema>,
    signal: AbortSignal,
  ): Promise<LabAttemptOutput> {
    return untilAborted(this.read(context), signal);
  }

  private async read(context: AgentToolContext): Promise<LabAttemptOutput> {
    const questionId = context.questionId;
    if (!questionId) throw new AgentToolError('unavailable', 'no_lab');
    let brief: AiLabBrief;
    try {
      // The lab lesson the run is pinned to, still open to them and still opening this lab.
      if (context.lessonId) {
        const lesson = await this.lessons.aiContextFor(context.lessonId, context.user);
        if (lesson.labQuestionId !== questionId) {
          throw new AgentToolError('forbidden', 'lab_not_open');
        }
      }
      await this.subjects.requireHintableLab(context.user, questionId);
      brief = await this.practice.labHintBrief(questionId, context.user);
    } catch (error) {
      if (error instanceof AppError && (error.status === 403 || error.status === 404)) {
        throw new AgentToolError('forbidden', 'lab_not_open');
      }
      throw error;
    }
    if (brief.failedAttempts < HINT_AFTER_FAILED_ATTEMPTS || !brief.latestFailed) {
      throw new AgentToolError('unavailable', 'needs_attempt');
    }
    return {
      questionId,
      title: oneLine(brief.title),
      failedAttempts: brief.failedAttempts,
      problem: problemText(brief),
      attempt: attemptText(brief, brief.latestFailed),
    };
  }
}

/** The lab as the workspace shows it, bounded; empty when any of it holds a credential. */
export function problemText(brief: AiLabBrief): string {
  const lines = [
    `Lab: ${oneLine(brief.title)} (${brief.type}).`,
    `Problem: ${boundText(brief.statement.trim(), LAB_ATTEMPT_CHARACTERS.statement).text}`,
  ];
  const format = (label: string, value: string) => {
    if (value.trim()) {
      lines.push(`${label}: ${boundText(value.trim(), LAB_ATTEMPT_CHARACTERS.format).text}`);
    }
  };
  format('Input', brief.inputFormat);
  format('Output', brief.outputFormat);
  format('Constraints', brief.constraints);
  brief.examples.slice(0, LAB_ATTEMPT_CHARACTERS.examples).forEach((example, index) => {
    lines.push(
      `Example ${index + 1}, input:\n${boundText(example.input, LAB_ATTEMPT_CHARACTERS.example).text}\nExpected output:\n${boundText(example.expectedOutput, LAB_ATTEMPT_CHARACTERS.example).text}`,
    );
  });
  const text = boundText(lines.join('\n'), LAB_ATTEMPT_CHARACTERS.problem).text;
  // A credential is never sent anywhere (ADR-0024): the problem is withheld whole.
  return agentCredentialsIn(text).length > 0 ? '' : text;
}

/**
 * The learner's latest failed attempt: its result, the visible examples it missed, their code —
 * bounded — and whether a later attempt of theirs has passed since.
 */
export function attemptText(brief: AiLabBrief, latest: AiLabAttempt): string {
  const verdict = VERDICT_WORDS[latest.verdict] ?? latest.verdict.replace(/_/g, ' ');
  const missed = latest.visible
    .filter((testCase) => testCase.verdict !== 'passed')
    .slice(0, LAB_ATTEMPT_CHARACTERS.labels)
    .map((testCase) => boundText(oneLine(testCase.label), LAB_ATTEMPT_CHARACTERS.label).text)
    .filter((label) => label !== '');
  const checks = latest.total > 0 ? ` It passed ${latest.passed} of ${latest.total} checks.` : '';
  const passedSince =
    brief.latest !== null &&
    brief.latest.runId !== latest.runId &&
    brief.latest.verdict === 'passed';
  const head = [
    `Your latest failed attempt at ${oneLine(brief.title)} (${latest.language}): ${verdict}.${checks}`,
    `You have made ${brief.failedAttempts} ${brief.failedAttempts === 1 ? 'attempt' : 'attempts'} at this lab that did not pass.`,
    missed.length > 0
      ? `The visible examples it did not pass: ${missed.join('; ')}.`
      : 'It did not fail any of the visible examples: what it missed is in the checks you cannot see.',
    ...(passedSince ? ['A later attempt of yours has passed every check since.'] : []),
  ];
  const headText = head.join('\n');
  const code = boundText(latest.code.replace(/\r\n?/g, '\n'), LAB_ATTEMPT_CHARACTERS.code);
  const shown =
    agentCredentialsIn(code.text).length > 0
      ? 'Your code is not shown here: it holds a credential.'
      : `Your code${code.truncated ? ' (its start)' : ''}:\n${code.text}`;
  const text = `${agentCredentialsIn(headText).length > 0 ? head[0]! : headText}\n${shown}`;
  return boundText(text, LAB_ATTEMPT_CHARACTERS.attempt).text;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 120);
}
