import { AI_TASKS, type AiProviderName, type AiTask } from '@lms/shared';
import type { AiModelCost, AppConfig, ApprovableAiDataClass } from '../../../core/config/env.js';
import { FAKE_MODEL } from '../providers/fake.provider.js';

/** Injection token for the registry, so a test can route over models of its own. */
export const AI_MODELS = Symbol('AI_MODELS');

/** What SI Academy knows about one model (Phase 7B). The router routes over these and nothing else. */
export interface AiModelSpec {
  /** The provider's own code, as AI_MODEL, AI_TASK_MODELS and AI_FALLBACK_MODEL name it. */
  id: string;
  provider: Exclude<AiProviderName, 'none'>;
  tasks: readonly AiTask[];
  streaming: boolean;
  /**
   * The most sensitive data it may ever be sent (ADR-0024). The deployment's approval
   * (AI_DATA_CLASSES) narrows it further; `restricted` is never here.
   */
  dataClasses: readonly ApprovableAiDataClass[];
  /** Input limit, in tokens. */
  contextTokens: number;
  /** Output limit, in tokens, a thinking model's reasoning included. */
  outputTokens: number;
  /** It may answer for another model of its provider that is overloaded or resting. */
  fallback: boolean;
}

const GEMINI_TEXT_MODEL = {
  provider: 'gemini',
  tasks: AI_TASKS,
  streaming: true,
  dataClasses: ['public', 'course', 'personal'],
  contextTokens: 1_048_576,
  outputTokens: 65_536,
  fallback: true,
} as const satisfies Omit<AiModelSpec, 'id'>;

/**
 * Every model SI Academy may route to: an allow-list. Gemini's entries are its stable text models as
 * Google's model pages list them on 3 October 2026 — 1,048,576 input and 65,536 output tokens each,
 * thinking counted as output. Preview, legacy (2.5) and specialised models (live, speech, image,
 * embeddings) are not listed. A model joins the list, with its test, once it is stable and checked;
 * choosing among the listed ones is configuration. The fake is never a fallback.
 */
export const AI_MODEL_REGISTRY: readonly AiModelSpec[] = [
  {
    id: FAKE_MODEL,
    provider: 'fake',
    tasks: AI_TASKS,
    streaming: true,
    dataClasses: ['public', 'course', 'personal'],
    contextTokens: 8192,
    outputTokens: 2048,
    fallback: false,
  },
  { id: 'gemini-3.8-flash', ...GEMINI_TEXT_MODEL },
  { id: 'gemini-3.7-flash', ...GEMINI_TEXT_MODEL },
  { id: 'gemini-3.6-flash', ...GEMINI_TEXT_MODEL },
  { id: 'gemini-3.5-flash', ...GEMINI_TEXT_MODEL },
  { id: 'gemini-3.5-flash-lite', ...GEMINI_TEXT_MODEL },
  { id: 'gemini-3.1-flash-lite', ...GEMINI_TEXT_MODEL },
];

/** The routing this process runs with, resolved once from its configuration (Phase 7B). */
export interface AiRouting {
  provider: AiProviderName;
  /** The model each task goes to: AI_TASK_MODELS, else AI_MODEL. Empty without a provider. */
  models: Partial<Record<AiTask, AiModelSpec>>;
  /** AI_MODEL's model, which the service state describes. */
  main: AiModelSpec | null;
  fallback: AiModelSpec | null;
  /** The data classes the deployment approved for its provider (AI_DATA_CLASSES). */
  approved: readonly ApprovableAiDataClass[];
  costs: ReadonlyMap<string, AiModelCost>;
  timeoutMs: number;
}

/**
 * The routing for a configuration, and what is wrong with it. Every model named must be one the
 * registry lists for the configured provider — never another provider's — and fit its task; the
 * fallback must be allowed to stand in. The API refuses to start on any problem.
 */
export function resolveRouting(
  config: AppConfig,
  registry: readonly AiModelSpec[],
): { routing: AiRouting; problems: string[] } {
  const problems: string[] = [];
  const base = {
    provider: config.AI_PROVIDER,
    approved: config.AI_DATA_CLASSES,
    timeoutMs: config.AI_TIMEOUT_MS,
  };
  if (config.AI_PROVIDER === 'none') {
    return {
      routing: { ...base, models: {}, main: null, fallback: null, costs: new Map() },
      problems,
    };
  }
  const provider = config.AI_PROVIDER;
  const own = registry.filter((model) => model.provider === provider);
  const find = (id: string, variable: string): AiModelSpec | null => {
    const spec = own.find((model) => model.id === id);
    if (!spec) {
      const known = own.map((model) => model.id).join(', ') || 'none';
      problems.push(
        `${variable} names "${id}", which the model registry does not list for ${provider} (it lists ${known})`,
      );
    }
    return spec ?? null;
  };

  const mainId = config.AI_MODEL || (provider === 'fake' ? FAKE_MODEL : '');
  const main = mainId ? find(mainId, 'AI_MODEL') : null;
  const models: Partial<Record<AiTask, AiModelSpec>> = {};
  for (const task of AI_TASKS) {
    const named = config.AI_TASK_MODELS[task];
    const spec = named ? find(named, `AI_TASK_MODELS (${task})`) : main;
    if (!spec) continue;
    if (!spec.tasks.includes(task)) {
      problems.push(
        `${spec.id} does not handle the ${task} task: name a model for it in AI_TASK_MODELS`,
      );
      continue;
    }
    models[task] = spec;
  }

  let fallback: AiModelSpec | null = null;
  if (config.AI_FALLBACK_MODEL) {
    const spec = find(config.AI_FALLBACK_MODEL, 'AI_FALLBACK_MODEL');
    if (spec && !spec.fallback) {
      problems.push(`AI_FALLBACK_MODEL: ${spec.id} may not stand in for another model`);
    } else if (spec && spec.id === main?.id) {
      problems.push('AI_FALLBACK_MODEL must be another model than AI_MODEL');
    } else {
      fallback = spec;
    }
  }

  // Prices may be kept for every listed model, whichever provider runs now; a code the registry
  // does not know at all is a mistake.
  const costs = new Map<string, AiModelCost>();
  for (const [id, cost] of Object.entries(config.AI_MODEL_COSTS)) {
    if (registry.some((model) => model.id === id)) costs.set(id, cost);
    else problems.push(`AI_MODEL_COSTS names "${id}", which the model registry does not list`);
  }

  return { routing: { ...base, models, main, fallback, costs }, problems };
}
