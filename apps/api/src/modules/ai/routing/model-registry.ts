import {
  AI_TASKS,
  type AiPrimaryProviderName,
  type AiProviderName,
  type AiTask,
  KNOWLEDGE_EMBEDDING_DIMENSION,
} from '@lms/shared';
import type { AiModelCost, AppConfig, ApprovableAiDataClass } from '../../../core/config/env.js';
import { FAKE_EMBEDDING_MODEL, FAKE_MODEL } from '../providers/fake.provider.js';

/** Injection token for the registry, so a test can route over models of its own. */
export const AI_MODELS = Symbol('AI_MODELS');

/** What SI Academy knows about one model (Phase 7B). The router routes over these and nothing else. */
export interface AiModelSpec {
  /** The provider's own code, as AI_MODEL, AI_TASK_MODELS and AI_FALLBACK_MODEL name it. */
  id: string;
  provider: Exclude<AiProviderName, 'none'>;
  /**
   * The line of models it belongs to, across versions (Phase 7D): the answer cache keys on it, and
   * an answer from another version of the family is stale rather than another question (ADR-0032).
   */
  family: string;
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
  /**
   * It may stand in for another model that is overloaded or resting: one of its own provider's, or,
   * for a fallback provider's model (ADR-0038), the main provider's.
   */
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
} as const satisfies Omit<AiModelSpec, 'id' | 'family'>;

/**
 * Groq's text models (ADR-0038): they only ever stand in for Gemini's (AI_FALLBACK_PROVIDER), and
 * are sent course material at most — the deployment's approval (AI_DATA_CLASSES) narrows that
 * further, and a learner's own work (`personal`) goes to no second provider until a decision says
 * so. 131,072 input tokens each.
 */
const GROQ = {
  provider: 'groq',
  tasks: AI_TASKS,
  streaming: true,
  dataClasses: ['public', 'course'],
  contextTokens: 131_072,
  fallback: true,
} as const satisfies Omit<AiModelSpec, 'id' | 'family' | 'outputTokens'>;

/**
 * Every model SI Academy may route to: an allow-list. Gemini's entries are its stable text models as
 * Google's model pages list them on 3 October 2026 — 1,048,576 input and 65,536 output tokens each,
 * thinking counted as output. Preview, legacy (2.5) and specialised models (live, speech, image,
 * embeddings) are not listed. Groq's are its production text models as its API lists them for the
 * key on 5 October 2026, with their own limits (131,072 input, 65,536 output tokens). Its Llama
 * models (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`) were shut down for free and developer
 * tiers on 16 August 2026, with these two named as their replacements; its preview, speech and
 * guard models are not listed.
 * A model joins the list, with its test, once it is stable and checked; choosing among the listed
 * ones is configuration. The fake is never a fallback.
 */
export const AI_MODEL_REGISTRY: readonly AiModelSpec[] = [
  {
    id: FAKE_MODEL,
    provider: 'fake',
    family: 'fake',
    tasks: AI_TASKS,
    streaming: true,
    dataClasses: ['public', 'course', 'personal'],
    contextTokens: 8192,
    outputTokens: 2048,
    fallback: false,
  },
  { id: 'gemini-3.8-flash', family: 'gemini-flash', ...GEMINI_TEXT_MODEL },
  { id: 'gemini-3.7-flash', family: 'gemini-flash', ...GEMINI_TEXT_MODEL },
  { id: 'gemini-3.6-flash', family: 'gemini-flash', ...GEMINI_TEXT_MODEL },
  { id: 'gemini-3.5-flash', family: 'gemini-flash', ...GEMINI_TEXT_MODEL },
  { id: 'gemini-3.5-flash-lite', family: 'gemini-flash-lite', ...GEMINI_TEXT_MODEL },
  { id: 'gemini-3.1-flash-lite', family: 'gemini-flash-lite', ...GEMINI_TEXT_MODEL },
  { id: 'openai/gpt-oss-120b', family: 'groq-gpt-oss', outputTokens: 65_536, ...GROQ },
  { id: 'openai/gpt-oss-20b', family: 'groq-gpt-oss-small', outputTokens: 65_536, ...GROQ },
];

