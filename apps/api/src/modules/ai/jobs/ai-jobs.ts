/**
 * SI Academy AI's background jobs (Phase 7D), on the platform's queue (pg-boss, ADR-0006). They run
 * where the platform's other jobs run (`WORKER_MODE`: embedded, separate, or inline when none). A
 * payload carries ids and nothing else — never a question, an answer, a key or a person's details —
 * and every job takes its work by a claim in the database, so a job queued twice, retried, or run
 * by two workers at once does its work once. The queue's singleton keys only spare duplicate runs;
 * they are never what makes a job safe.
 */
export const AI_JOBS = {
  /** A conversation's title, written once by the model after its first answers. */
  title: 'ai.title',
  /** A conversation's notes on its older turns, brought up to date every few turns. */
  summarize: 'ai.summarize',
  /** A complete answer kept in the answer cache. */
  cacheWrite: 'ai.cache.write',
  /** Each closed day's usage settled against the ledger, every hour. */
  usageRollup: 'ai.usage.rollup',
  /** The month's estimated spend against the budget, every quarter of an hour. */
  budgetAlert: 'ai.budget.alert',
  /** What the retention settings say has gone, every night. */
  retentionSweep: 'ai.retention.sweep',
} as const;

export interface AiConversationJob {
  conversationId: string;
}

export interface AiCacheWriteJob {
  messageId: string;
  /** The widest scope the answer was asked for; the job keeps it narrower when it must. */
  scope: 'shared' | 'user';
}

/** How long a claimed title or summary is held before another job may take it over. */
export const AI_JOB_LEASE_MS = 10 * 60_000;
