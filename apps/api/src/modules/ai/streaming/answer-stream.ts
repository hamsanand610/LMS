import type { Response } from 'express';
import { type AiStreamEvent, type AiStreamEventName, aiStreamEventSchemas } from '@lms/shared';

/** Proxies close a quiet connection; a ping this often keeps an answer's stream open. */
export const HEARTBEAT_MS = 15_000;

/**
 * One answer stream to a browser (ADR-0030; Phase 7C): server-sent events written on the response to
 * the POST that asked, so the request carried the session cookie and the CSRF header like any other
 * mutation. Each event is checked against its strict shape before it is written: nothing of a
 * provider's own events, names or errors can pass through. Writing stops quietly once the reader
 * has gone; the server still closes the answer properly.
 */
export class AnswerStream {
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(
    private readonly res: Response,
    private readonly heartbeatMs = HEARTBEAT_MS,
  ) {}

  /** Status and headers, sent at once; nothing between here and the browser should buffer. */
  open(): void {
    this.res.status(200);
    this.res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    this.res.setHeader('Cache-Control', 'no-store, no-transform');
    this.res.setHeader('Connection', 'keep-alive');
    // Reverse proxies that buffer responses (nginx, and Caddy when told to) pass this one through.
    this.res.setHeader('X-Accel-Buffering', 'no');
    this.res.flushHeaders();
    this.heartbeat = setInterval(() => this.send('ping', {}), this.heartbeatMs);
    this.heartbeat.unref();
  }

  /** Whether the reader is gone or the stream has ended. */
  get closed(): boolean {
    return this.res.writableEnded || this.res.destroyed;
  }

  send<K extends AiStreamEventName>(
    event: K,
    data: Extract<AiStreamEvent, { event: K }>['data'],
  ): void {
    if (this.closed) return;
    const checked = aiStreamEventSchemas[event].parse(data);
    this.res.write(`event: ${event}\ndata: ${JSON.stringify(checked)}\n\n`);
  }

  end(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (!this.res.writableEnded) this.res.end();
  }
}
