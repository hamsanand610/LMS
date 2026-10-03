import { z } from 'zod';
import { patchSchemaOf } from './common.js';

/**
 * SI Academy AI — the contracts the API and the web app share (Roadmap Phase 7A; ADR-0024 to
 * ADR-0031).
 *
 * Every shape a browser receives is strict: a field the server did not mean to send — a provider's
 * name, a key, a model's internals — cannot pass through it, because the gateway parses its own
 * answers with these schemas. Nothing here describes retrieval, vectors or agents: those belong to
 * Phases 8 and 9.
 */

/** What an AI conversation is for: one surface each. */
export const AI_PURPOSES = ['assistant', 'workspace', 'lab_hint'] as const;
export type AiPurpose = (typeof AI_PURPOSES)[number];

/** The kinds of model call the gateway makes. The model router picks a model per task (Phase 7B). */
export const AI_TASKS = ['chat', 'hint', 'classify', 'title', 'summarize'] as const;
export type AiTask = (typeof AI_TASKS)[number];

/** Who wrote a stored message. System prompts are never stored as messages. */
export const AI_MESSAGE_ROLES = ['user', 'assistant'] as const;
export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number];

export const AI_MESSAGE_STATUSES = [
  'streaming',
  'complete',
  'failed',
  'cancelled',
  'blocked',
] as const;
export type AiMessageStatus = (typeof AI_MESSAGE_STATUSES)[number];

export const AI_CONVERSATION_STATUSES = ['active', 'archived'] as const;
export type AiConversationStatus = (typeof AI_CONVERSATION_STATUSES)[number];

/**
 * The providers this build can run (ADR-0024): `none` answers nothing; `fake` is the deterministic
 * stand-in for local development and tests; `gemini` is the first cloud provider (Phase 7B). Server
 * configuration only: never sent to a browser.
 */
export const AI_PROVIDER_NAMES = ['none', 'fake', 'gemini'] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

/**
 * How sensitive the data in a call is (ADR-0024): a provider is approved per class. `restricted`
 * never leaves the platform — secrets, hidden tests, reference solutions, other learners' data.
 */
export const AI_DATA_CLASSES = ['public', 'course', 'personal', 'restricted'] as const;
export type AiDataClass = (typeof AI_DATA_CLASSES)[number];

