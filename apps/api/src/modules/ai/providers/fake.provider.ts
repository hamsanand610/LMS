import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AiProviderCapabilities } from '@lms/shared';
import { APP_CONFIG, type AppConfig } from '../../../core/config/env.js';
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
 * `AI_FAKE_DELAY_MS` paces the words, so streaming can be watched locally (Phase 7C).
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
    const text = `Fake ${request.task} answer to: ${question.trim().slice(0, 200)}`;
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
