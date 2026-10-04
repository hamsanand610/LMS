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

/** The fake's embedding model (Phase 8C). */
export const FAKE_EMBEDDING_MODEL = 'fake-embedding-1';

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
   * vector, of whatever dimension is asked for, and another text another one. No network, no key;
   * tokens are estimated, about four characters each.
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
 * A deterministic unit vector for a text (Phase 8C): SHA-256 of a counter and the text, read two
 * bytes to a component, until the dimension is filled. Not a meaning: a stable stand-in for one.
 */
export function fakeEmbedding(text: string, dimension: number): number[] {
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
