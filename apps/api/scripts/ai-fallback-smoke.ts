/**
 * A live check of Groq standing in for Gemini (ADR-0038), for a developer with both keys: synthetic
 * passages and a question, sent through the platform's own grounded prompt, model router and
 * adapters, and judged by the platform's own answer check. It prints how each case ended — the
 * provider and model that answered, whether it was the stand-in, the check's verdict, the latency
 * and the tokens — and never a key or the prompt:
 *
 *   AI_PROVIDER=gemini, GEMINI_API_KEY, AI_MODEL, AI_FALLBACK_PROVIDER=groq, GROQ_API_KEY and
 *   AI_FALLBACK_MODEL set (in apps/api/.env or the environment), and --confirm:
 *   pnpm --filter @lms/api ai:fallback-smoke -- --confirm [--gemini]
 *
 * 1. Groq on its own: one call.
 * 2. A controlled Gemini failure: the router's Gemini fails as an overloaded service does, before
 *    any call — no Gemini quota is used — and Groq answers in its place: one Groq call.
 * 3. With --gemini only: the same request through the real Gemini first — one call — and Groq only
 *    if Gemini fails for a reason that may pass.
 *
 * It sends nothing but the synthetic text below: no learner data, no knowledge base content.
 * Without the configuration it calls nothing and says so.
 */
import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { loadConfig } from '../src/core/config/env.js';
import { KNOWLEDGE_ANSWER_LIMITS } from '../src/modules/ai/knowledge/answers/evidence.js';
import {
  GROUNDED_PROMPT_VERSION,
  INSTRUCTION_FINGERPRINTS,
  groundedMessages,
  type EvidencePassage,
} from '../src/modules/ai/knowledge/answers/grounded-prompt.js';
import { checkAnswer } from '../src/modules/ai/knowledge/answers/validation.js';
import {
  type AiChatDelta,
  type AiChatRequest,
  type AiChatResult,
  type AiEmbedRequest,
  type AiEmbedResult,
  type AiProvider,
  AiProviderError,
} from '../src/modules/ai/providers/ai-provider.js';
import { GeminiAiProvider } from '../src/modules/ai/providers/gemini.provider.js';
import { GroqAiProvider } from '../src/modules/ai/providers/groq.provider.js';
import { AiCircuitBreakers } from '../src/modules/ai/routing/circuit-breaker.js';
import {
  AI_EMBEDDING_MODEL_REGISTRY,
  AI_MODEL_REGISTRY,
} from '../src/modules/ai/routing/model-registry.js';
import {
  type AiAttempt,
  type AiRoutedChatRequest,
  ModelRouter,
} from '../src/modules/ai/routing/model-router.js';

const passage = (id: string, document: string, content: string): EvidencePassage => ({
  id,
  source: 'Synthetic handbook',
  document,
  heading: document,
  content,
});
const PASSAGES = [
  passage(
    'S1',
    'Observatory',
    'The rooftop observatory opens for stargazing on clear Thursday evenings from eight.',
  ),
  passage('S2', 'Observatory', 'Visitors to the observatory must bring a red-light torch.'),
];
const QUESTION = 'When does the rooftop observatory open for stargazing?';

/** Gemini, as an overloaded service fails it: no call is made, so no quota is used. */
class OverloadedGemini implements AiProvider {
  readonly name = 'gemini' as const;
  calls = 0;
  constructor(private readonly real: AiProvider) {}
  capabilities() {
    return this.real.capabilities();
  }
  chat(): Promise<AiChatResult> {
    this.calls += 1;
    return Promise.reject(new AiProviderError('unavailable', { reason: 'SIMULATED_OVERLOAD' }));
  }
  // eslint-disable-next-line require-yield
  async *stream(): AsyncGenerator<AiChatDelta> {
    this.calls += 1;
    throw new AiProviderError('unavailable', { reason: 'SIMULATED_OVERLOAD' });
  }
  embed(request: AiEmbedRequest, signal: AbortSignal): Promise<AiEmbedResult> {
    return this.real.embed(request, signal);
  }
  health() {
    return this.real.health();
  }
}

const config = loadConfig();
if (
  config.AI_PROVIDER !== 'gemini' ||
  config.AI_FALLBACK_PROVIDER !== 'groq' ||
  !config.GEMINI_API_KEY ||
  !config.GROQ_API_KEY
) {
  console.log(
    'Gemini → Groq fallback smoke: NOT CONFIGURED — nothing was called. Set AI_PROVIDER=gemini, AI_FALLBACK_PROVIDER=groq, both keys, AI_MODEL and AI_FALLBACK_MODEL, then run with --confirm.',
  );
  process.exit(0);
}
if (!process.argv.includes('--confirm')) {
  console.error(
    'Refused: this calls Groq (and with --gemini, Gemini) with your keys. Run again with --confirm.',
  );
  process.exit(2);
}
// The router's own log lines go nowhere: this script prints its own summary.
Logger.overrideLogger(false);

