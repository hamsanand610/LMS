import { z } from 'zod';
import { aiStreamEventSchemas } from './ai.js';
import { knowledgeCitationSchema } from './knowledge.js';

/**
 * The SI Academy learning agent (Roadmap Phase 9; ADR-0039, ADR-0040): the contracts of its runs.
 *
 * A run is one turn of an `agent` conversation. The server takes it through a bounded sequence —
 * the policy, the learner's pinned context, a capability chosen for the message, read-only tools
 * (the lesson, the knowledge base, the learner's own learning state and lab attempt), a draft, its
 * verification — and only then gives the answer. Every shape a browser receives is strict: none can
 * carry a prompt, a tool's arguments, a model's reasoning, a provider or a key.
 */

/**
 * What the agent does: explain the lesson being studied, or clear a doubt about it (Phase 9B); say
 * where the learner stands in their course — progress, the next open lesson, what is due — and
 * explain their own attempt at a lab that did not pass (Phase 9C, ADR-0040).
 */
export const AI_AGENT_CAPABILITIES = [
  'explain_lesson',
  'clarify_doubt',
  'learning_state',
  'explain_lab_attempt',
] as const;
export type AiAgentCapability = (typeof AI_AGENT_CAPABILITIES)[number];

/** Where a learner's message may be routed: one of the capabilities, or none. */
export const AI_AGENT_ROUTES = [...AI_AGENT_CAPABILITIES, 'unsupported'] as const;
export type AiAgentRoute = (typeof AI_AGENT_ROUTES)[number];

/**
 * The agent's tools: an allow-list of five, all read-only (ADR-0039, ADR-0040, ADR-0044). Nothing
 * else can be called. `learning_state` and `lab_attempt` read the learner's own records: personal
 * data. `course_outline` reads the open course's outline, as its page shows it: course material.
 */
export const AI_AGENT_TOOLS = [
  'knowledge_search',
  'lesson_content',
  'course_outline',
  'learning_state',
  'lab_attempt',
] as const;
export type AiAgentToolName = (typeof AI_AGENT_TOOLS)[number];

/** What a run is doing, as the learner may be told: high-level states, never their content. */
export const AI_AGENT_STEPS = [
  'routing',
  'reading_lesson',
  'reading_course',
  'reading_progress',
  'reading_lab_attempt',
  'searching_knowledge',
  'planning',
  'drafting',
  'verifying',
] as const;
export type AiAgentStep = (typeof AI_AGENT_STEPS)[number];

/**
 * How a run ended: `answered` (verified, every sentence citing its sources); `insufficient_evidence`
 * (nothing the learner may draw on answers it); `not_grounded` (no draft passed verification);
 * `limit_reached` (a hard limit of the run, or the learner's allowance, stopped it); `refused` (not a
 * request the agent takes, or no longer one the learner may make); `failed`; `cancelled`.
 */
export const AI_AGENT_RUN_STATUSES = [
  'answered',
  'insufficient_evidence',
  'not_grounded',
  'limit_reached',
  'refused',
  'failed',
  'cancelled',
] as const;
export type AiAgentRunStatus = (typeof AI_AGENT_RUN_STATUSES)[number];

/**
 * What the learner is told besides, or instead of, an answer. `context_unavailable`: the learner's
 * own progress or attempt cannot be used for this answer (not approved for the AI provider, or no
 * lab open); `needs_attempt`: an attempt is explained only after one that did not pass (ADR-0031).
 */
export const AI_AGENT_NOTICES = [
  'insufficient_evidence',
  'not_grounded',
  'conflicting_evidence',
  'limit_reached',
  'unsupported',
  'refused',
  'context_unavailable',
  'needs_attempt',
] as const;
export type AiAgentNoticeCode = (typeof AI_AGENT_NOTICES)[number];

/**
 * The most passages one run may cite: the lesson's or the course's, the knowledge base's and the
 * learner's together.
 */
export const AI_AGENT_CITATIONS_MAX = 12;

// ───────────────────────── requests ─────────────────────────

/** A learner's message to the agent. Strict: nothing else is accepted — no model, tool or context. */
export const aiAgentRunRequestSchema = z
  .object({
    content: z.string().trim().min(1, 'Write a question').max(4000),
  })
  .strict();
export type AiAgentRunRequest = z.infer<typeof aiAgentRunRequestSchema>;

/** `stream=false` asks for one JSON result instead of server-sent events, which are the default. */
export const aiAgentRunQuerySchema = z
  .object({
    stream: z.enum(['true', 'false']).default('true'),
  })
  .strict();
export type AiAgentRunQuery = z.infer<typeof aiAgentRunQuerySchema>;

// ───────────────────────── results ─────────────────────────

const citationId = z.string().regex(/^S[1-9][0-9]?$/);

/** A part of the lesson the run read, cited as a knowledge passage is (`S1`, `S2`, …). */
export const aiAgentLessonCitationSchema = z
  .object({
    kind: z.literal('lesson'),
    id: citationId,
    lessonId: z.uuid(),
    courseId: z.uuid(),
    /** The lesson's title. */
    title: z.string(),
    /** The module the lesson is in. */
    heading: z.string(),
    /** Which part of the lesson's text, from 0. */
    position: z.number().int().min(0),
  })
  .strict();