/** The AI surfaces. Each has its own option flag, and none opens anything without `module.ai`. */
export const AI_FEATURES = ['assistant', 'workspace', 'lab_hints', 'semantic_cache'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** The module flag every AI surface needs first (ADR-0031). Off by default. */
export const AI_MODULE_FLAG = 'module.ai';

export const AI_FEATURE_FLAGS: Record<AiFeature, string> = {
  assistant: 'ai.assistant',
  workspace: 'ai.workspace',
  lab_hints: 'ai.lab_hints',
  semantic_cache: 'ai.semantic_cache',
};

/** The surface a conversation's purpose belongs to. */
export const AI_PURPOSE_FEATURE: Record<AiPurpose, AiFeature> = {
  assistant: 'assistant',
  workspace: 'workspace',
  lab_hint: 'lab_hints',
};

/** Whether an AI surface is on for a person: `module.ai` and the surface's own flag, both. */
export function aiFeatureEnabled(flags: Record<string, boolean>, feature: AiFeature): boolean {
  return flags[AI_MODULE_FLAG] === true && flags[AI_FEATURE_FLAGS[feature]] === true;
}

/**
 * Why the AI cannot answer now: the surface is switched off; the person is in a timed test, where
 * no AI help is given; or the gateway cannot answer yet (no provider, or not built — Phase 7A).
 */
export const AI_UNAVAILABLE_REASONS = [
  'feature_disabled',
  'timed_assessment',
  'not_ready',
] as const;
export type AiUnavailableReason = (typeof AI_UNAVAILABLE_REASONS)[number];

/**
 * Error codes the gateway answers with, beside the platform's own. A provider's own failure never
 * reaches a browser as itself: it becomes one of these (Phase 7B).
 */
export const AI_ERROR_CODES = {
  UNAVAILABLE: 'ai_unavailable',
  FEATURE_DISABLED: 'ai_feature_disabled',
  NOT_ALLOWED: 'ai_not_allowed',
  /** The model service is at capacity, or resting after repeated failures: try again shortly. */
  BUSY: 'ai_busy',
  /** The model took longer than the gateway waits. */
  TIMEOUT: 'ai_timeout',
  /** Another of the person's answers is still being written: one at a time (Phase 7C). */
  GENERATION_IN_PROGRESS: 'ai_generation_in_progress',
  /** Today's allowance is used, or the institute's monthly AI budget is spent (ADR-0029). */
  QUOTA_EXCEEDED: 'ai_quota_exceeded',
  /** The request carries data the institute has not approved for its AI provider (ADR-0024). */
  DATA_NOT_APPROVED: 'ai_data_not_approved',
  /** The message looks like it holds a password, key or token, which is never sent anywhere. */
  RESTRICTED_CONTENT: 'ai_restricted_content',
  /** The provider's safety filters withheld the answer. */
  ANSWER_WITHHELD: 'ai_answer_withheld',
} as const;

/**
 * How the model service is doing, as the Super Admin sees it (Phase 7B): `off` (no provider),
 * `ready`, `degraded` (the main model is resting after failures; a fallback answers) or
 * `unavailable` (no configured model can be called now). Never why, or which provider.
 */
export const AI_SERVICE_STATES = ['off', 'ready', 'degraded', 'unavailable'] as const;
export type AiServiceState = (typeof AI_SERVICE_STATES)[number];

// ───────────────────────── requests ─────────────────────────

/** What a conversation is about. Each reference is checked against what the person may open. */
export const aiMessageContextSchema = z
  .object({
    courseId: z.uuid().optional(),
    lessonId: z.uuid().optional(),
    questionId: z.uuid().optional(),
  })
  .strict();
export type AiMessageContext = z.infer<typeof aiMessageContextSchema>;

/**
 * A new conversation (Phase 7C): its surface and what it is about. Strict: nothing beyond these
 * fields is accepted — no model, provider or system prompt can be smuggled in.
 */
export const aiConversationCreateSchema = z
  .object({
    purpose: z.enum(AI_PURPOSES),
    title: z.string().trim().min(1).max(120).optional(),
    context: aiMessageContextSchema.optional(),
  })
  .strict()
  .refine((value) => value.purpose !== 'lab_hint' || Boolean(value.context?.questionId), {
    path: ['context', 'questionId'],
    message: 'A hint is about one lab: name it',
  });
export type AiConversationCreate = z.infer<typeof aiConversationCreateSchema>;

/** A message in a conversation the person owns (Phase 7C). The answer streams back. */
export const aiMessageSendSchema = z
  .object({
    content: z.string().trim().min(1, 'Write a question').max(4000),
  })
  .strict();
export type AiMessageSend = z.infer<typeof aiMessageSendSchema>;

// ───────────────────────── answers ─────────────────────────

/** Which AI surfaces are on for the person asking (module, option flag and permission). */
export const aiFeatureMapSchema = z
  .object({
    assistant: z.boolean(),
    workspace: z.boolean(),
    lab_hints: z.boolean(),
    semantic_cache: z.boolean(),
  })
  .strict();
export type AiFeatureMap = z.infer<typeof aiFeatureMapSchema>;

/** Whether the AI can answer this person now, and if not, why. */
export const aiAvailabilitySchema = z
  .object({
    available: z.boolean(),
    reason: z.enum(AI_UNAVAILABLE_REASONS).nullable(),
    features: aiFeatureMapSchema,
  })
  .strict();
export type AiAvailability = z.infer<typeof aiAvailabilitySchema>;

export const aiConversationSummarySchema = z
  .object({
    id: z.uuid(),
    purpose: z.enum(AI_PURPOSES),
    title: z.string(),
    status: z.enum(AI_CONVERSATION_STATUSES),
    createdAt: z.iso.datetime(),
    lastMessageAt: z.iso.datetime().nullable(),
  })
  .strict();
export type AiConversationSummary = z.infer<typeof aiConversationSummarySchema>;

/**
 * One message as its owner sees it. An answer that did not complete (failed, cancelled, withheld)
 * keeps no text: a partial answer is never kept as if it were one.
 */
export const aiMessageViewSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    role: z.enum(AI_MESSAGE_ROLES),
    content: z.string(),
    status: z.enum(AI_MESSAGE_STATUSES),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type AiMessageView = z.infer<typeof aiMessageViewSchema>;

/** A conversation with what it is about and its messages, oldest first (owner only). */
export const aiConversationDetailSchema = aiConversationSummarySchema
  .extend({
    context: z
      .object({
        courseId: z.uuid().nullable(),
        lessonId: z.uuid().nullable(),
        questionId: z.uuid().nullable(),
      })
      .strict(),
    messages: z.array(aiMessageViewSchema),
  })
  .strict();
export type AiConversationDetail = z.infer<typeof aiConversationDetailSchema>;

// ───────────────────────── the answer stream (ADR-0030) ─────────────────────────

/**
 * The events of an answer stream (server-sent events over a POST, Phase 7C), in order:
 * `meta` once; `delta` as the answer is written; `notice` or `error` when there is something to
 * say; `usage` once a provider was called; `done` last, always. `ping` keeps the line open.
 * `sources` is reserved for cited material (Phase 8). Nothing of the provider's own events,
 * names or errors appears in any of them.
 */
export const AI_STREAM_EVENTS = [
  'meta',
  'delta',
  'sources',
  'notice',
  'usage',
  'error',
  'done',
  'ping',
] as const;
export type AiStreamEventName = (typeof AI_STREAM_EVENTS)[number];

/** How an answer ended: the message's final status. */
export const AI_ANSWER_ENDINGS = ['complete', 'failed', 'cancelled', 'blocked'] as const;
export type AiAnswerEnding = (typeof AI_ANSWER_ENDINGS)[number];

export const aiStreamEventSchemas = {
  meta: z
    .object({ conversationId: z.uuid(), userMessageId: z.uuid(), assistantMessageId: z.uuid() })
    .strict(),
  delta: z.object({ text: z.string() }).strict(),
  sources: z
    .object({ sources: z.array(z.object({ title: z.string(), href: z.string() }).strict()) })
    .strict(),
  notice: z.object({ code: z.enum(['answer_cut_short']), message: z.string() }).strict(),
  usage: z
    .object({
      inputTokens: z.number().int().min(0),
      outputTokens: z.number().int().min(0),
      /** The counts are estimates: the provider reported none, or the answer stopped early. */
      estimated: z.boolean(),
      requestsLeftToday: z.number().int().min(0),
      tokensLeftToday: z.number().int().min(0),
    })
    .strict(),
  error: z.object({ code: z.string(), message: z.string() }).strict(),
  done: z.object({ messageId: z.uuid(), status: z.enum(AI_ANSWER_ENDINGS) }).strict(),
  ping: z.object({}).strict(),
} satisfies Record<AiStreamEventName, z.ZodType>;

export type AiStreamEvent = {
  [K in AiStreamEventName]: { event: K; data: z.infer<(typeof aiStreamEventSchemas)[K]> };
}[AiStreamEventName];

/**
 * The Super Admin's view of the gateway: whether a model service is configured for this build
 * (`configured`), never which one or with what key; whether the gateway answers yet; and how the
 * model service is doing (`service`).
 */
export const aiAdminStatusSchema = z
  .object({
    configured: z.boolean(),
    gatewayReady: z.boolean(),
    service: z.enum(AI_SERVICE_STATES),
  })
  .strict();
export type AiAdminStatus = z.infer<typeof aiAdminStatusSchema>;

// ───────────────────────── the institute's AI settings (Phase 7D) ─────────────────────────

/** The data classes an institute may approve; `restricted` never leaves the platform (ADR-0024). */
export const AI_APPROVABLE_DATA_CLASSES = ['public', 'course', 'personal'] as const;
export type AiApprovableDataClass = (typeof AI_APPROVABLE_DATA_CLASSES)[number];

/** A model's own code, as the model registry lists it: `gemini-3.8-flash`. */
const aiModelCodeSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9.-]{0,79}$/, 'A model code, such as gemini-3.8-flash');

