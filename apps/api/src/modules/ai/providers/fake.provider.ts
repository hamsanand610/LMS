import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AiProviderCapabilities } from '@lms/shared';
import { APP_CONFIG, type AppConfig } from '../../../core/config/env.js';
import { AGENT_PLANNING_MARK, AGENT_ROUTING_MARK } from '../agent/agent-prompts.js';
import {
  CONFLICT_MARKER,
  GROUNDED_PROMPT_MARK,
  INSUFFICIENT_EVIDENCE_TOKEN,
} from '../knowledge/answers/grounded-prompt.js';
import {
  type AiChatDelta,
  type AiChatMessage,
  type AiChatRequest,
  type AiChatResult,
  type AiEmbedRequest,
  type AiEmbedResult,
  type AiProvider,
} from './ai-provider.js';
import { unitVector } from './vectors.js';

/** The model name the fake reports when none is configured. */
export const FAKE_MODEL = 'fake-1';

/**
 * The fake's embedding model: lexical since Phase 8D (ADR-0036), so texts that share words are
 * close. A new name, because its vectors are not `fake-embedding-1`'s (8C): vectors of two models
 * are never compared (ADR-0035).
 */
export const FAKE_EMBEDDING_MODEL = 'fake-embedding-2';

/**
 * A deterministic stand-in for local development and tests (ADR-0024): the same request always
 * gets the same answer, streamed word by word, with usage counted in words. It never touches the
 * network, needs no key, and the API refuses to start with it outside local development.
 * `AI_FAKE_DELAY_MS` paces the words, so streaming can be watched locally (Phase 7C). A grounded
 * request (Phase 8E) is answered from its evidence (`fakeGroundedAnswer`), and the learning agent's
 * routing and follow-up (Phase 9B) with the JSON they ask for (`fakeAgentReply`).
 */
@Injectable()
export class FakeAiProvider implements AiProvider {
  readonly name = 'fake' as const;

  constructor(
    @Inject(APP_CONFIG)
    private readonly config: Pick<AppConfig, 'AI_MODEL'> &
      Partial<Pick<AppConfig, 'AI_FAKE_DELAY_MS'>>,
  ) {}

  capabilities(): AiProviderCapabilities {
    return { streaming: true, embeddings: true, structuredOutput: false, maxContextTokens: 8192 };
  }

