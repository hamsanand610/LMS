/**
 * The learning agent's hard limits (Roadmap Phase 9B; ADR-0039, ADR-0040). Each is enforced by the
 * server on every run — counted in `RunBudget`, or a deadline on the call it bounds — never asked of
 * the model. Phase 9C's tools added their own deadlines and sizes; the run's limits stayed as 9B set.
 */
export const AGENT_LIMITS = {
  /** Model calls and tool calls of a run together. */
  steps: 8,
  /** Calls to a provider, a stand-in's included. */
  modelCalls: 4,
  toolCalls: 6,
  knowledgeSearches: 3,
  /** Rounds in which the model may ask for one more tool call (the replan). */
  followUpRounds: 1,
  /** The whole run, from the request to the answer. */
  runMs: 120_000,
  /** One model call, the router's own deadline (AI_TIMEOUT_MS) besides. */
  modelCallMs: 60_000,
  knowledgeSearchMs: 10_000,
  /** The lesson's own content. */
  contentToolMs: 5_000,
  /** The learner's learning state (Phase 9C). */
  stateToolMs: 5_000,
  /** The learner's attempt at the open lab (Phase 9C). */
  labToolMs: 5_000,
  /** What routing and the follow-up may write: a few lines of JSON. */
  planOutputTokens: 256,
  /** The answer, at most (AI_MAX_OUTPUT_TOKENS may lower it). */
  answerOutputTokens: 1_024,
  /** Characters of evidence — the lesson's and the knowledge base's passages together. */
  evidenceCharacters: 12_000,
  /** Characters of anything else the model is shown of what the tools found. */
  observationCharacters: 8_000,
  /** The conversation's own earlier messages a run reads, most recent first. */
  historyMessages: 10,
  historyCharacters: 16_000,
  /** Tokens of a run's model calls, in and out, estimated before each call and counted after. */
  runTokens: 24_000,
  /** Runs at once per learner (and the database's one answer at a time per person besides). */
  activeRunsPerLearner: 1,
  /** Runs at once in this process. */
  concurrentRuns: 8,
  /** Passages one knowledge search returns. */
  searchTopK: 6,
  /** Characters of the lesson's own text a run reads. */
  lessonCharacters: 6_000,
  /** Characters of the learner's learning state a run reads (Phase 9C). */
  stateCharacters: 3_000,
  /** Characters of the open lab and the learner's attempt at it a run reads (Phase 9C). */
  labCharacters: 6_000,
  /** The longest answer kept. */
  answerCharacters: 4_000,
  /** Routing: the first try, and one more after output that was not the JSON asked for. */
  routingAttempts: 2,
  /** Drafts: the first, and one regeneration after a draft that failed verification. */
  draftAttempts: 2,
} as const;

export type AgentLimits = { readonly [K in keyof typeof AGENT_LIMITS]: number };

/** Runs a learner may start in five minutes (the route's own rate limit). */
export const AGENT_RATE_LIMIT = { points: 10, durationSec: 300 } as const;

/**
 * How long after it began a run's turn still `streaming` counts as abandoned — left by a process
 * that stopped — and is closed as failed: the run's deadline, and half a minute more.
 */
export const AGENT_ABANDONED_AFTER_MS = AGENT_LIMITS.runMs + 30_000;
