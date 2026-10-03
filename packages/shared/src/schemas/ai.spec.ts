import { describe, expect, it } from 'vitest';
import type { ZodObject } from 'zod';
import { AI_PERMISSIONS, PLATFORM_PERMISSIONS } from '../permissions.js';
import {
  AI_FEATURE_FLAGS,
  AI_FEATURES,
  AI_MODULE_FLAG,
  AI_STREAM_EVENTS,
  aiAdminStatusSchema,
  aiAvailabilitySchema,
  aiConversationCreateSchema,
  aiConversationDetailSchema,
  aiConversationSummarySchema,
  aiFeatureEnabled,
  aiMessageSendSchema,
  aiMessageViewSchema,
  aiProviderCapabilitiesSchema,
  aiSettingsSchema,
  aiSettingsUpdateSchema,
  aiSettingsViewSchema,
  aiStreamEventSchemas,
  aiUsageQuerySchema,
  aiUsageReportSchema,
} from './ai.js';

const id = '0190a0e4-7c1d-7b9e-8f00-000000000001';

describe('AI conversations and messages (Phases 7A, 7C)', () => {
  it('accepts a conversation for a surface, and a question in it', () => {
    expect(aiConversationCreateSchema.parse({ purpose: 'workspace' })).toEqual({
      purpose: 'workspace',
    });
    expect(
      aiConversationCreateSchema.safeParse({
        purpose: 'assistant',
        title: 'Java classes',
        context: { courseId: id, lessonId: id },
      }).success,
    ).toBe(true);
    expect(aiMessageSendSchema.parse({ content: '  What is a class?  ' })).toEqual({
      content: 'What is a class?',
    });
  });

  it('refuses an empty or overlong question, an unknown purpose and unknown fields', () => {
    expect(aiMessageSendSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(aiMessageSendSchema.safeParse({ content: 'x'.repeat(4001) }).success).toBe(false);
    expect(aiConversationCreateSchema.safeParse({ purpose: 'grader' }).success).toBe(false);
    // Strict: nothing beyond the declared fields — a model choice or a key cannot be smuggled in.
    for (const extra of [{ model: 'x' }, { apiKey: 'x' }, { provider: 'x' }, { system: 'x' }]) {
      expect(
        aiMessageSendSchema.safeParse({ content: 'hi', ...extra }).success,
        JSON.stringify(extra),
      ).toBe(false);
      expect(
        aiConversationCreateSchema.safeParse({ purpose: 'workspace', ...extra }).success,
        JSON.stringify(extra),
      ).toBe(false);
    }
    expect(
      aiConversationCreateSchema.safeParse({
        purpose: 'assistant',
        context: { courseId: id, sql: 'select 1' },
      }).success,
    ).toBe(false);
  });

  it('asks a hint to name its lab', () => {
    const missing = aiConversationCreateSchema.safeParse({ purpose: 'lab_hint' });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['context', 'questionId']);
    expect(
      aiConversationCreateSchema.safeParse({ purpose: 'lab_hint', context: { questionId: id } })
        .success,
    ).toBe(true);
  });
});

