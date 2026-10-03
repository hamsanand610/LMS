'use client';

import type { ProblemDetails } from '@lms/shared';
import { API_PREFIX, publicEnv } from '../env';
import { ApiError } from './errors';
import { csrfHeader, refreshSession } from './http';

/** One server-sent event: its name and its data, read as JSON. */
export interface StreamEvent {
  event: string;
  data: unknown;
}

/**
 * A POST whose answer is a stream of server-sent events (Phase 7C; ADR-0030). It is sent as
 * `api()` sends a mutation — cookies included, the CSRF header, one refresh-and-retry on 401 — so
 * an `EventSource`, which can only GET and cannot send the header, is not used. A refusal before
 * the stream starts is a problem response and throws an `ApiError`; once it has started, events
 * are handed over one by one as they arrive. Aborting the signal stops reading, and the server,
 * seeing the connection close, stops writing.
 */
export async function* streamApi(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const send = () =>
    fetch(`${publicEnv.apiUrl}${API_PREFIX}${path}`, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...csrfHeader(),
      },
      body: JSON.stringify(body),
    });
  let response = await send();
  if (response.status === 401 && (await refreshSession())) response = await send();
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new ApiError(response.status, problemOf(text));
  }
  yield* readEvents(response.body);
}

/**
 * Server-sent events from a byte stream: one per blank-line-separated block, however the bytes
 * happen to be split. Comments and blocks without data are skipped; the reader is released when the
 * consumer stops, which closes the connection.
 */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const event = parseBlock(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (event) yield event;
        boundary = buffer.indexOf('\n\n');
      }
      if (done) break;
    }
    const last = parseBlock(buffer);
    if (last) yield last;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function parseBlock(block: string): StreamEvent | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (data.length === 0) return null;
  try {
    return { event, data: JSON.parse(data.join('\n')) as unknown };
  } catch {
    return null;
  }
}

function problemOf(text: string): ProblemDetails | null {
  try {
    const value = JSON.parse(text) as unknown;
    return typeof value === 'object' && value !== null && 'status' in value && 'title' in value
      ? (value as ProblemDetails)
      : null;
  } catch {
    return null;
  }
}