/** An amount in US dollars, to the cent. */
const aiDollarsSchema = z
  .number()
  .positive()
  .max(9_999_999.99)
  .refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, {
    message: 'At most two decimals',
  });

/** A model per task, for the tasks named; the others use the default model. */
export const aiTaskModelsSchema = z
  .object({
    chat: aiModelCodeSchema.optional(),
    hint: aiModelCodeSchema.optional(),
    classify: aiModelCodeSchema.optional(),
    title: aiModelCodeSchema.optional(),
    summarize: aiModelCodeSchema.optional(),
  })
  .strict();
export type AiTaskModels = z.infer<typeof aiTaskModelsSchema>;

/**
 * The institute's AI settings (Phase 7D; ADR-0029, ADR-0030), stored as the `ai` row of the
 * platform's settings table and changed by the Super Admin alone (`ai:manage`). A null is "the
 * deployment's configuration": the environment variables stay the defaults. Switching AI and its
 * surfaces on or off stays with the flags (`module.ai`, `ai.semantic_cache`, …). No key or other
 * secret belongs here: provider keys stay in the server's environment.
 */
export const aiSettingsSchema = z
  .object({
    /** Questions each person may ask a day; null: AI_USER_DAILY_REQUESTS. */
    dailyQuestions: z.number().int().min(1).max(100_000).nullable().default(null),
    /** Tokens each person may use a day; null: AI_USER_DAILY_TOKENS. */
    dailyTokens: z.number().int().min(1000).max(100_000_000).nullable().default(null),
    /** The institute's monthly budget, against estimated costs; null: AI_ORG_MONTHLY_BUDGET_USD. */
    monthlyBudgetUsd: aiDollarsSchema.nullable().default(null),
    /** The share of the monthly budget at which the Super Admin is warned, once a month. */
    budgetWarningPercent: z.number().int().min(50).max(95).default(80),
    /**
     * Days a conversation is kept after its last message, and days each message is kept. 90 is the
     * requirements' retention schedule for AI conversations (planning report §14.4).
     */
    conversationRetentionDays: z.number().int().min(1).max(3650).default(90),
    /**
     * Days each call stays in the usage ledger; the daily totals are kept for good. 730 is the
     * schedule's two years for raw events, aggregates kept (§14.4).
     */
    usageDetailRetentionDays: z.number().int().min(90).max(3650).default(730),
    /** Narrows the data classes the deployment approved (AI_DATA_CLASSES); null: all of those. */
    dataClasses: z
      .array(z.enum(AI_APPROVABLE_DATA_CLASSES))
      .min(1)
      .max(3)
      .refine((classes) => new Set(classes).size === classes.length, {
        message: 'Name each data class once',
      })
      .nullable()
      .default(null),
    /** The model every task uses unless `taskModels` names another; null: AI_MODEL. */
    model: aiModelCodeSchema.nullable().default(null),
    /** Models per task; a task left out uses `model`, else AI_TASK_MODELS. */
    taskModels: aiTaskModelsSchema.default({}),
    /** Another model of the same provider, for when the main one is overloaded or resting. */
    fallbackModel: aiModelCodeSchema.nullable().default(null),
    /** Hours a cached answer may be reused (the Phase 7 answer cache, exact keys). */
    cacheTtlHours: z.number().int().min(1).max(720).default(168),
  })
  .strict();
