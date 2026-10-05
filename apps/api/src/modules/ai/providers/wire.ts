import { AiProviderError } from './ai-provider.js';

/**
 * What every HTTP provider adapter reads its answers with (ADR-0024): JSON, and server-sent events.
 * Each provider's own wire format stays in its own module (`gemini.wire.ts`, `groq.wire.ts`).
 */

/** JSON text as a value, or undefined when it is not JSON. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * The `data:` payloads of a server-sent event stream, one per event, however the bytes arrive.
 * Bounded: an event larger than `maxEventCharacters` is unreadable. The stream is cancelled when
 * the reader stops early, so the connection does not linger.
 */
export async function* sseData(
  body: ReadableStream<Uint8Array>,
  maxEventCharacters: number,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  let size = 0;
  const take = (line: string): string | undefined => {
    const text = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (text === '') {
      if (data.length === 0) return undefined;
      const payload = data.join('\n');
      data = [];
      size = 0;
      return payload;
    }
    if (text.startsWith('data:')) {
      const value = text.slice(5).replace(/^ /, '');
      size += value.length;
      data.push(value);
    }
    // Comments (`:`) and the other fields (`event:`, `id:`, `retry:`) are not used by these APIs.
    return undefined;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const payload = take(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (payload !== undefined) yield payload;
        newline = buffer.indexOf('\n');
      }
      if (size + buffer.length > maxEventCharacters) {
        throw new AiProviderError('malformed', { reason: 'EVENT_TOO_LARGE' });
      }
      if (done) break;
    }
    // A last event without its closing blank line still counts.
    const last = take(buffer) ?? take('');
    if (last !== undefined) yield last;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/** A `Retry-After` header's seconds (or a provider's `"37s"`), capped at an hour; else undefined. */
export function retryAfterSeconds(value: string | null | undefined): number | undefined {
  const match = typeof value === 'string' ? /^(\d{1,6}(?:\.\d+)?)s?$/.exec(value.trim()) : null;
  return match ? Math.min(3600, Math.ceil(Number(match[1]))) : undefined;
}
