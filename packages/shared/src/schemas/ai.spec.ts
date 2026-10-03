import { describe, expect, it } from 'vitest';
import type { ZodObject } from 'zod';
import { AI_PERMISSIONS, PLATFORM_PERMISSIONS } from '../permissions.js';
import {
  AI_FEATURE_FLAGS,
  AI_FEATURES,
  AI_MODULE_FLAG,
  aiAdminStatusSchema,
  aiAvailabilitySchema,
  aiConversationSummarySchema,
  aiFeatureEnabled,
  aiMessageInputSchema,
  aiMessageViewSchema,
  aiProviderCapabilitiesSchema,
} from './ai.js';

const id = '0190a0e4-7c1d-7b9e-8f00-000000000001';

describe('AI message input (Phase 7A)', () => {
  it('accepts a question, with or without what it is about', () => {
    expect(
      aiMessageInputSchema.parse({ purpose: 'assistant', content: '  What is a class?  ' }),
    ).toEqual({ purpose: 'assistant', content: 'What is a class?' });
    expect(
      aiMessageInputSchema.safeParse({
        purpose: 'workspace',
        content: 'Explain this lesson',
        conversationId: id,
        context: { courseId: id, lessonId: id },
      }).success,
    ).toBe(true);
  });

  it('refuses an empty or overlong question, an unknown purpose and unknown fields', () => {
    expect(aiMessageInputSchema.safeParse({ purpose: 'assistant', content: '   ' }).success).toBe(
      false,
    );
    expect(
      aiMessageInputSchema.safeParse({ purpose: 'assistant', content: 'x'.repeat(4001) }).success,
    ).toBe(false);
    expect(aiMessageInputSchema.safeParse({ purpose: 'grader', content: 'hi' }).success).toBe(
      false,
    );
    // Strict: nothing beyond the declared fields — a model choice or a key cannot be smuggled in.
    for (const extra of [{ model: 'x' }, { apiKey: 'x' }, { provider: 'x' }, { system: 'x' }]) {
      expect(
        aiMessageInputSchema.safeParse({ purpose: 'assistant', content: 'hi', ...extra }).success,
        JSON.stringify(extra),
      ).toBe(false);
    }
    expect(
      aiMessageInputSchema.safeParse({
        purpose: 'assistant',
        content: 'hi',
        context: { courseId: id, sql: 'select 1' },
      }).success,
    ).toBe(false);
  });

  it('asks a hint to name its lab', () => {
    const missing = aiMessageInputSchema.safeParse({ purpose: 'lab_hint', content: 'Help' });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['context', 'questionId']);
    expect(
      aiMessageInputSchema.safeParse({
        purpose: 'lab_hint',
        content: 'Help',
        context: { questionId: id },
      }).success,
    ).toBe(true);
  });
});

describe('AI answers carry nothing the server did not mean to send', () => {
  const clientFacing: [string, ZodObject][] = [
    ['availability', aiAvailabilitySchema],
    ['conversation summary', aiConversationSummarySchema],
    ['message view', aiMessageViewSchema],
    ['admin status', aiAdminStatusSchema],
  ];

  it.each(clientFacing)('the %s shape names no key, secret, token or provider', (_, schema) => {
    for (const key of Object.keys(schema.shape)) {
      expect(key).not.toMatch(/key|secret|token|password|provider|credential/i);
    }
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