export type AiSettings = z.infer<typeof aiSettingsSchema>;

/** A change to the AI settings: only the fields named change; anything unknown is refused. */
export const aiSettingsUpdateSchema = patchSchemaOf(aiSettingsSchema).strict();
export type AiSettingsUpdate = z.infer<typeof aiSettingsUpdateSchema>;

/**
 * What the Super Admin sees of the AI settings: what is stored, what applies now (the stored
 * choices over the deployment's), the models this installation can route to, and stored choices
 * the deployment cannot honour now (which are then not applied). Model codes are configuration
 * the Super Admin chooses; no key, address or provider account ever appears.
 */
export const aiSettingsViewSchema = z
  .object({
    settings: aiSettingsSchema,
    effective: z
      .object({
        dailyQuestions: z.number().int(),
        dailyTokens: z.number().int(),
        monthlyBudgetUsd: z.number().nullable(),
        budgetWarningPercent: z.number().int(),
        conversationRetentionDays: z.number().int(),
        usageDetailRetentionDays: z.number().int(),
        dataClasses: z.array(z.enum(AI_APPROVABLE_DATA_CLASSES)),
        model: z.string().nullable(),
        taskModels: z.partialRecord(z.enum(AI_TASKS), z.string()),
        fallbackModel: z.string().nullable(),
        cacheTtlHours: z.number().int(),
      })
      .strict(),
    models: z.array(
      z
        .object({
          id: z.string(),
          tasks: z.array(z.enum(AI_TASKS)),
          mayStandIn: z.boolean(),
          priced: z.boolean(),
        })
        .strict(),
    ),
    approvableDataClasses: z.array(z.enum(AI_APPROVABLE_DATA_CLASSES)),
    ignored: z.array(z.string()),
  })
  .strict();
