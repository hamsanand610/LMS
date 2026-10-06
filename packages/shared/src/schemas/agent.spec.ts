import { describe, expect, it } from 'vitest';
import type { ZodObject } from 'zod';
import {
  AI_AGENT_RUN_STATUSES,
  AI_AGENT_STEPS,
  AI_AGENT_STREAM_EVENTS,
  AI_AGENT_TOOLS,
  aiAgentCitationSchema,
  aiAgentRunQuerySchema,
  aiAgentRunRequestSchema,
  aiAgentRunSchema,
  aiAgentStreamEventSchemas,
} from './agent.js';
import {
  AI_FEATURE_FLAGS,
  AI_MODULE_FLAG,
  AI_PURPOSE_FEATURE,
  AI_PURPOSES,
  aiConversationCreateSchema,
  aiFeatureEnabled,
} from './ai.js';

const id = '0190a0e4-7c1d-7b9e-8f00-000000000001';

const run = {
  conversationId: id,
  userMessageId: id,
  assistantMessageId: id,
  status: 'answered',
  capability: 'explain_lesson',
  answer: 'A class describes objects [S1].',
  citations: [
    {
      kind: 'lesson',
      id: 'S1',
      lessonId: id,
      courseId: id,
      title: 'Classes',
      heading: 'Basics',
      position: 0,
    },
  ],
  notice: null,
  error: null,
  usage: null,
};

/** The keys of a shape, at every depth of its objects. */
function keysOf(schema: unknown): string[] {
  const shape = (schema as Partial<ZodObject>).shape;
  if (!shape) return [];
  return Object.entries(shape).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
}

describe('the learning agent (Phase 9B; ADR-0039)', () => {
  it('is a conversation purpose and an AI surface of its own, behind module.ai and ai.agent', () => {
    expect(AI_PURPOSES).toContain('agent');
    expect(AI_PURPOSE_FEATURE.agent).toBe('agent');
    expect(AI_FEATURE_FLAGS.agent).toBe('ai.agent');
    expect(aiFeatureEnabled({ 'ai.agent': true }, 'agent')).toBe(false);
    expect(aiFeatureEnabled({ [AI_MODULE_FLAG]: true }, 'agent')).toBe(false);
    expect(aiFeatureEnabled({ [AI_MODULE_FLAG]: true, 'ai.agent': true }, 'agent')).toBe(true);
    expect(
      aiConversationCreateSchema.safeParse({ purpose: 'agent', context: { lessonId: id } }).success,
    ).toBe(true);
  });

  it('has exactly two tools, both named by the allow-list', () => {
    expect(AI_AGENT_TOOLS).toEqual(['knowledge_search', 'lesson_content']);
  });

  it('takes a message and nothing else: no model, tool, context or identity', () => {
    expect(aiAgentRunRequestSchema.parse({ content: '  Explain this lesson  ' })).toEqual({
      content: 'Explain this lesson',
    });
    expect(aiAgentRunRequestSchema.safeParse({ content: '  ' }).success).toBe(false);
    expect(aiAgentRunRequestSchema.safeParse({ content: 'x'.repeat(4001) }).success).toBe(false);
    for (const extra of [
      { model: 'x' },
      { tool: 'knowledge_search' },
      { tools: ['shell'] },
      { courseId: id },
      { lessonId: id },
      { learnerId: id },
      { organizationId: id },
      { system: 'x' },
      { stream: false },
    ]) {
      expect(
        aiAgentRunRequestSchema.safeParse({ content: 'hi', ...extra }).success,
        JSON.stringify(extra),
      ).toBe(false);
    }
  });

  it('streams unless asked not to, and takes no other query', () => {
    expect(aiAgentRunQuerySchema.parse({})).toEqual({ stream: 'true' });
    expect(aiAgentRunQuerySchema.parse({ stream: 'false' })).toEqual({ stream: 'false' });
    expect(aiAgentRunQuerySchema.safeParse({ stream: 'yes' }).success).toBe(false);
    expect(aiAgentRunQuerySchema.safeParse({ stream: 'true', debug: '1' }).success).toBe(false);
  });

  it('cites a lesson part or a knowledge passage, each with its own strict shape', () => {
    expect(aiAgentCitationSchema.safeParse(run.citations[0]).success).toBe(true);
    expect(
      aiAgentCitationSchema.safeParse({ ...run.citations[0], content: 'the lesson text' }).success,
    ).toBe(false);
    expect(aiAgentCitationSchema.safeParse({ ...run.citations[0], kind: 'web' }).success).toBe(
      false,
    );
    expect(aiAgentCitationSchema.safeParse({ ...run.citations[0], id: 'S0' }).success).toBe(false);
  });

  it('gives a result that carries no prompt, reasoning, tool call or provider', () => {
    expect(aiAgentRunSchema.parse(run)).toEqual(run);
    for (const extra of [
      { prompt: 'x' },
      { reasoning: 'x' },
      { plan: {} },
      { toolCalls: [] },
      { provider: 'gemini' },
      { model: 'x' },
    ]) {
      expect(aiAgentRunSchema.safeParse({ ...run, ...extra }).success, JSON.stringify(extra)).toBe(
        false,
      );
    }
    expect(aiAgentRunSchema.safeParse({ ...run, status: 'thinking' }).success).toBe(false);
  });

  it('has one strict shape per stream event, and a step is a state, never words', () => {
    expect(Object.keys(aiAgentStreamEventSchemas)).toEqual([...AI_AGENT_STREAM_EVENTS]);
    for (const step of AI_AGENT_STEPS) {
      expect(aiAgentStreamEventSchemas.step.safeParse({ step }).success).toBe(true);
    }
    for (const bad of [
      { step: 'I will now call knowledge_search with the query…' },
      { step: 'routing', detail: 'chain of thought' },
      { step: 'routing', tool: 'knowledge_search', arguments: { query: 'x' } },
    ]) {
      expect(aiAgentStreamEventSchemas.step.safeParse(bad).success, JSON.stringify(bad)).toBe(
        false,
      );
    }
    expect(aiAgentStreamEventSchemas.delta.safeParse({ text: 'x', reasoning: 'y' }).success).toBe(
      false,
    );
    for (const status of AI_AGENT_RUN_STATUSES) {
      expect(aiAgentStreamEventSchemas.done.safeParse({ messageId: id, status }).success).toBe(
        true,
      );
    }
    expect(
      aiAgentStreamEventSchemas.notice.safeParse({ code: 'debug', message: 'x' }).success,
    ).toBe(false);
  });

  it('names no key, secret, token, provider or prompt in anything a browser receives', () => {
    const shapes: unknown[] = [
      aiAgentRunSchema,
      ...Object.values(aiAgentStreamEventSchemas),
      ...aiAgentCitationSchema.options,
    ];
    for (const shape of shapes) {
      for (const key of keysOf(shape)) {
        expect(key).not.toMatch(/key|secret|token(?!s)|password|provider|credential|prompt/i);
      }
    }
  });
});
