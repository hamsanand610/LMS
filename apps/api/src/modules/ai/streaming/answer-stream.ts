import type { Response } from 'express';
import { aiStreamEventSchemas } from '@lms/shared';
import type { z } from 'zod';

/** Proxies close a quiet connection; a ping this often keeps an answer's stream open. */
export const HEARTBEAT_MS = 15_000;

/** The strict shape of each event a stream may write; `ping` keeps the line open. */
export type StreamEventSchemas = { ping: z.ZodType } & Record<string, z.ZodType>;

/**
 * One answer stream to a browser (ADR-0030; Phase 7C): server-sent events written on the response to
 * the POST that asked, so the request carried the session cookie and the CSRF header like any other
 * mutation. Each event is checked against its strict shape before it is written: nothing of a
 * provider's own events, names or errors can pass through. Writing stops quietly once the reader
 * has gone; the server still closes the answer properly. A conversation's events by default; a
 * grounded answer's (Phase 8E) when given theirs.
 */
export class AnswerStream<S extends StreamEventSchemas = typeof aiStreamEventSchemas> {
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(
    private readonly res: Response,
    private readonly heartbeatMs = HEARTBEAT_MS,
    private readonly schemas: S = aiStreamEventSchemas as unknown as S,
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
    this.heartbeat = setInterval(
      () => this.send('ping', {} as z.input<S['ping']>),
      this.heartbeatMs,
    );
    this.heartbeat.unref();
  }

  /** Whether the reader is gone or the stream has ended. */
  get closed(): boolean {
    return this.res.writableEnded || this.res.destroyed;
  }

  send<K extends keyof S & string>(event: K, data: z.input<S[K]>): void {
    if (this.closed) return;
    const checked: unknown = this.schemas[event]!.parse(data);
    this.res.write(`event: ${event}\ndata: ${JSON.stringify(checked)}\n\n`);
  }

  end(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (!this.res.writableEnded) this.res.end();
  }
}
