import type { AiProviderCapabilities } from '@lms/shared';
import {
  type AiChatDelta,
  type AiChatRequest,
  type AiChatResult,
  type AiProvider,
  AiProviderError,
  AiUnavailableError,
} from '../../src/modules/ai/index.js';

/**
 * A stand-in for the AI provider in the API tests, named `fake` like the local one. Its answer is
 * steered by markers in the question, the way the fake execution driver reads markers in code, so
 * every path through the gateway can be exercised without a network:
 *
 *   (none)        answers "Scripted answer to: …" word by word
 *   @slow         pauses between words (60 ms), so a second question or a cancel can overlap
 *   @fail         fails before writing anything (the provider is unavailable)
 *   @failmid      writes two words, then fails
 *   @malformed    writes a word, then the provider's answer is unreadable
 *   @hang         writes a word, then never finishes (the gateway's deadline ends it)
 *   @blocked      the provider's filters withhold the answer after a word
 *   @length       the answer reaches its length limit
 *   @nousage      the provider reports no token counts
 *
 * Titles and notes (Phase 7D) are answered on their own terms, by markers in what they are written
 * from: a title is "Title: " and the question's first three words (`@titlefail` fails it,
 * `@titleblank` answers nothing usable); notes are "Notes on N messages" (`@notesfail` fails them).
 *
 * Every request is kept, so a test can check exactly what was (and was not) sent.
 */
export class ScriptedAiProvider implements AiProvider {
  readonly name = 'fake' as const;
  readonly requests: AiChatRequest[] = [];

  capabilities(): AiProviderCapabilities {
    return { streaming: true, embeddings: false, structuredOutput: false, maxContextTokens: 8192 };
  }

  async chat(request: AiChatRequest, signal: AbortSignal): Promise<AiChatResult> {
    let result: AiChatResult | null = null;
    for await (const delta of this.stream(request, signal)) {
      if (delta.type === 'done') result = delta.result;
    }
    return result!;
  }

  async *stream(request: AiChatRequest, signal: AbortSignal): AsyncGenerator<AiChatDelta> {
    this.requests.push(request);
    const question = request.messages.at(-1)?.content ?? '';
    const has = (marker: string) => question.includes(marker);
    if (request.task === 'title' || request.task === 'summarize') {
      yield { type: 'done', result: background(request, question) };
      return;
    }
    if (has('@fail') && !has('@failmid')) {
      throw new AiProviderError('unavailable', { httpStatus: 503 });
    }
    const text = `Scripted answer to: ${question.replace(/@\w+/g, '').trim()}`;
    const words = text.split(/(?<= )/);
    let written = '';
    for (const [index, word] of words.entries()) {
      if (signal.aborted) throw signal.reason;
      if (has('@slow')) await pause(60, signal);
      if (index === 2 && has('@failmid'))
        throw new AiProviderError('unavailable', { httpStatus: 503 });
      if (index === 1 && has('@malformed')) {
        throw new AiProviderError('malformed', { reason: 'NOT_JSON' });
      }
      if (index === 1 && has('@hang')) await pause(60_000, signal);
      if (index === 1 && has('@blocked')) break;
      written += word;
      yield { type: 'text', text: word };
    }
    yield {
      type: 'done',
      result: {
        text: written,
        model: request.model ?? 'fake-1',
        finishReason: has('@blocked') ? 'blocked' : has('@length') ? 'length' : 'stop',
        usage: has('@nousage')
          ? { inputTokens: 12, outputTokens: 7, estimated: true }
          : { inputTokens: 40, outputTokens: words.length },
      },
    };
  }

  embed(): Promise<never> {
    return Promise.reject(new AiUnavailableError('Embeddings arrive in Phase 8.'));
  }

  health(): Promise<{ ok: boolean }> {
    return Promise.resolve({ ok: true });
  }
}

/** A title or notes, as the scripted provider writes them (Phase 7D). */
function background(request: AiChatRequest, content: string): AiChatResult {
  if (content.includes(request.task === 'title' ? '@titlefail' : '@notesfail')) {
    throw new AiProviderError('unavailable', { httpStatus: 503 });
  }
  const text =
    request.task === 'title'
      ? content.includes('@titleblank')
        ? '   '
        : `Title: ${content.replace(/@\w+/g, '').trim().split(/\s+/).slice(0, 3).join(' ')}`
      : `Notes on ${content.split('\n').filter((line) => /^(Learner|SI Academy AI): /.test(line)).length} messages`;
  return {
    text,
    model: request.model ?? 'fake-1',
    finishReason: 'stop',
    usage: { inputTokens: 5, outputTokens: 3 },
  };
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
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

/** The events of an answer stream, in order, as a reader would parse them. */
export function parseEvents(text: string): { event: string; data: Record<string, unknown> }[] {
  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const lines = block.split('\n');
      const event = lines.find((l) => l.startsWith('event: '))?.slice(7) ?? 'message';
      const data = lines
        .filter((l) => l.startsWith('data: '))
        .map((l) => l.slice(6))
        .join('\n');
      return { event, data: JSON.parse(data || '{}') as Record<string, unknown> };
    });
}