describe('the answer stream (ADR-0030, Phase 7C)', () => {
  it('has one strict shape per event, and nothing else passes', () => {
    expect(Object.keys(aiStreamEventSchemas).sort()).toEqual([...AI_STREAM_EVENTS].sort());
    expect(aiStreamEventSchemas.delta.parse({ text: 'Hello' })).toEqual({ text: 'Hello' });
    // A provider's own fields cannot ride along with an event.
    for (const [event, extra] of [
      ['delta', { text: 'Hi', candidates: [] }],
      [
        'usage',
        {
          inputTokens: 1,
          outputTokens: 1,
          estimated: false,
          requestsLeftToday: 1,
          tokensLeftToday: 1,
          model: 'x',
        },
      ],
      ['error', { code: 'ai_unavailable', message: 'No', providerMessage: 'API key not valid' }],
      ['done', { messageId: id, status: 'complete', finishReason: 'STOP' }],
      ['ping', { at: 1 }],
    ] as const) {
      expect(aiStreamEventSchemas[event].safeParse(extra).success, event).toBe(false);
    }
    // An answer ends one of four ways; still being written is not an ending.
    expect(
      aiStreamEventSchemas.done.safeParse({ messageId: id, status: 'streaming' }).success,
    ).toBe(false);
  });

  it('gives a conversation back with its messages, and nothing about its provider', () => {
    const detail = {
      id,
      purpose: 'workspace',
      title: 'Java classes',
      status: 'active',
      createdAt: '2026-10-04T10:00:00.000Z',
      lastMessageAt: null,
      context: { courseId: null, lessonId: null, questionId: null },
      messages: [
        {
          id,
          conversationId: id,
          role: 'assistant',
          content: '',
          status: 'cancelled',
          createdAt: '2026-10-04T10:00:00.000Z',
        },
      ],
    };
    expect(aiConversationDetailSchema.parse(detail)).toEqual(detail);
    expect(aiConversationDetailSchema.safeParse({ ...detail, model: 'x' }).success).toBe(false);
    expect(
      aiConversationDetailSchema.safeParse({
        ...detail,
        messages: [{ ...detail.messages[0], provider: 'gemini' }],
      }).success,
    ).toBe(false);
  });
});

describe('AI answers carry nothing the server did not mean to send', () => {
  const clientFacing: [string, ZodObject][] = [
    ['availability', aiAvailabilitySchema],
    ['conversation summary', aiConversationSummarySchema],
    ['conversation detail', aiConversationDetailSchema],
    ['message view', aiMessageViewSchema],
    ['admin status', aiAdminStatusSchema],
    ['settings', aiSettingsSchema],
    ['settings view', aiSettingsViewSchema],
    ['usage report', aiUsageReportSchema],
    ...Object.entries(aiStreamEventSchemas).map(
      ([event, schema]) => [`${event} event`, schema] as [string, ZodObject],
    ),
  ];

  it.each(clientFacing)('the %s shape names no key, secret, token or provider', (_, schema) => {
    for (const key of Object.keys(schema.shape)) {
      // `inputTokens` and `tokensLeftToday` count words of a model's text; a `token` is a secret.
      expect(key).not.toMatch(/key|secret|token(?!s)|password|provider|credential/i);
    }
    expect('accessToken').toMatch(/token(?!s)/i);
  });

  it('refuses an extra field rather than passing it to the browser', () => {
    const availability = {
      available: false,
      reason: 'not_ready',
      features: { assistant: false, workspace: false, lab_hints: false, semantic_cache: false },
    };
    expect(aiAvailabilitySchema.parse(availability)).toEqual(availability);
    expect(aiAvailabilitySchema.safeParse({ ...availability, provider: 'fake' }).success).toBe(
      false,
    );
    const status = { configured: true, gatewayReady: false, service: 'ready' };
    expect(aiAdminStatusSchema.parse(status)).toEqual(status);
    for (const extra of [{ apiKey: 'sk-test' }, { provider: 'gemini' }, { model: 'x' }]) {
      expect(aiAdminStatusSchema.safeParse({ ...status, ...extra }).success).toBe(false);
    }
    // The service state is one of four words, never a provider's own message.
    expect(aiAdminStatusSchema.safeParse({ ...status, service: 'API key not valid' }).success).toBe(
      false,
    );
    expect(
      aiProviderCapabilitiesSchema.safeParse({
        streaming: true,
        embeddings: false,
        structuredOutput: false,
        maxContextTokens: 1,
        endpoint: 'https://example.com',
      }).success,
    ).toBe(false);
  });
});

describe('AI flags (ADR-0031)', () => {
  it('opens a surface only with module.ai and its own flag', () => {
    for (const feature of AI_FEATURES) {
      const flag = AI_FEATURE_FLAGS[feature];
      expect(aiFeatureEnabled({}, feature)).toBe(false);
      expect(aiFeatureEnabled({ [flag]: true }, feature), `${flag} alone`).toBe(false);
      expect(aiFeatureEnabled({ [AI_MODULE_FLAG]: true }, feature)).toBe(false);
      expect(aiFeatureEnabled({ [AI_MODULE_FLAG]: true, [flag]: true }, feature)).toBe(true);
      expect(aiFeatureEnabled({ [AI_MODULE_FLAG]: false, [flag]: true }, feature)).toBe(false);
    }
  });
});