/** Injection token for the embedding registry, so a test can route over models of its own. */
export const AI_EMBEDDING_MODELS = Symbol('AI_EMBEDDING_MODELS');

/** What SI Academy knows about one embedding model (Phase 8C; ADR-0035). */
export interface AiEmbeddingModelSpec {
  /** The provider's own code, as AI_EMBEDDING_MODEL names it. */
  id: string;
  provider: Exclude<AiProviderName, 'none'>;
  /** The output dimensions it can give: the stored dimension must be among them. */
  minDimension: number;
  maxDimension: number;
  /** Input limit per text, in tokens. */
  inputTokens: number;
  /** The most sensitive data it may ever be sent (ADR-0024); AI_DATA_CLASSES narrows it further. */
  dataClasses: readonly ApprovableAiDataClass[];
}

/**
 * Every model SI Academy may embed with: an allow-list (Phase 8C). Gemini's is `gemini-embedding-001`,
 * as Google's embeddings guide describes it on 17 September 2026 — stable, text only, 2,048 input
 * tokens, 128 to 3,072 dimensions, the task given as a parameter (ADR-0035 records why it, and not
 * Gemini Embedding 2). The fake's embeds offline, for tests and local development.
 */
export const AI_EMBEDDING_MODEL_REGISTRY: readonly AiEmbeddingModelSpec[] = [
  {
    id: FAKE_EMBEDDING_MODEL,
    provider: 'fake',
    minDimension: 1,
    maxDimension: 4096,
    inputTokens: 8192,
    dataClasses: ['public', 'course', 'personal'],
  },
  {
    id: 'gemini-embedding-001',
    provider: 'gemini',
    minDimension: 128,
    maxDimension: 3072,
    inputTokens: 2048,
    dataClasses: ['public', 'course', 'personal'],
  },
];

/** The model each provider embeds with when AI_EMBEDDING_MODEL names none (Groq never embeds). */
const DEFAULT_EMBEDDING_MODEL: Record<Exclude<AiPrimaryProviderName, 'none'>, string> = {
  fake: FAKE_EMBEDDING_MODEL,
  gemini: 'gemini-embedding-001',
};

/** How this process embeds (Phase 8C): one model, one dimension, and the texts sent per call. */
export interface AiEmbeddingRouting {
  model: AiEmbeddingModelSpec;
  dimension: number;
  batchSize: number;
}

/**
 * The embedding routing for a configuration, and what is wrong with it: none without a provider;
 * otherwise a model the embedding registry lists for the configured provider, at the schema's own
 * dimension (`KNOWLEDGE_EMBEDDING_DIMENSION`), which the model must be able to give. The API
 * refuses to start on any problem.
 */
