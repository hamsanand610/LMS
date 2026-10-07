import type { AiAgentToolName } from '@lms/shared';
import type { z } from 'zod';
import type { AuthUser } from '../../../../core/auth/auth-user.js';

/**
 * What a tool runs with: the run's pinned context (Roadmap Phase 9B; ADR-0039), resolved on the
 * server when the run began and frozen. A model never supplies any of it — no learner, institute,
 * course or lesson — and a tool reads nothing outside it.
 */
export interface AgentToolContext {
  /** The learner, as the registry has just checked them: their identity and current permissions. */
  readonly user: AuthUser;
  readonly studentId: string;
  readonly conversationId: string;
  /** The conversation's course and lesson, checked for the learner when the run began; or none. */
  readonly courseId: string | null;
  readonly lessonId: string | null;
  /**
   * The lab the conversation is about — named by it, or opened by its lab lesson — checked for the
   * learner when the run began (Phase 9C; ADR-0040); or none.
   */
  readonly questionId: string | null;
}

/** How a tool call did not succeed, in the registry's words. */
export type AgentToolFailure =
  /** The model named a tool that is not on the allow-list. */
  | 'unknown_tool'
  /** The arguments were not exactly the tool's own (an extra field, an identity, a scope). */
  | 'invalid_arguments'
  /** The same call again, with the same arguments: a loop, not run twice. */
  | 'repeated_call'
  /** The learner may not have this now: permission, module, flag, timed test or reach. */
  | 'forbidden'
  /** Not available to this run — switched off, not set up, or its data not approved. */
  | 'unavailable'
  /** What it was asked holds a credential, which is never sent anywhere. */
  | 'restricted'
  /** The learner's allowance or the institute's budget is used. */
  | 'quota'
  | 'timeout'
  | 'cancelled'
  | 'failed'
  /** What it returned was not its declared output, or more than it may return. */
  | 'invalid_output';

/** A tool's own refusal or failure, with a code for the records (never shown as it is). */
export class AgentToolError extends Error {
  constructor(
    readonly failure: Exclude<
      AgentToolFailure,
      'unknown_tool' | 'invalid_arguments' | 'repeated_call' | 'invalid_output'
    >,
    readonly code: string,
  ) {
    super(`Agent tool ${failure}: ${code}`);
    this.name = 'AgentToolError';
  }
}

/**
 * An agent tool's contract (ADR-0039). A tool is read-only, on the allow-list, and declares
 * everything the registry enforces before and after it runs: its input and output schemas (strict),
 * the most sensitive data class it returns, the permissions and modules the learner needs, the
 * flags that switch it on, its deadline, the most it may return, that it is never available during a
 * timed test, and that it changes nothing.
 */
export interface AgentTool<I extends object = object, O extends object = object> {
  readonly name: AiAgentToolName;
  /** What it does, as the model is told. */
  readonly description: string;
  /** Its arguments, as the model is shown them. */
  readonly argumentsHint: string;
  readonly input: z.ZodType<I>;
  readonly output: z.ZodType<O>;
  /**
   * The most sensitive data class it can return: it runs only while the provider is approved for
   * it. `personal` — the learner's own records (Phase 9C; ADR-0040) — goes to no stand-in that is
   * not approved for it (ADR-0038).
   */
  readonly dataClass: 'public' | 'course' | 'personal';
  /** Permissions the learner must hold now, besides `ai:agent`. */
  readonly permissions: readonly string[];
  /** Modules that must be on for the learner now, besides `ai`. */
  readonly modules: readonly string[];
  /** Flags that switch the tool on: while one is off, it is unavailable (not refused). */
  readonly availableWith: readonly string[];
  readonly timeoutMs: number;
  /** Characters of content it may return, at most. */
  readonly maxOutputCharacters: number;
  readonly availableInTimedTest: false;
  readonly mutates: false;
  /** Characters of content in an output, as `maxOutputCharacters` counts them. */
  characters(output: O): number;
  run(context: AgentToolContext, input: I, signal: AbortSignal): Promise<O>;
}

/**
 * The promise's result, or the signal's reason the moment it aborts. For work that takes no signal
 * itself (a read through a service): its result is then dropped, and nothing waits for it.
 */
export function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason as Error);
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(signal.reason as Error);
    signal.addEventListener('abort', stop, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener('abort', stop);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', stop);
        reject(error as Error);
      },
    );
  });
}