describe('AI permissions (ADR-0031)', () => {
  it('are the four of the policy, in the catalogue, with the scopes it gives them', () => {
    expect(AI_PERMISSIONS.map((p) => [p.key, p.scopes])).toEqual([
      ['ai:chat', ['own']],
      ['ai:hints', ['own']],
      ['ai:usage_read', ['all', 'batch']],
      ['ai:manage', ['all']],
    ]);
    for (const permission of AI_PERMISSIONS) {
      expect(PLATFORM_PERMISSIONS).toContainEqual(permission);
      expect(permission.moduleKey).toBe('ai');
    }
  });
});

describe('the institute’s AI settings (Phase 7D)', () => {
  it('defaults to the deployment’s configuration, with the retention schedule’s periods', () => {
    expect(aiSettingsSchema.parse({})).toEqual({
      dailyQuestions: null,
      dailyTokens: null,
      monthlyBudgetUsd: null,
      budgetWarningPercent: 80,
      conversationRetentionDays: 90,
      usageDetailRetentionDays: 730,
      dataClasses: null,
      model: null,
      taskModels: {},
      fallbackModel: null,
      cacheTtlHours: 168,
    });
  });

  it('accepts sensible choices, and a change of a few fields', () => {
    const chosen = {
      dailyQuestions: 20,
      dailyTokens: 50_000,
      monthlyBudgetUsd: 25.5,
      budgetWarningPercent: 75,
      conversationRetentionDays: 30,
      usageDetailRetentionDays: 400,
      dataClasses: ['public', 'course'],
      model: 'gemini-3.8-flash',
      taskModels: { title: 'gemini-3.5-flash-lite' },
      fallbackModel: 'gemini-3.5-flash-lite',
      cacheTtlHours: 24,
    };
    expect(aiSettingsSchema.parse(chosen)).toEqual(chosen);
    expect(aiSettingsUpdateSchema.parse({ dailyQuestions: 10 })).toEqual({ dailyQuestions: 10 });
    // Null puts a field back to the deployment's configuration.
    expect(aiSettingsUpdateSchema.parse({ model: null })).toEqual({ model: null });
  });

  it('refuses unsafe values, restricted data, keys and anything unknown', () => {
    for (const bad of [
      { dailyQuestions: 0 },
      { dailyQuestions: 1.5 },
      { dailyTokens: 10 },
      { monthlyBudgetUsd: -5 },
      { monthlyBudgetUsd: 0 },
      { monthlyBudgetUsd: 10.123 },
      { budgetWarningPercent: 100 },
      { budgetWarningPercent: 10 },
      { conversationRetentionDays: 0 },
      { conversationRetentionDays: 5000 },
      { usageDetailRetentionDays: 30 },
      { dataClasses: ['restricted'] },
      { dataClasses: [] },
      { dataClasses: ['public', 'public'] },
      { model: 'Gemini 3.8 Flash' },
      { model: '../../etc' },
      { taskModels: { embed: 'gemini-3.8-flash' } },
      { cacheTtlHours: 0 },
      { cacheTtlHours: 10_000 },
      { apiKey: 'sk-test' },
      { provider: 'gemini' },
      { geminiApiKey: 'x' },
    ]) {
      expect(aiSettingsUpdateSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('AI usage queries (Phase 7D)', () => {
  it('takes a period of at most 92 whole days', () => {
    expect(aiUsageQuerySchema.parse({})).toEqual({});
    expect(aiUsageQuerySchema.parse({ from: '2026-10-01', to: '2026-12-31' })).toEqual({
      from: '2026-10-01',
      to: '2026-12-31',
    });
    for (const bad of [
      { from: '2026-10-05', to: '2026-10-01' },
      { from: '2026-01-01', to: '2026-12-31' },
      { from: 'yesterday' },
      { from: '2026-10-01', userId: 'x' },
    ]) {
      expect(aiUsageQuerySchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
