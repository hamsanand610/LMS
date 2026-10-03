import { Inject, Injectable } from '@nestjs/common';
import type { AiProviderCapabilities } from '@lms/shared';
import { APP_CONFIG, type AppConfig } from '../../../core/config/env.js';
import {
  type AiChatDelta,
  type AiChatMessage,
  type AiChatRequest,
  type AiChatResult,
  type AiEmbedResult,
  type AiProvider,
  AiUnavailableError,
} from './ai-provider.js';

/** The model name the fake reports when none is configured. */
export const FAKE_MODEL = 'fake-1';

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
    return { streaming: true, embeddings: false, structuredOutput: false, maxContextTokens: 8192 };
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

  /** Embeddings belong to Phase 8 (ADR-0027); the fake does not pretend otherwise. */
  embed(): Promise<AiEmbedResult> {
    return Promise.reject(new AiUnavailableError('Embeddings arrive in Phase 8.'));
  }

  health(): Promise<{ ok: boolean; detail?: string }> {
    return Promise.resolve({ ok: true });
  }
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
