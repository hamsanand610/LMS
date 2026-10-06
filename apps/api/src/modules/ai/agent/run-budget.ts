import type { AiAgentToolName } from '@lms/shared';
import type { AgentLimits } from './agent-limits.js';

/** Which limit stopped a run: one of the run's own, or the person's allowance or the budget. */
export type AgentLimitReason =
  | 'steps'
  | 'model_calls'
  | 'tool_calls'
  | 'knowledge_searches'
  | 'follow_up_rounds'
  | 'run_tokens'
  | 'run_time'
  | 'quota_requests'
  | 'quota_tokens'
  | 'quota_budget';

/** A limit was reached: the run stops there, makes no further call, and ends `limit_reached`. */
export class AgentLimitError extends Error {
  constructor(readonly reason: AgentLimitReason) {
    super(`The learning agent's run reached a limit (${reason})`);
    this.name = 'AgentLimitError';
  }
}

/**
 * One run's counters (Roadmap Phase 9B; ADR-0039). Every model call, tool call and follow-up round
 * is counted here before it is made, and refused — by throwing `AgentLimitError` — when it would go
 * past its limit; a call that then fails, times out or is cancelled still counts. Nothing is counted
 * when a check fails, so the counters only ever say what was really begun.
 */
export class RunBudget {
  steps = 0;
  modelCalls = 0;
  toolCalls = 0;
  searches = 0;
  followUps = 0;
  /** Tokens of the run's model calls so far, in and out, and their estimated cost. */
  tokens = 0;
  costMicros = 0;
  private readonly startedAt: number;

  constructor(
    readonly limits: AgentLimits,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.startedAt = now();
  }

  /** A model call is about to be made: a step, and a call to a provider. */
  beginModelCall(): void {
    this.assertStep();
    this.assertModelCall();
    this.steps += 1;
    this.modelCalls += 1;
  }

  /** A stand-in is about to be tried for the same call (ADR-0038): another call to a provider. */
  beginStandIn(): void {
    this.assertModelCall();
    this.modelCalls += 1;
  }

  /** A tool call is about to be made: a step, a tool call and, for a search, a search. */
  beginToolCall(tool: AiAgentToolName): void {
    this.assertStep();
    if (this.toolCalls + 1 > this.limits.toolCalls) throw new AgentLimitError('tool_calls');
    const search = tool === 'knowledge_search';
    if (search && this.searches + 1 > this.limits.knowledgeSearches) {
      throw new AgentLimitError('knowledge_searches');
    }
    this.steps += 1;
    this.toolCalls += 1;
    if (search) this.searches += 1;
  }

  /** The model's one follow-up round (the replan) is about to be asked for. */
  beginFollowUp(): void {
    if (this.followUps + 1 > this.limits.followUpRounds) {
      throw new AgentLimitError('follow_up_rounds');
    }
    this.followUps += 1;
  }

  /** Refuses a call that could take the run past its token budget: what it sends, and may write. */
  reserve(tokens: number): void {
    if (this.tokens + tokens > this.limits.runTokens) throw new AgentLimitError('run_tokens');
  }

  /** A call's tokens and cost, once it has been made. */
  spend(tokens: number, costMicros: number): void {
    this.tokens += tokens;
    this.costMicros += costMicros;
  }

  /** Model calls the run may still make. */
  modelCallsLeft(): number {
    return Math.max(0, this.limits.modelCalls - this.modelCalls);
  }

  /** Steps the run may still take. */
  stepsLeft(): number {
    return Math.max(0, this.limits.steps - this.steps);
  }

  /** Milliseconds left before the run's deadline. */
  remainingMs(): number {
    return Math.max(0, this.limits.runMs - (this.now() - this.startedAt));
  }

  private assertStep(): void {
    if (this.steps + 1 > this.limits.steps) throw new AgentLimitError('steps');
  }

  private assertModelCall(): void {
    if (this.modelCalls + 1 > this.limits.modelCalls) throw new AgentLimitError('model_calls');
  }
}
