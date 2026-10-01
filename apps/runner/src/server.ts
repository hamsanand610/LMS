import { createHash, timingSafeEqual } from 'node:crypto';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { sandboxJobSchema } from '@lms/shared';
import type { RunnerConfig } from './config.js';
import { Limiter, QueueFullError } from './limiter.js';
import { SandboxError, type RunJob } from './sandbox.js';

/** A job is code plus inputs; nothing legitimate comes near this. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export interface ServerDependencies {
  config: RunnerConfig;
  runJob: RunJob;
  /** Whether Docker answers and the image is present. */
  health: () => Promise<{ ok: boolean; detail?: string }>;
  /** One structured line per request. Never given code, input or the token. */
  log: (line: Record<string, unknown>) => void;
}

/**
 * The runner's HTTP surface:
 *
 * - `GET /livez` — unauthenticated, says only that the process is up (for a container probe);
 * - `GET /v1/health` — Docker and image readiness and the current load;
 * - `POST /v1/jobs` — run one job, answer with what the harness reported.
 *
 * Everything under /v1 needs the bearer token. The runner is meant to listen on a private
 * address that only the API can reach; the token is the second lock, not the only one.
 */
export function createServer(deps: ServerDependencies): Server {
  const limiter = new Limiter(deps.config.RUNNER_CONCURRENCY, deps.config.RUNNER_QUEUE);
  const expected = digest(deps.config.RUNNER_TOKEN);

  return createHttpServer((req, res) => {
    const started = Date.now();
    const done = (status: number, body: unknown, extra: Record<string, unknown> = {}) => {
      send(res, status, body);
      deps.log({
        method: req.method,
        path: req.url,
        status,
        durationMs: Date.now() - started,
        ...extra,
      });
    };

    void (async () => {
      const path = (req.url ?? '/').split('?')[0];
      if (req.method === 'GET' && path === '/livez') return done(200, { status: 'ok' });
      if (!path?.startsWith('/v1/')) return done(404, { error: 'not_found' });
      if (!authorised(req, expected)) return done(401, { error: 'unauthorised' });

      if (req.method === 'GET' && path === '/v1/health') {
        const health = await deps.health();
        return done(health.ok ? 200 : 503, { ...health, ...limiter.load });
      }

      if (req.method === 'POST' && path === '/v1/jobs') {
        let body: unknown;
        try {
          body = JSON.parse(await readBody(req));
        } catch (error) {
          return error instanceof TooLargeError
            ? done(413, { error: 'too_large' })
            : done(400, { error: 'invalid_json' });
        }
        const parsed = sandboxJobSchema.safeParse(body);
        if (!parsed.success) {
          // Where the job is wrong, never what it contained.
          const issues = parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          }));
          return done(400, { error: 'invalid_job', issues });
        }
        const job = parsed.data;
        const shape = { language: job.language, cases: job.cases.length };
        try {
          const result = await limiter.run(() => deps.runJob(job));
          return done(200, result, shape);
        } catch (error) {
          if (error instanceof QueueFullError) {
            res.setHeader('Retry-After', '5');
            return done(503, { error: 'busy' }, shape);
          }
          if (error instanceof SandboxError) {
            const status =
              error.reason === 'deadline' ? 504 : error.reason === 'unavailable' ? 503 : 502;
            return done(status, { error: error.reason, detail: error.message }, shape);
          }
          return done(500, { error: 'internal' }, shape);
        }
      }

      return done(404, { error: 'not_found' });
    })().catch(() => {
      if (!res.headersSent) send(res, 500, { error: 'internal' });
    });
  });
}

/** Compares digests of equal length, so the comparison takes the same time however wrong it is. */
function authorised(req: IncomingMessage, expected: Buffer): boolean {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  return timingSafeEqual(digest(header.slice('Bearer '.length)), expected);
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

class TooLargeError extends Error {}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > MAX_BODY_BYTES) {
      reject(new TooLargeError());
      req.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new TooLargeError());
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(text);
}
