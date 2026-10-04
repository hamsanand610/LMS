/**
 * A live check of Gemini embeddings (Roadmap Phase 8C; ADR-0035), for a developer with their own
 * key: three synthetic sentences, embedded through the platform's own adapter at the configured
 * model and dimension. It prints what the vectors are like — never a vector, never the key, never
 * the provider's own words — and refuses unless asked plainly:
 *
 *   AI_PROVIDER=gemini, GEMINI_API_KEY set (in apps/api/.env or the environment), and --confirm:
 *   pnpm --filter @lms/api ai:embed-smoke -- --confirm
 *
 * It sends nothing but the sentences below: no learner data, no knowledge base content.
 */
import { loadConfig } from '../src/core/config/env.js';
import { AiProviderError } from '../src/modules/ai/providers/ai-provider.js';
import { GeminiAiProvider } from '../src/modules/ai/providers/gemini.provider.js';
import {
  AI_EMBEDDING_MODEL_REGISTRY,
  resolveEmbeddingRouting,
} from '../src/modules/ai/routing/model-registry.js';

const SENTENCES = [
  'Inheritance lets one class reuse the fields and methods of another.',
  'A loop repeats a block of code while its condition holds.',
  'Inheritance lets one class reuse the fields and methods of another.',
];

const config = loadConfig();
if (
  config.AI_PROVIDER !== 'gemini' ||
  !config.GEMINI_API_KEY ||
  !process.argv.includes('--confirm')
) {
  console.error(
    'Refused: this calls Gemini with your key. Set AI_PROVIDER=gemini and GEMINI_API_KEY, then run with --confirm.',
  );
  process.exit(2);
}
const { routing, problems } = resolveEmbeddingRouting(config, AI_EMBEDDING_MODEL_REGISTRY);
if (!routing || problems.length > 0) {
  console.error(
    `The embedding configuration is not usable:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
  );
  process.exit(2);
}

const provider = new GeminiAiProvider(config);
const cosine = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i]!, 0);
try {
  const started = performance.now();
  const result = await provider.embed(
    {
      texts: SENTENCES,
      model: routing.model.id,
      purpose: 'document',
      dimension: routing.dimension,
    },
    AbortSignal.timeout(config.AI_TIMEOUT_MS),
  );
  const [first, second, third] = result.vectors as [number[], number[], number[]];
  console.log(`model            ${result.model}`);
  console.log(`vectors          ${result.vectors.length} (asked ${SENTENCES.length})`);
  console.log(
    `dimension        ${result.vectors.map((v) => v.length).join(', ')} (asked ${routing.dimension})`,
  );
  console.log(
    `unit length      ${result.vectors.map((v) => Math.hypot(...v).toFixed(6)).join(', ')}`,
  );
  console.log(`same sentence    cosine ${cosine(first, third).toFixed(6)} (near 1 expected)`);
  console.log(`other sentence   cosine ${cosine(first, second).toFixed(6)} (lower expected)`);
  console.log(
    `input tokens     ${result.usage.inputTokens}${result.usage.estimated ? ' (estimated)' : ' (reported by Gemini)'}`,
  );
  console.log(`latency          ${Math.round(performance.now() - started)} ms`);
} catch (error) {
  if (error instanceof AiProviderError) {
    console.error(`Gemini refused or failed: ${error.kind}`, error.diagnostics);
  } else {
    console.error('The call failed before Gemini answered:', (error as Error).name);
  }
  process.exit(1);
}
