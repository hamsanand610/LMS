import { describe, expect, it } from 'vitest';
import { AI_TASKS } from '@lms/shared';
import { type AppConfig, envSchema } from '../../../core/config/env.js';
import { FAKE_MODEL } from '../providers/fake.provider.js';
import { AI_MODEL_REGISTRY, type AiModelSpec, resolveRouting } from './model-registry.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
};
const configWith = (env: Record<string, string>): AppConfig =>
  envSchema.parse({ ...REQUIRED, ...env });
const gemini = (env: Record<string, string> = {}) =>
  configWith({
    AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'k'.repeat(39),
    AI_MODEL: 'gemini-3.8-flash',
    ...env,
  });

describe('the model registry (Phase 7B)', () => {
  it('lists each model once, by a code that is safe in a request path', () => {
    const keys = AI_MODEL_REGISTRY.map((m) => `${m.provider}/${m.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const model of AI_MODEL_REGISTRY) {
      expect(model.id).toMatch(/^[a-z0-9][a-z0-9.-]{0,79}$/);
      expect(model.contextTokens).toBeGreaterThan(0);
      expect(model.outputTokens).toBeGreaterThan(0);
      for (const task of model.tasks) expect(AI_TASKS).toContain(task);
    }
  });

  it('never lets restricted data reach a model, and never lets the fake stand in for one', () => {
    for (const model of AI_MODEL_REGISTRY) {
      expect(model.dataClasses as readonly string[], model.id).not.toContain('restricted');
    }
    const fake = AI_MODEL_REGISTRY.filter((m) => m.provider === 'fake');
    expect(fake.map((m) => m.id)).toEqual([FAKE_MODEL]);
    expect(fake.every((m) => !m.fallback)).toBe(true);
  });

  it('lists Gemini’s stable text models only, Google’s two recommended ones among them', () => {
    const geminiModels = AI_MODEL_REGISTRY.filter((m) => m.provider === 'gemini');
    expect(geminiModels.map((m) => m.id)).toEqual(
      expect.arrayContaining(['gemini-3.8-flash', 'gemini-3.5-flash-lite']),
    );
    for (const model of geminiModels) {
      expect(model.id).toMatch(/^gemini-\d+(\.\d+)?-flash(-lite)?$/);
      expect(model.id).not.toMatch(/preview|exp|latest|tts|live|image|embedding|2\.5/);
      expect(model).toMatchObject({
        tasks: AI_TASKS,
        streaming: true,
        contextTokens: 1_048_576,
        outputTokens: 65_536,
        fallback: true,
      });
    }
  });
});

describe('resolving the routing from the configuration', () => {
  it('routes nothing without a provider, and needs nothing for it', () => {
    const { routing, problems } = resolveRouting(configWith({}), AI_MODEL_REGISTRY);
    expect(problems).toEqual([]);
    expect(routing).toMatchObject({ provider: 'none', models: {}, main: null, fallback: null });
  });

  it('runs the fake on its own model unless told otherwise', () => {
    const { routing, problems } = resolveRouting(
      configWith({ AI_PROVIDER: 'fake' }),
      AI_MODEL_REGISTRY,
    );
    expect(problems).toEqual([]);
    expect(routing.main?.id).toBe(FAKE_MODEL);
    for (const task of AI_TASKS) expect(routing.models[task]?.id).toBe(FAKE_MODEL);
  });

  it('routes each task to its own model, else AI_MODEL, with a fallback and prices', () => {
    const { routing, problems } = resolveRouting(
      gemini({
        AI_TASK_MODELS: 'title=gemini-3.5-flash-lite,summarize=gemini-3.5-flash-lite',
        AI_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
        AI_MODEL_COSTS: 'gemini-3.8-flash=0.50/3.00',
        AI_DATA_CLASSES: 'public,course',
      }),
      AI_MODEL_REGISTRY,
    );
    expect(problems).toEqual([]);
    expect(Object.fromEntries(AI_TASKS.map((t) => [t, routing.models[t]?.id]))).toEqual({
      chat: 'gemini-3.8-flash',
      hint: 'gemini-3.8-flash',
      classify: 'gemini-3.8-flash',
      title: 'gemini-3.5-flash-lite',
      summarize: 'gemini-3.5-flash-lite',
    });
    expect(routing.fallback?.id).toBe('gemini-3.5-flash-lite');
    expect(routing.costs.get('gemini-3.8-flash')).toEqual({
      inputUsdPerMillion: 0.5,
      outputUsdPerMillion: 3,
    });
    expect(routing.approved).toEqual(['public', 'course']);
  });

  it('refuses a model the registry does not list for the provider — never another provider’s', () => {
    const problemsOf = (config: AppConfig) => resolveRouting(config, AI_MODEL_REGISTRY).problems;
    expect(problemsOf(gemini({ AI_MODEL: 'gemini-9-ultra' }))).toEqual([
      expect.stringMatching(
        /^AI_MODEL names "gemini-9-ultra", which the model registry does not list for gemini \(it lists gemini-3\.8-flash, /,
      ),
    ]);
    // The fake's model is not Gemini's, and Gemini's are not the fake's.
    expect(problemsOf(gemini({ AI_MODEL: FAKE_MODEL }))).toHaveLength(1);
    expect(
      problemsOf(configWith({ AI_PROVIDER: 'fake', AI_TASK_MODELS: 'title=gemini-3.8-flash' })),
    ).toEqual([expect.stringContaining('AI_TASK_MODELS (title) names "gemini-3.8-flash"')]);
    expect(problemsOf(gemini({ AI_MODEL_COSTS: 'gemini-9-ultra=1/2' }))).toEqual([
      expect.stringContaining('AI_MODEL_COSTS names "gemini-9-ultra"'),
    ]);
  });

  it('allows only a different model of the same provider, fit to stand in, as the fallback', () => {
    const problemsOf = (config: AppConfig) => resolveRouting(config, AI_MODEL_REGISTRY).problems;
    expect(problemsOf(gemini({ AI_FALLBACK_MODEL: 'gemini-3.8-flash' }))).toEqual([
      'AI_FALLBACK_MODEL must be another model than AI_MODEL',
    ]);
    // The fake can never be Gemini's fallback: it is not one of Gemini's models.
    expect(problemsOf(gemini({ AI_FALLBACK_MODEL: FAKE_MODEL }))).toEqual([
      expect.stringContaining(`AI_FALLBACK_MODEL names "${FAKE_MODEL}"`),
    ]);
    // Nor anything's: it may not stand in at all.
    expect(problemsOf(configWith({ AI_PROVIDER: 'fake', AI_FALLBACK_MODEL: FAKE_MODEL }))).toEqual([
      `AI_FALLBACK_MODEL: ${FAKE_MODEL} may not stand in for another model`,
    ]);
  });

  it('needs a price for every routed model once a monthly budget is set (ADR-0029)', () => {
    const problemsOf = (config: AppConfig) => resolveRouting(config, AI_MODEL_REGISTRY).problems;
    expect(
      problemsOf(
        gemini({ AI_ORG_MONTHLY_BUDGET_USD: '25', AI_FALLBACK_MODEL: 'gemini-3.5-flash-lite' }),
      ),
    ).toEqual([
      'AI_ORG_MONTHLY_BUDGET_USD is set, but AI_MODEL_COSTS has no price for gemini-3.8-flash',
      'AI_ORG_MONTHLY_BUDGET_USD is set, but AI_MODEL_COSTS has no price for gemini-3.5-flash-lite',
    ]);
    expect(
      problemsOf(
        gemini({
          AI_ORG_MONTHLY_BUDGET_USD: '25',
          AI_MODEL_COSTS: 'gemini-3.8-flash=0.50/3.00',
        }),
      ),
    ).toEqual([]);
    // Without a provider there is nothing to price.
    expect(problemsOf(configWith({ AI_ORG_MONTHLY_BUDGET_USD: '25' }))).toEqual([]);
  });

  it('refuses a model for a task it does not handle', () => {
    const titleless: AiModelSpec[] = AI_MODEL_REGISTRY.map((m) =>
      m.id === 'gemini-3.8-flash' ? { ...m, tasks: m.tasks.filter((t) => t !== 'title') } : m,
    );
    expect(resolveRouting(gemini(), titleless).problems).toEqual([
      'gemini-3.8-flash does not handle the title task: name a model for it in AI_TASK_MODELS',
    ]);
    expect(
      resolveRouting(gemini({ AI_TASK_MODELS: 'title=gemini-3.5-flash-lite' }), titleless).problems,
    ).toEqual([]);
  });
});
