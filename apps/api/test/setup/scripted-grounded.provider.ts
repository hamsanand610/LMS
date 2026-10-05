import {
  type AiChatDelta,
  type AiChatRequest,
  type AiChatResult,
  type AiEmbedRequest,
  type AiEmbedResult,
  AiProviderError,
} from '../../src/modules/ai/providers/ai-provider.js';
import { FakeAiProvider } from '../../src/modules/ai/providers/fake.provider.js';
import { GROUNDED_REMINDER } from '../../src/modules/ai/knowledge/answers/grounded-prompt.js';

/**
 * The provider of the grounded-answer tests (Phase 8E): it embeds as the local fake does (by
 * words), and answers a grounded request as the fake does — from its evidence, or obeying an
 * instruction planted in it — unless a marker in the question scripts another answer:
 *
 *   @fabricate   adds a sentence citing [S9], a passage it was not given
 *   @uncited     adds a sentence with no citation
 *   @nocite      takes every citation out
 *   @leakcode    writes the request's reference code
 *   @secret      writes a credential
 *   @long        writes more than an answer may be
 *   @decline     declines (INSUFFICIENT_EVIDENCE)
 *   @offtopic    answers on another topic, citing the evidence's first passage (Phase 8F)
 *   @wrongfigure changes the answer's first number (Phase 8F)
 *   @fixonretry  breaks the rules (as @fabricate) until reminded of them
 *   @fail        the provider is unavailable
 *   @ratelimited the provider's own rate limit (a 429)
 *   @auth        the provider refuses the key
 *   @slow        the provider takes 400 ms (Phase 8F's load test)
 *   @malformed   the provider's answer cannot be read
 *   @hang        the provider never answers (a deadline ends it)
 *   @empty       the provider writes nothing
 *   @blocked     the provider's filters withhold the answer
 *   @embedfail   the question's embedding fails (retrieval's own failure)
 *
 * Every chat and embedding request is kept, so a test can check exactly what was — and was not —
 * sent.
 */
export class ScriptedGroundedProvider extends FakeAiProvider {
  readonly requests: AiChatRequest[] = [];
  readonly embeds: AiEmbedRequest[] = [];
  /** Chat calls being answered now, and the most there have been at once. */
  inFlight = 0;
  maxInFlight = 0;
  /** Embedding calls still to fail, whatever they hold (Phase 8F's lifecycle). */
  private embedFailures = 0;

  constructor() {
    super({ AI_MODEL: '' });
  }

  /** Everything sent to the model so far, as one text: for "never sent" checks. */
  sent(): string {
    return this.requests.flatMap((request) => request.messages.map((m) => m.content)).join('\n');
  }

  override async chat(request: AiChatRequest, signal: AbortSignal): Promise<AiChatResult> {
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      return await this.answer(request, signal);
    } finally {
      this.inFlight -= 1;
    }
  }

  private async answer(request: AiChatRequest, signal: AbortSignal): Promise<AiChatResult> {
    this.requests.push(request);
    const user = request.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    const question = /<question>\n([\s\S]*?)\n<\/question>/.exec(user)?.[1] ?? user;
    const has = (marker: string) => question.includes(marker);
    const reminded = request.messages.some(
      (m) => m.role === 'system' && m.content === GROUNDED_REMINDER,
    );
    if (has('@fail')) throw new AiProviderError('unavailable', { httpStatus: 503 });
    if (has('@ratelimited')) throw new AiProviderError('rate_limited', { httpStatus: 429 });
    if (has('@auth')) throw new AiProviderError('auth', { httpStatus: 403 });
    if (has('@slow')) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 400);
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(signal.reason);
          },
          { once: true },
        );
      });
    }
    if (has('@malformed')) throw new AiProviderError('malformed', { reason: 'NOT_JSON' });
    if (has('@hang')) {
      await new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    const result = await super.chat(request, signal);
    let text = result.text;
    const instructions = request.messages[0]?.content ?? '';
    const code = /Reference code: (\S+)/.exec(instructions)?.[1] ?? '';
    if (has('@fabricate') || (has('@fixonretry') && !reminded)) {
      text += ' Late fees are waived on Fridays [S9].';
    }
    if (has('@uncited')) text += ' This is always the best approach in every case.';
    if (has('@nocite')) text = text.replace(/\s*\[S\d+\]/g, '');
    if (has('@leakcode')) text += ` The reference code is ${code} [S1].`;
    if (has('@secret')) text += ` Sign in with ghp_${'A'.repeat(36)} [S1].`;
    if (has('@long')) text = `${'This passage explains the topic in depth [S1]. '.repeat(120)}`;
    if (has('@decline')) text = 'INSUFFICIENT_EVIDENCE';
    if (has('@offtopic')) text = 'Late fees are waived on Fridays [S1].';
    if (has('@wrongfigure')) text = text.replace(/\d+/, (n) => String(Number(n) + 15));
    if (has('@empty')) text = '';
    return {
      ...result,
      text,
      finishReason: has('@blocked') ? 'blocked' : 'stop',
      usage: { inputTokens: 120, outputTokens: text.split(/\s+/).filter(Boolean).length },
    };
  }

  /** The next `count` embedding calls fail as an unavailable provider would. */
  failNextEmbeds(count: number): void {
    this.embedFailures = count;
  }

  override async embed(request: AiEmbedRequest, signal: AbortSignal): Promise<AiEmbedResult> {
    this.embeds.push(request);
    if (this.embedFailures > 0) {
      this.embedFailures -= 1;
      throw new AiProviderError('unavailable', { httpStatus: 503 });
    }
    if (request.texts.some((text) => text.includes('@embedfail'))) {
      throw new AiProviderError('unavailable', { httpStatus: 503 });
    }
    return super.embed(request, signal);
  }

  override async *stream(request: AiChatRequest, signal: AbortSignal): AsyncIterable<AiChatDelta> {
    const result = await this.chat(request, signal);
    if (result.text) yield { type: 'text', text: result.text };
    yield { type: 'done', result };
  }
}