const gemini = new GeminiAiProvider(config);
const groq = new GroqAiProvider(config);
const code = randomBytes(12).toString('base64url');
const messages = groundedMessages(PASSAGES, QUESTION, code);
const checks = {
  ids: new Set(PASSAGES.map((p) => p.id)),
  secrets: [code, ...INSTRUCTION_FINGERPRINTS],
  maxCharacters: KNOWLEDGE_ANSWER_LIMITS.answerCharacters,
  passages: new Map(PASSAGES.map((p) => [p.id, `${p.document}\n${p.heading}\n${p.content}`])),
};
/** Every call the router made for the case being run, in order: who, and how it ended. */
const attempts: AiAttempt[] = [];
const routed: AiRoutedChatRequest = {
  task: 'chat',
  feature: 'knowledge',
  dataClass: 'public',
  userId: 'smoke',
  organizationId: 'smoke',
  messages,
  maxOutputTokens: Math.min(config.AI_MAX_OUTPUT_TOKENS, KNOWLEDGE_ANSWER_LIMITS.outputTokens),
  temperature: KNOWLEDGE_ANSWER_LIMITS.temperature,
  onAttempt: (attempt) => attempts.push(attempt),
};
const calls = () =>
  attempts
    .splice(0)
    .map((a) => `${a.provider} ${a.model} ${a.outcome}${a.fallback ? ' (stand-in)' : ''}`)
    .join(' → ');
const routerWith = (primary: AiProvider) =>
  new ModelRouter(
    config,
    primary,
    AI_MODEL_REGISTRY,
    new AiCircuitBreakers(),
    AI_EMBEDDING_MODEL_REGISTRY,
    groq,
  );

const failures: string[] = [];
function report(
  name: string,
  outcome: { provider: string; model: string; fallback: boolean; result: AiChatResult; ms: number },
  expect: { provider: string; fallback: boolean },
) {
  const checked =
    outcome.result.finishReason === 'blocked'
      ? ({ ok: false, fault: 'blocked' } as const)
      : checkAnswer(outcome.result.text, checks);
  const verdict = checked.ok ? checked.kind : `withheld (${checked.fault})`;
  const cited = checked.ok && checked.kind !== 'declined' ? checked.cited : [];
  const passed =
    checked.ok &&
    checked.kind === 'answer' &&
    cited.includes('S1') &&
    outcome.provider === expect.provider &&
    outcome.fallback === expect.fallback;
  if (!passed) failures.push(name);
  console.log(`\n${passed ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(
    `  answered by    ${outcome.provider} ${outcome.model}${outcome.fallback ? ' (the stand-in)' : ''}`,
  );
  console.log(`  check          ${verdict}${cited.length ? ` citing ${cited.join(', ')}` : ''}`);
  console.log(`  finish         ${outcome.result.finishReason}`);
  console.log(`  latency        ${outcome.ms} ms`);
  console.log(
    `  tokens         ${outcome.result.usage.inputTokens} in, ${outcome.result.usage.outputTokens} out${outcome.result.usage.estimated ? ' (estimated)' : ' (reported)'}`,
  );
  if (checked.ok && checked.kind !== 'declined') {
    console.log(`  answer         ${checked.text.slice(0, 200)}`);
  }
  const made = calls();
  if (made) console.log(`  calls          ${made}`);
}

function failed(name: string, error: unknown) {
  failures.push(name);
  console.log(`\nFAIL  ${name}`);
  if (error instanceof AiProviderError) {
    console.log(
      `  failed         ${error.target?.provider ?? '?'} ${error.target?.model ?? ''}: ${error.kind}`,
      error.diagnostics,
    );
  } else {
    console.log(`  failed         before the provider answered: ${(error as Error).name}`);
  }
  const made = calls();
  if (made) console.log(`  calls          ${made}`);
}

console.log(`main model       ${config.AI_MODEL} (gemini)`);
console.log(`stand-in model   ${config.AI_FALLBACK_MODEL} (groq)`);
console.log(`prompt version   ${GROUNDED_PROMPT_VERSION}`);

// 1. Groq on its own.
{
  const name = 'Groq on its own';
  const started = performance.now();
  try {
    const request: AiChatRequest = {
      task: 'chat',
      messages,
      model: config.AI_FALLBACK_MODEL,
      maxOutputTokens: routed.maxOutputTokens,
      temperature: routed.temperature,
    };
    const result = await groq.chat(request, AbortSignal.timeout(config.AI_TIMEOUT_MS));
    report(
      name,
      {
        provider: 'groq',
        model: result.model,
        fallback: false,
        result,
        ms: Math.round(performance.now() - started),
      },
      { provider: 'groq', fallback: false },
    );
  } catch (error) {
    failed(name, error);
  }
}

// 2. A controlled Gemini failure: Groq stands in.
{
  const name = 'Gemini overloaded (simulated, no Gemini call) → Groq stands in';
  const overloaded = new OverloadedGemini(gemini);
  const started = performance.now();
  try {
    const result = await routerWith(overloaded).chat(
      routed,
      AbortSignal.timeout(config.AI_TIMEOUT_MS * 3),
    );
    report(
      name,
      { ...result, result, ms: Math.round(performance.now() - started) },
      { provider: 'groq', fallback: true },
    );
  } catch (error) {
    failed(name, error);
  }
}

// 3. The real Gemini first, Groq only if Gemini fails for a reason that may pass.
if (process.argv.includes('--gemini')) {
  const name = 'Gemini first (one real call), Groq only if it fails';
  const started = performance.now();
  try {
    const result = await routerWith(gemini).chat(
      routed,
      AbortSignal.timeout(config.AI_TIMEOUT_MS * 3),
    );
    report(
      name,
      { ...result, result, ms: Math.round(performance.now() - started) },
      { provider: result.provider, fallback: result.fallback },
    );
    console.log(
      result.fallback
        ? '  note           Gemini failed for a reason that may pass: Groq answered in its place'
        : '  note           Gemini answered: Groq was not called',
    );
  } catch (error) {
    failed(name, error);
  }
}

console.log(
  failures.length === 0
    ? '\nSUCCESS  every case as expected'
    : `\nFAILURE  not as expected: ${failures.join('; ')}`,
);
process.exit(failures.length === 0 ? 0 : 1);