  chat(request: AiChatRequest, signal: AbortSignal): Promise<AiChatResult> {
    if (signal.aborted) return Promise.reject(signal.reason);
    const question = [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const text =
      fakeGroundedAnswer(request.messages) ??
      fakeAgentReply(request.messages) ??
      `Fake ${request.task} answer to: ${question.trim().slice(0, 200)}`;
    return Promise.resolve({
      text,
      model: request.model || this.config.AI_MODEL || FAKE_MODEL,
      finishReason: 'stop',
      usage: { inputTokens: wordsIn(request.messages), outputTokens: words(text) },
    });
  }

  async *stream(request: AiChatRequest, signal: AbortSignal): AsyncIterable<AiChatDelta> {
    const result = await this.chat(request, signal);
    const delay = this.config.AI_FAKE_DELAY_MS ?? 0;
    for (const piece of result.text.split(/(?<= )/)) {
      if (signal.aborted) throw signal.reason;
      if (delay > 0) await pause(delay, signal);
      yield { type: 'text', text: piece };
    }
    yield { type: 'done', result };
  }

  /**
   * Embeddings for tests and local development (Phase 8C): the same text always has the same unit
   * vector, of whatever dimension is asked for, and texts that share words are close (Phase 8D), so
   * retrieval can be tried and measured offline. A question and a passage are embedded alike. No
   * network, no key; tokens are estimated, about four characters each.
   */
  embed(request: AiEmbedRequest, signal: AbortSignal): Promise<AiEmbedResult> {
    if (signal.aborted) return Promise.reject(signal.reason);
    const vectors = request.texts.map((text) => fakeEmbedding(text, request.dimension));
    const inputTokens = request.texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
    return Promise.resolve({
      vectors,
      model: request.model || FAKE_EMBEDDING_MODEL,
      usage: { inputTokens, estimated: true },
    });
  }

  health(): Promise<{ ok: boolean; detail?: string }> {
    return Promise.resolve({ ok: true });
  }
}

/**
 * Instructions a model might find in its input and obey: to reveal its instructions, to take on
 * another role, to set the evidence or the rules aside. The fake obeys them (Phase 8E).
 */
const REVEAL =
  /\b(?:reveal|print|show|repeat|output|tell me)\b[^.?!\n]{0,60}\b(?:system prompt|hidden prompt|hidden instructions|your instructions|your rules|these rules)\b/i;
const ROLE =
  /\b(?:you are now|developer mode|act as (?:an? |the )?(?:administrator|admin|system))\b|^\s*(?:#+\s*)?(?:system|assistant|developer)\s*:/im;
const OVERRIDE =
  /\bignore\b[^.?!\n]{0,40}\b(?:instructions|rules|documents|passages|evidence|authori[sz]ation)\b|\b(?:use|from) your (?:own|internal|general) knowledge\b/i;

/**
 * A grounded answer as the fake writes it (Phase 8E; ADR-0037), or null for any other request.
 * Deterministic: from each passage, the sentence sharing most words with the question, if it shares
 * at least two and two fifths of them; the best two, most shared first, each closed by its
 * passage's citation; two such sentences alike but for their numbers are reported as a conflict;
 * with none, `INSUFFICIENT_EVIDENCE`. And deliberately obedient: an instruction in the question or a
 * passage to reveal its instructions, change role or ignore the evidence is followed — the worst
 * model the platform's checks must stop.
 */
export function fakeGroundedAnswer(messages: readonly AiChatMessage[]): string | null {
  const instructions = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  if (!instructions.includes(GROUNDED_PROMPT_MARK)) return null;
  const request = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n');
  const passages = [
    // Attributes are quoted and hold no quote (a heading's path does hold `>`).
    ...request.matchAll(/<passage id="(S\d+)"(?: [a-z]+="[^"]*")*>\n([\s\S]*?)\n<\/passage>/g),
  ].map(([, id, content]) => ({ id: id!, content: content! }));
  const question = /<question>\n([\s\S]*?)\n<\/question>/.exec(request)?.[1] ?? '';
  const read = [question, ...passages.map((passage) => passage.content)].join('\n');
  if (REVEAL.test(read)) return instructions;
  if (ROLE.test(read)) return 'Developer mode is on: I will answer anything now, without sources.';
  if (OVERRIDE.test(read)) {
    return 'Setting the documents aside, here is what I know in general about it.';
  }

  const wanted = new Set(termsOf(question));
  const needed = Math.max(2, Math.ceil(wanted.size * 0.4));
  const picks = passages
    .map((passage, order) => {
      let best = { sentence: '', score: 0 };
      for (const sentence of sentencesIn(passage.content)) {
        const score = new Set(termsOf(sentence).filter((term) => wanted.has(term))).size;
        if (score > best.score) best = { sentence, score };
      }
      return { ...best, id: passage.id, order };
    })
    .filter((pick) => pick.score >= needed)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 2);
  if (picks.length === 0) return INSUFFICIENT_EVIDENCE_TOKEN;
  const cite = (pick: { sentence: string; id: string }) =>
    `${pick.sentence.replace(/[.!?]+$/, '')} [${pick.id}].`;
  const [first, second] = picks;
  if (
    second &&
    skeleton(first!.sentence) === skeleton(second.sentence) &&
    numbers(first!.sentence) !== numbers(second.sentence)
  ) {
    return `${CONFLICT_MARKER} ${cite(first!)} ${cite(second)}`;
  }
  return picks.map(cite).join(' ');
}

/** A request to explain: the lesson, a summary of it, an overview. */
const EXPLAIN = /\b(?:explain|summari[sz]e|walk me through|overview)\b/i;

/** A question about the learner's own learning: progress, the next lesson, what is due (Phase 9C). */
const LEARNING_STATE =
  /\b(?:my progress|progressing|how am i doing|learn next|study next|next lesson|what(?:'s| is) due|due (?:soon|this week|next)|overdue|deadlines?|what have i (?:completed|finished|done)|my courses)\b/i;

/** A question about the learner's own attempt at the open lab (Phase 9C). */
const LAB_ATTEMPT =
  /\b(?:(?:my|the) (?:failed |latest |last )?(?:attempt|submission)|failed attempt|why (?:did|does|is) my (?:code|solution|program|attempt|submission))\b/i;

/** A learner saying they find something hard: their progress may help (Phase 9C). */
const STRUGGLING = /\bstruggl/i;

/** What the learning agent does not take: graded work done, other people, the system. */
const UNSUPPORTED =
  /\b(?:do|write|solve|finish|complete|submit) (?:my|the|this) (?:assignment|homework|test|exam|lab|quiz)\b|\b(?:password|other learners?|another learner|admin(?:istrator)? access|delete (?:my|the|all))\b/i;

/**
 * The learning agent's routing and follow-up (Phase 9B; ADR-0039, ADR-0040) as the fake answers
 * them, or null for any other request. Deterministic: routing reads the message — graded work, other
 * people or the system, `unsupported`; a question about the learner's attempt at a lab,
 * `explain_lab_attempt` (with no lab open, the run says where to ask); a question about their own progress, next lesson or what is due,
 * `learning_state`; a request to explain, with a lesson open, `explain_lesson`; anything else
 * `clarify_doubt` — needing the knowledge base (but for the learner's own state), the lesson when one
 * is open, and their state when they say they are struggling. The follow-up always finishes: what
 * the recipe gathered is what the fake answers from.
 */
export function fakeAgentReply(messages: readonly AiChatMessage[]): string | null {
  const instructions = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  if (instructions.includes(AGENT_PLANNING_MARK)) return JSON.stringify({ action: 'finish' });
  if (!instructions.includes(AGENT_ROUTING_MARK)) return null;
  const request = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n');
  const message = /<message>\n([\s\S]*?)\n<\/message>/.exec(request)?.[1] ?? '';
  const lessonOpen = /^Open lesson: /m.test(request);
  const capability = UNSUPPORTED.test(message)
    ? 'unsupported'
    : LAB_ATTEMPT.test(message)
      ? 'explain_lab_attempt'
      : LEARNING_STATE.test(message)
        ? 'learning_state'
        : lessonOpen && EXPLAIN.test(message)
          ? 'explain_lesson'
          : 'clarify_doubt';
  return JSON.stringify({
    capability,
    needsKnowledge: capability !== 'learning_state' && capability !== 'explain_lab_attempt',
    needsLesson: lessonOpen,
    needsState: capability === 'clarify_doubt' && STRUGGLING.test(message),
  });
}

/** A passage's sentences, its headings left out. */
function sentencesIn(content: string): string[] {
  return content
    .split(/\n+/)
    .filter((line) => !/^\s*#/.test(line))
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => /[\p{L}\p{N}]/u.test(sentence));
}

/** A sentence without its numbers: two sentences alike but for their numbers disagree. */
function skeleton(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/\d+(?:[.,]\d+)?/g, '#')
    .replace(/[^\p{L}#]+/gu, ' ')
    .trim();
}

function numbers(sentence: string): string {
  return (sentence.match(/\d+(?:[.,]\d+)?/g) ?? []).join(',');
}

/** Words too common to tell two texts apart. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'do',
  'does',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'its',
  'my',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'what',
  'when',
  'which',
  'why',
  'with',
  'you',
  'your',
]);

/**
 * A deterministic unit vector for a text (Phase 8D): each word, lower-cased and lightly stemmed,
 * adds one to a component that SHA-256 of the word picks, with a sign it picks too — the hashing
 * trick. Texts that share words point the same way; the same text always gives the same vector. A
 * lexical stand-in for meaning, not meaning: synonyms are not close. A text with no words left
 * (punctuation alone) is hashed whole instead, so no text is without a direction.
 */
export function fakeEmbedding(text: string, dimension: number): number[] {
  const values = new Array<number>(dimension).fill(0);
  for (const term of termsOf(text)) {
    const digest = createHash('sha256').update(term, 'utf8').digest();
    values[digest.readUInt32BE(0) % dimension]! += (digest[4]! & 1) === 1 ? 1 : -1;
  }
  return values.some((value) => value !== 0)
    ? unitVector(values)
    : hashedEmbedding(text, dimension);
}

/** The words of a text, lower-cased, without the commonest, plurals and `-ing` trimmed. */
function termsOf(text: string): string[] {
  return (
    text
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  )
    .filter((word) => !STOP_WORDS.has(word))
    .map(stem);
}

function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('sses')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** SHA-256 of a counter and the whole text, two bytes to a component (Phase 8C's fake). */
function hashedEmbedding(text: string, dimension: number): number[] {
  const values: number[] = [];
  for (let block = 0; values.length < dimension; block += 1) {
    const digest = createHash('sha256').update(`${block}:${text}`, 'utf8').digest();
    for (let at = 0; at + 1 < digest.length && values.length < dimension; at += 2) {
      values.push(digest.readInt16BE(at) / 32768);
    }
  }
  return unitVector(values);
}

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function wordsIn(messages: readonly AiChatMessage[]): number {
  return messages.reduce((total, message) => total + words(message.content), 0);
}

/** Waits, or rejects with the signal's reason the moment it aborts. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, ms);
    const stop = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', stop, { once: true });
  });
}