export function resolveEmbeddingRouting(
  config: Pick<
    AppConfig,
    'AI_PROVIDER' | 'AI_EMBEDDING_MODEL' | 'AI_EMBEDDING_DIMENSION' | 'AI_EMBEDDING_BATCH_SIZE'
  >,
  registry: readonly AiEmbeddingModelSpec[],
): { routing: AiEmbeddingRouting | null; problems: string[] } {
  const problems: string[] = [];
  if (config.AI_EMBEDDING_DIMENSION !== KNOWLEDGE_EMBEDDING_DIMENSION) {
    problems.push(
      `AI_EMBEDDING_DIMENSION is ${config.AI_EMBEDDING_DIMENSION}, but the knowledge base stores vector(${KNOWLEDGE_EMBEDDING_DIMENSION}): another dimension needs a migration first (ADR-0035)`,
    );
  }
  if (config.AI_PROVIDER === 'none') {
    if (config.AI_EMBEDDING_MODEL) {
      problems.push(
        'No AI provider is configured (AI_PROVIDER=none): AI_EMBEDDING_MODEL names none',
      );
    }
    return { routing: null, problems };
  }
  const id = config.AI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL[config.AI_PROVIDER];
  const model = registry.find((spec) => spec.provider === config.AI_PROVIDER && spec.id === id);
  if (!model) {
    const known =
      registry
        .filter((spec) => spec.provider === config.AI_PROVIDER)
        .map((spec) => spec.id)
        .join(', ') || 'none';
    problems.push(
      `AI_EMBEDDING_MODEL names "${id}", which the embedding registry does not list for ${config.AI_PROVIDER} (it lists ${known})`,
    );
    return { routing: null, problems };
  }
  const dimension = config.AI_EMBEDDING_DIMENSION;
  if (dimension < model.minDimension || dimension > model.maxDimension) {
    problems.push(
      `${model.id} gives ${model.minDimension} to ${model.maxDimension} dimensions, not ${dimension}`,
    );
  }
  return { routing: { model, dimension, batchSize: config.AI_EMBEDDING_BATCH_SIZE }, problems };
}

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
 * The institute's own routing choices (Phase 7D), from its AI settings: each one, when set, takes
 * the place of the deployment's variable. Data classes can only narrow what the deployment
 * approved; models are chosen among those the registry lists for the configured provider.
 */
export interface AiInstituteRouting {
  model: string | null;
  taskModels: Partial<Record<AiTask, string>>;
  fallbackModel: string | null;
  dataClasses: readonly ApprovableAiDataClass[] | null;
  /** Whose monthly budget applies, if any: then every routed model needs a price (ADR-0029). */
  budget: 'settings' | 'deployment' | null;
}

/**
 * The routing for a configuration, and what is wrong with it. Every model named must be one the
 * registry lists for the configured provider and fit its task — except the stand-in, which is the
 * fallback provider's when the deployment names one (ADR-0038), and must be allowed to stand in.
 * The API refuses to start on any problem. With the institute's choices (Phase 7D) the same rules
 * apply to them, and a problem names the setting; a fallback provider's stand-in is the
 * deployment's alone.
 */