export type AiSettingsView = z.infer<typeof aiSettingsViewSchema>;

// ───────────────────────── usage (Phase 7D) ─────────────────────────

/** A period of whole days in the institute's time zone, at most 92 of them. */
export const aiUsageQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ['to'],
    message: 'The period ends before it starts',
  })
  .refine(
    (value) =>
      !value.from ||
      !value.to ||
      Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`) <=
        91 * 86_400_000,
    { path: ['to'], message: 'At most 92 days at a time' },
  );
export type AiUsageQuery = z.infer<typeof aiUsageQuerySchema>;

const aiUsageFiguresShape = {
  questions: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  /** Calls whose token counts are estimates. */
  estimatedCalls: z.number().int().min(0),
  /** From the configured prices: an estimate for the institute's budget, not a bill. */
  estimatedCostUsd: z.number().min(0),
};

/** Where this month's estimated spend stands against the budget. */
export const AI_BUDGET_STATES = ['ok', 'warning', 'exceeded'] as const;
export type AiBudgetState = (typeof AI_BUDGET_STATES)[number];

/**
 * AI usage for a period (Phase 7D; `ai:usage_read`): per day, and per person — everyone for an
 * administrator, the learners of their batches for a trainer. Figures only: never a question or an
 * answer. People whose data was erased are counted under `userId: null`. The budget is shown only
 * to those who see the whole institute.
 */
export const aiUsageReportSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    costsAreEstimates: z.literal(true),
    totals: z.object(aiUsageFiguresShape).strict(),
    days: z.array(z.object({ day: z.iso.date(), ...aiUsageFiguresShape }).strict()),
    people: z.array(
      z.object({ userId: z.uuid().nullable(), name: z.string(), ...aiUsageFiguresShape }).strict(),
    ),
    budget: z
      .object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        budgetUsd: z.number().positive(),
        spentUsd: z.number().min(0),
        percent: z.number().min(0),
        state: z.enum(AI_BUDGET_STATES),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type AiUsageReport = z.infer<typeof aiUsageReportSchema>;

/** The Super Admin emptied the answer cache: how many answers it held. */
export const aiCachePurgeResultSchema = z.object({ purged: z.number().int().min(0) }).strict();
export type AiCachePurgeResult = z.infer<typeof aiCachePurgeResultSchema>;

/** What a provider can do. Server-side metadata; no key, URL or account detail belongs here. */
export const aiProviderCapabilitiesSchema = z
  .object({
    streaming: z.boolean(),
    embeddings: z.boolean(),
    structuredOutput: z.boolean(),
    maxContextTokens: z.number().int().min(0),
  })
  .strict();
export type AiProviderCapabilities = z.infer<typeof aiProviderCapabilitiesSchema>;
