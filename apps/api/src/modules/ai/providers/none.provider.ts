import { Injectable } from '@nestjs/common';
import type { AiProviderCapabilities } from '@lms/shared';
import {
  type AiChatDelta,
  type AiChatResult,
  type AiEmbedResult,
  type AiProvider,
  AiUnavailableError,
} from './ai-provider.js';

/**
 * The default provider (ADR-0024): AI is switched off at the source. Every call is refused, the same
 * way every time, and nothing leaves the process.
 */
@Injectable()
export class NoneAiProvider implements AiProvider {
  readonly name = 'none' as const;

  capabilities(): AiProviderCapabilities {
    return { streaming: false, embeddings: false, structuredOutput: false, maxContextTokens: 0 };
  }

  chat(): Promise<AiChatResult> {
    return Promise.reject(new AiUnavailableError());
  }

  stream(): AsyncIterable<AiChatDelta> {
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(new AiUnavailableError()),
      }),
    };
  }

  embed(): Promise<AiEmbedResult> {
    return Promise.reject(new AiUnavailableError());
  }

  health(): Promise<{ ok: boolean; detail?: string }> {
    return Promise.resolve({ ok: false, detail: 'No AI provider is configured' });
  }
}
