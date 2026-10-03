import { z } from 'zod';

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

/** The kinds of model call the gateway makes. Each is routed to a model in Phase 7B. */
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
 * stand-in for local development and tests. Server configuration only: never sent to a browser.
 */
export const AI_PROVIDER_NAMES = ['none', 'fake'] as const;
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

/** Error codes the gateway answers with, beside the platform's own. */
export const AI_ERROR_CODES = {
  UNAVAILABLE: 'ai_unavailable',
  FEATURE_DISABLED: 'ai_feature_disabled',
  NOT_ALLOWED: 'ai_not_allowed',
} as const;

// ───────────────────────── requests ─────────────────────────

/** What a message is about. Each reference is checked against what the person may open. */
export const aiMessageContextSchema = z
  .object({
    courseId: z.uuid().optional(),
    lessonId: z.uuid().optional(),
    questionId: z.uuid().optional(),
  })
  .strict();
export type AiMessageContext = z.infer<typeof aiMessageContextSchema>;

/** A message to the AI. Strict: nothing beyond these fields is accepted. */
export const aiMessageInputSchema = z
  .object({
    purpose: z.enum(AI_PURPOSES),
    conversationId: z.uuid().optional(),
    content: z.string().trim().min(1, 'Write a question').max(4000),
    context: aiMessageContextSchema.optional(),
  })
  .strict()
  .refine((value) => value.purpose !== 'lab_hint' || Boolean(value.context?.questionId), {
    path: ['context', 'questionId'],
    message: 'A hint is about one lab: name it',
  });
export type AiMessageInput = z.infer<typeof aiMessageInputSchema>;

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

/**
 * The Super Admin's view of the gateway: whether a model service is configured for this build
 * (`configured`), never which one or with what key; and whether the gateway answers yet.
 */
export const aiAdminStatusSchema = z
  .object({
    configured: z.boolean(),
    gatewayReady: z.boolean(),
  })
  .strict();
export type AiAdminStatus = z.infer<typeof aiAdminStatusSchema>;

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