/**
 * A part of the open course's outline the run read (ADR-0044): its description and its modules
 * with their lessons' titles, as the course page shows them.
 */
export const aiAgentCourseCitationSchema = z
  .object({
    kind: z.literal('course'),
    id: citationId,
    courseId: z.uuid(),
    /** The course's title. */
    title: z.string(),
  })
  .strict();

/** A knowledge-base passage the run retrieved, with its provenance as retrieval gave it (8D). */
export const aiAgentKnowledgeCitationSchema = knowledgeCitationSchema
  .extend({ kind: z.literal('knowledge') })
  .strict();

/** The parts of the learner's learning state a run may cite (Phase 9C). */
export const AI_AGENT_STATE_PARTS = ['progress', 'lessons', 'due', 'courses'] as const;
export type AiAgentStatePart = (typeof AI_AGENT_STATE_PARTS)[number];

/**
 * A part of the learner's own learning state, read live for the run (Phase 9C; ADR-0040): their
 * progress in the course, its lessons as open or locked to them, what is due, or their courses.
 */
export const aiAgentLearningStateCitationSchema = z
  .object({
    kind: z.literal('learning_state'),
    id: citationId,
    part: z.enum(AI_AGENT_STATE_PARTS),
    /** The course the facts are about; null for the learner's courses together. */
    courseId: z.uuid().nullable(),
    /** What the passage is, as the learner reads it ("Your progress: Core Java"). */
    title: z.string(),
  })
  .strict();

/**
 * The lab the learner has open, or their own latest attempt at it, read for the run (Phase 9C;
 * ADR-0040): the problem as the workspace shows it, or the attempt's result and code.
 */
export const aiAgentLabAttemptCitationSchema = z
  .object({
    kind: z.literal('lab_attempt'),
    id: citationId,
    part: z.enum(['problem', 'attempt']),
    questionId: z.uuid(),
    /** The lab's title. */
    title: z.string(),
  })
  .strict();

export const aiAgentCitationSchema = z.discriminatedUnion('kind', [
  aiAgentLessonCitationSchema,
  aiAgentCourseCitationSchema,
  aiAgentKnowledgeCitationSchema,
  aiAgentLearningStateCitationSchema,
  aiAgentLabAttemptCitationSchema,
]);
export type AiAgentCitation = z.infer<typeof aiAgentCitationSchema>;

export const aiAgentNoticeSchema = z
  .object({ code: z.enum(AI_AGENT_NOTICES), message: z.string() })
  .strict();
export type AiAgentNotice = z.infer<typeof aiAgentNoticeSchema>;

const aiAgentErrorSchema = z.object({ code: z.string(), message: z.string() }).strict();

/**
 * A run's result, for `stream=false`: how it ended, the capability it used, the verified answer (or
 * the platform's own words when there is none), its citations, what to tell the learner and the
 * usage. The same for every ending once the turn has begun.
 */
export const aiAgentRunSchema = z
  .object({
    conversationId: z.uuid(),
    userMessageId: z.uuid(),
    assistantMessageId: z.uuid(),
    status: z.enum(AI_AGENT_RUN_STATUSES),
    capability: z.enum(AI_AGENT_CAPABILITIES).nullable(),
    answer: z.string(),
    citations: z.array(aiAgentCitationSchema).max(AI_AGENT_CITATIONS_MAX),
    notice: aiAgentNoticeSchema.nullable(),
    error: aiAgentErrorSchema.nullable(),
    usage: aiStreamEventSchemas.usage.nullable(),
  })
  .strict();
export type AiAgentRun = z.infer<typeof aiAgentRunSchema>;

// ───────────────────────── the run stream ─────────────────────────

/**
 * A run's events (server-sent events over the POST, as a conversation's are; ADR-0030), in order:
 * `meta` once the turn has begun; `step` as the run works; then — only once the whole answer is
 * written and verified — `delta`s and `sources`; `notice` or `error` when there is something to say;
 * `usage` once a model was called; `done` last, always. `ping` keeps the line open.
 */
export const AI_AGENT_STREAM_EVENTS = [
  'meta',
  'step',
  'delta',
  'sources',
  'notice',
  'usage',
  'error',
  'done',
  'ping',
] as const;
export type AiAgentStreamEventName = (typeof AI_AGENT_STREAM_EVENTS)[number];

export const aiAgentStreamEventSchemas = {
  meta: z
    .object({ conversationId: z.uuid(), userMessageId: z.uuid(), assistantMessageId: z.uuid() })
    .strict(),
  step: z.object({ step: z.enum(AI_AGENT_STEPS) }).strict(),
  delta: z.object({ text: z.string() }).strict(),
  sources: z
    .object({ citations: z.array(aiAgentCitationSchema).max(AI_AGENT_CITATIONS_MAX) })
    .strict(),
  notice: aiAgentNoticeSchema,
  usage: aiStreamEventSchemas.usage,
  error: aiAgentErrorSchema,
  done: z.object({ messageId: z.uuid(), status: z.enum(AI_AGENT_RUN_STATUSES) }).strict(),
  ping: z.object({}).strict(),
} satisfies Record<AiAgentStreamEventName, z.ZodType>;

export type AiAgentStreamEvent = {
  [K in AiAgentStreamEventName]: {
    event: K;
    data: z.infer<(typeof aiAgentStreamEventSchemas)[K]>;
  };
}[AiAgentStreamEventName];
