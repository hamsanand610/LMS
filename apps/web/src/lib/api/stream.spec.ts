import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { readEvents, streamApi, type StreamEvent } from './stream';

function bytes(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function all(stream: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const event of stream) out.push(event);
  return out;
}

describe('reading server-sent events (Phase 7C)', () => {
  it('reads each event, however the bytes are split', async () => {
    const text =
      'event: meta\ndata: {"conversationId":"c"}\n\nevent: delta\ndata: {"text":"Hel"}\n\nevent: delta\ndata: {"text":"lo"}\n\nevent: done\ndata: {"status":"complete"}\n\n';
    const whole = await all(readEvents(bytes(text)));
    const split = await all(readEvents(bytes(...text.match(/[\s\S]{1,7}/g)!)));
    expect(split).toEqual(whole);
    expect(whole.map((e) => e.event)).toEqual(['meta', 'delta', 'delta', 'done']);
    expect(whole[1]).toEqual({ event: 'delta', data: { text: 'Hel' } });
  });

  it('accepts CRLF line ends, comments, and a last event without its blank line', async () => {
    const events = await all(
      readEvents(
        bytes(
          ': hello\r\n\r\nevent: ping\r',
          '\ndata: {}\r\n\r\nevent: done\ndata: {"status":"failed"}',
        ),
      ),
    );
    expect(events).toEqual([
      { event: 'ping', data: {} },
      { event: 'done', data: { status: 'failed' } },
    ]);
  });

  it('skips a block with no data or unreadable data rather than failing the stream', async () => {
    const events = await all(
      readEvents(
        bytes('event: delta\n\nevent: delta\ndata: {nope\n\nevent: delta\ndata: {"text":"ok"}\n\n'),
      ),
    );
    expect(events).toEqual([{ event: 'delta', data: { text: 'ok' } }]);
  });
});

describe('streaming a POST (Phase 7C)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends cookies and the CSRF header, and hands the events over', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('event: done\ndata: {"status":"complete"}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    const events = await all(streamApi('/ai/conversations/c/messages', { content: 'Hi' }));
    expect(events).toEqual([{ event: 'done', data: { status: 'complete' } }]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/v1\/ai\/conversations\/c\/messages$/);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: '{"content":"Hi"}',
    });
    expect(new Headers(init?.headers).has('X-CSRF-Token')).toBe(true);
  });

  it('turns a refusal before the stream into an ApiError with the problem', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'urn:lms:error:ai_generation_in_progress',
          title: 'Conflict',
          status: 409,
          code: 'ai_generation_in_progress',
          detail: 'Your last question is still being answered.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );
    const error = await all(streamApi('/ai/conversations/c/messages', { content: 'Hi' })).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('ai_generation_in_progress');
    expect((error as ApiError).message).toBe('Your last question is still being answered.');
  });

  it('refreshes the session once on 401, then asks again', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('event: done\ndata: {"status":"complete"}\n\n'));
    const events = await all(streamApi('/ai/conversations/c/messages', { content: 'Hi' }));
    expect(events).toHaveLength(1);
    expect(fetchMock.mock.calls.map(([url]) => String(url).replace(/^.*\/api\/v1/, ''))).toEqual([
      '/ai/conversations/c/messages',
      '/auth/refresh',
      '/ai/conversations/c/messages',
    ]);
  });

  it('stops when the reader aborts', async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      if (init?.signal?.aborted) return Promise.reject(init.signal.reason as Error);
      return Promise.resolve(new Response('event: delta\ndata: {"text":"x"}\n\n'));
    });
    controller.abort(new DOMException('Stopped', 'AbortError'));
    await expect(
      all(streamApi('/ai/conversations/c/messages', { content: 'Hi' }, controller.signal)),
    ).rejects.toThrow('Stopped');
  });
});