export function resolveRouting(
  config: AppConfig,
  registry: readonly AiModelSpec[],
  institute: AiInstituteRouting | null = null,
  embeddingRegistry: readonly AiEmbeddingModelSpec[] = AI_EMBEDDING_MODEL_REGISTRY,
): { routing: AiRouting; problems: string[] } {
  const problems: string[] = [];
  let approved: readonly ApprovableAiDataClass[] = config.AI_DATA_CLASSES;
  if (institute?.dataClasses) {
    for (const dataClass of institute.dataClasses) {
      if (!config.AI_DATA_CLASSES.includes(dataClass)) {
        problems.push(
          `dataClasses (AI settings) names ${dataClass}, which the deployment has not approved (AI_DATA_CLASSES)`,
        );
      }
    }
    approved = config.AI_DATA_CLASSES.filter((c) => institute.dataClasses!.includes(c));
  }
  const base = { provider: config.AI_PROVIDER, approved, timeoutMs: config.AI_TIMEOUT_MS };
  if (config.AI_PROVIDER === 'none') {
    if (institute?.model || institute?.fallbackModel || hasTaskModels(institute)) {
      problems.push('No AI provider is configured (AI_PROVIDER=none): no model can be chosen yet');
    }
    return {
      routing: { ...base, models: {}, main: null, fallback: null, costs: new Map() },
      problems,
    };
  }
  const provider = config.AI_PROVIDER;
  const find = (
    id: string,
    variable: string,
    of: AiProviderName = provider,
  ): AiModelSpec | null => {
    const listed = registry.filter((model) => model.provider === of);
    const spec = listed.find((model) => model.id === id);
    if (!spec) {
      const known = listed.map((model) => model.id).join(', ') || 'none';
      problems.push(
        `${variable} names "${id}", which the model registry does not list for ${of} (it lists ${known})`,
      );
    }
    return spec ?? null;
  };

  const mainId = institute?.model || config.AI_MODEL || (provider === 'fake' ? FAKE_MODEL : '');
  const main = mainId ? find(mainId, institute?.model ? 'model (AI settings)' : 'AI_MODEL') : null;
  const models: Partial<Record<AiTask, AiModelSpec>> = {};
  for (const task of AI_TASKS) {
    const chosen = institute?.taskModels[task];
    const named = chosen ?? config.AI_TASK_MODELS[task];
    const spec = named
      ? find(named, chosen ? `taskModels.${task} (AI settings)` : `AI_TASK_MODELS (${task})`)
      : main;
    if (!spec) continue;
    if (!spec.tasks.includes(task)) {
      problems.push(
        `${spec.id} does not handle the ${task} task: name a model for it in ${chosen ? 'taskModels (AI settings)' : 'AI_TASK_MODELS'}`,
      );
      continue;
    }
    models[task] = spec;
  }

  // The stand-in: another of the provider's own models — or, when the deployment names a fallback
  // provider (ADR-0038), that provider's model, which the deployment alone chooses.
  const standInProvider =
    config.AI_FALLBACK_PROVIDER === 'none' ? provider : config.AI_FALLBACK_PROVIDER;
  const institutesStandIn = standInProvider === provider ? institute?.fallbackModel : null;
  if (institute?.fallbackModel && !institutesStandIn) {
    problems.push(
      `fallbackModel (AI settings) cannot be chosen while the deployment's fallback provider stands in (AI_FALLBACK_PROVIDER=${standInProvider}, AI_FALLBACK_MODEL)`,
    );
  }
  let fallback: AiModelSpec | null = null;
  const fallbackId = institutesStandIn || config.AI_FALLBACK_MODEL;
  const fallbackName = institutesStandIn ? 'fallbackModel (AI settings)' : 'AI_FALLBACK_MODEL';
  if (fallbackId) {
    const spec = find(fallbackId, fallbackName, standInProvider);
    if (spec && !spec.fallback) {
      problems.push(`${fallbackName}: ${spec.id} may not stand in for another model`);
    } else if (spec && spec.id === main?.id) {
      problems.push(
        institute?.fallbackModel || institute?.model
          ? 'fallbackModel (AI settings) must be another model than the default model'
          : 'AI_FALLBACK_MODEL must be another model than AI_MODEL',
      );
    } else {
      fallback = spec;
    }
  }

  // Prices may be kept for every listed model, embedding models included (Phase 8C), whichever
  // provider runs now; a code neither registry knows is a mistake.
  const costs = new Map<string, AiModelCost>();
  for (const [id, cost] of Object.entries(config.AI_MODEL_COSTS)) {
    const listed =
      registry.some((model) => model.id === id) ||
      embeddingRegistry.some((model) => model.id === id);
    if (listed) costs.set(id, cost);
    else problems.push(`AI_MODEL_COSTS names "${id}", which the model registry does not list`);
  }

  // With a monthly budget, every model the router may call needs a price (ADR-0029): a call that
  // could not be counted against the budget would have to be refused, so the start is refused.
  const budget = institute
    ? institute.budget
    : config.AI_ORG_MONTHLY_BUDGET_USD !== null
      ? 'deployment'
      : null;
  if (budget) {
    const routed = new Set([...Object.values(models), ...(fallback ? [fallback] : [])]);
    const setting =
      budget === 'settings' ? 'monthlyBudgetUsd (AI settings)' : 'AI_ORG_MONTHLY_BUDGET_USD';
    for (const model of routed) {
      if (!costs.has(model.id)) {
        problems.push(`${setting} is set, but AI_MODEL_COSTS has no price for ${model.id}`);
      }
    }
  }

  return { routing: { ...base, models, main, fallback, costs }, problems };
}

function hasTaskModels(institute: AiInstituteRouting | null): boolean {
  return Object.values(institute?.taskModels ?? {}).some(Boolean);
}
