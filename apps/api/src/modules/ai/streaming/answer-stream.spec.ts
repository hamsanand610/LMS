import { PassThrough } from 'node:stream';
import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnswerStream, HEARTBEAT_MS } from './answer-stream.js';

/** A response as far as the stream uses it: status, headers, writes and the end. */
function fakeResponse() {
  const body = new PassThrough();
  let text = '';
  body.on('data', (chunk: Buffer) => (text += chunk.toString()));
  const headers = new Map<string, string>();
  const res = {
    statusCode: 0,
    flushed: false,
    writableEnded: false,
    destroyed: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    flushHeaders() {
      this.flushed = true;
    },
    write(chunk: string) {
      return body.write(chunk);
    },
    end() {
      this.writableEnded = true;
      body.end();
    },
  };
  return { res, headers, text: () => text };
}

const id = '0190a0e4-7c1d-7b9e-8f00-000000000001';

describe('the answer stream (ADR-0030, Phase 7C)', () => {
  afterEach(() => vi.useRealTimers());

  it('opens as an event stream that nothing should buffer or cache', () => {
    const { res, headers } = fakeResponse();
    const stream = new AnswerStream(res as unknown as Response);
    stream.open();
    expect(res.statusCode).toBe(200);
    expect(res.flushed).toBe(true);
    expect(headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(headers.get('cache-control')).toBe('no-store, no-transform');
    expect(headers.get('x-accel-buffering')).toBe('no');
    stream.end();
  });

  it('writes each event in the event-stream format', async () => {
    const { res, text } = fakeResponse();
    const stream = new AnswerStream(res as unknown as Response);
    stream.open();
    stream.send('delta', { text: 'Hello ' });
    stream.send('done', { messageId: id, status: 'complete' });
    stream.end();
    await new Promise((resolve) => setImmediate(resolve));
    expect(text()).toBe(
      `event: delta\ndata: {"text":"Hello "}\n\nevent: done\ndata: {"messageId":"${id}","status":"complete"}\n\n`,
    );
  });

  it('refuses to write anything beyond an event’s own shape', () => {
    const { res } = fakeResponse();
    const stream = new AnswerStream(res as unknown as Response);
    stream.open();
    expect(() =>
      stream.send('delta', { text: 'x', candidates: [] } as unknown as { text: string }),
    ).toThrow();
    stream.end();
  });

  it('pings while the answer is quiet, and stops when it ends', async () => {
    vi.useFakeTimers();
    const { res, text } = fakeResponse();
    const stream = new AnswerStream(res as unknown as Response);
    stream.open();
    vi.advanceTimersByTime(HEARTBEAT_MS * 2 + 10);
    stream.end();
    vi.advanceTimersByTime(HEARTBEAT_MS * 3);
    vi.useRealTimers();
    await new Promise((resolve) => setImmediate(resolve));
    expect(text()).toBe('event: ping\ndata: {}\n\nevent: ping\ndata: {}\n\n');
  });

  it('writes nothing once the reader has gone', async () => {
    const { res, text } = fakeResponse();
    const stream = new AnswerStream(res as unknown as Response);
    stream.open();
    res.destroyed = true;
    stream.send('delta', { text: 'lost' });
    expect(stream.closed).toBe(true);
    stream.end();
    await new Promise((resolve) => setImmediate(resolve));
    expect(text()).toBe('');
  });
});
