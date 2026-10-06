import { describe, expect, it } from 'vitest';
import { AGENT_LIMITS } from './agent-limits.js';
import { AgentLimitError, RunBudget } from './run-budget.js';

/** The reason a call stopped the run with, or null when it went through. */
function refusal(call: () => void): string | null {
  try {
    call();
    return null;
  } catch (error) {
    if (error instanceof AgentLimitError) return error.reason;
    throw error;
  }
}

describe('the learning agent’s hard limits (Phase 9B; ADR-0039)', () => {
  it('are the ones the client set', () => {
    expect(AGENT_LIMITS).toMatchObject({
      steps: 8,
      modelCalls: 4,
      toolCalls: 6,
      knowledgeSearches: 3,
      followUpRounds: 1,
      runMs: 120_000,
      modelCallMs: 60_000,
      knowledgeSearchMs: 10_000,
      contentToolMs: 5_000,
      planOutputTokens: 256,
      answerOutputTokens: 1_024,
      evidenceCharacters: 12_000,
      observationCharacters: 8_000,
      historyMessages: 10,
      historyCharacters: 16_000,
      runTokens: 24_000,
      activeRunsPerLearner: 1,
      concurrentRuns: 8,
      searchTopK: 6,
      lessonCharacters: 6_000,
    });
  });

  it('refuses a fifth model call, a stand-in included', () => {
    const budget = new RunBudget(AGENT_LIMITS);
    budget.beginModelCall();
    budget.beginStandIn();
    budget.beginModelCall();
    budget.beginModelCall();
    expect(refusal(() => budget.beginModelCall())).toBe('model_calls');
    expect(refusal(() => budget.beginStandIn())).toBe('model_calls');
    expect(budget.modelCalls).toBe(4);
    expect(budget.modelCallsLeft()).toBe(0);
  });

  it('refuses a seventh tool call, and a fourth search before that', () => {
    const budget = new RunBudget({ ...AGENT_LIMITS, steps: 100 });
    for (let i = 0; i < 3; i += 1) budget.beginToolCall('knowledge_search');
    expect(refusal(() => budget.beginToolCall('knowledge_search'))).toBe('knowledge_searches');
    expect(budget.searches).toBe(3);
    for (let i = 0; i < 3; i += 1) budget.beginToolCall('lesson_content');
    expect(budget.toolCalls).toBe(6);
    expect(refusal(() => budget.beginToolCall('lesson_content'))).toBe('tool_calls');
    expect(budget.toolCalls).toBe(6);
  });

  it('refuses a ninth step, counting model and tool calls together', () => {
    const budget = new RunBudget(AGENT_LIMITS);
    for (let i = 0; i < 4; i += 1) budget.beginModelCall();
    for (let i = 0; i < 4; i += 1) budget.beginToolCall('lesson_content');
    expect(budget.steps).toBe(8);
    expect(budget.stepsLeft()).toBe(0);
    expect(refusal(() => budget.beginToolCall('lesson_content'))).toBe('steps');
    expect(refusal(() => new RunBudget({ ...AGENT_LIMITS, steps: 0 }).beginModelCall())).toBe(
      'steps',
    );
  });

  it('allows one follow-up round', () => {
    const budget = new RunBudget(AGENT_LIMITS);
    budget.beginFollowUp();
    expect(refusal(() => budget.beginFollowUp())).toBe('follow_up_rounds');
  });

  it('refuses a call that could take the run past its 24,000 tokens', () => {
    const budget = new RunBudget(AGENT_LIMITS);
    budget.reserve(24_000);
    budget.spend(20_000, 5);
    expect(refusal(() => budget.reserve(4_000))).toBeNull();
    expect(refusal(() => budget.reserve(4_001))).toBe('run_tokens');
    expect(budget).toMatchObject({ tokens: 20_000, costMicros: 5 });
  });

  it('counts nothing a check refused', () => {
    const budget = new RunBudget({ ...AGENT_LIMITS, toolCalls: 0 });
    expect(refusal(() => budget.beginToolCall('knowledge_search'))).toBe('tool_calls');
    expect(budget).toMatchObject({ steps: 0, toolCalls: 0, searches: 0 });
  });

  it('tells how long is left before the run’s deadline', () => {
    let now = 1_000;
    const budget = new RunBudget(AGENT_LIMITS, () => now);
    expect(budget.remainingMs()).toBe(120_000);
    now += 119_000;
    expect(budget.remainingMs()).toBe(1_000);
    now += 5_000;
    expect(budget.remainingMs()).toBe(0);
  });
});
