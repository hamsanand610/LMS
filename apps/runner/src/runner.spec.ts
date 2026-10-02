import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { SandboxJob, SandboxResult } from '@lms/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, type RunnerConfig } from './config.js';
import { caseWallMs, dockerRunArgs, jobDeadlineMs } from './docker-args.js';
import { Limiter, QueueFullError } from './limiter.js';
import { parseResult, SandboxError } from './sandbox.js';
import { createServer } from './server.js';

const TOKEN = 'a-test-token-that-is-long-enough-1234567890';
const config: RunnerConfig = loadConfig({ RUNNER_TOKEN: TOKEN });

const job = (overrides: Partial<SandboxJob> = {}): SandboxJob => ({
  language: 'python',
  code: 'print(input())',
  cases: [
    { id: 'a', stdin: '1\n' },
    { id: 'b', stdin: '2\n', timeMs: 2000, memoryMb: 256 },
  ],
  limits: { timeMs: 1000, memoryMb: 128, outputBytes: 65_536 },
  ...overrides,
});

describe('the container a job runs in', () => {
  const args = dockerRunArgs(job(), 'lms-job-test', config);
  const flag = (name: string) => args[args.indexOf(name) + 1];

  it('has no network, a read-only root, no capabilities and no way to gain privileges', () => {
    expect(flag('--network')).toBe('none');
    expect(args).toContain('--read-only');
    expect(flag('--cap-drop')).toBe('ALL');
    expect(flag('--security-opt')).toBe('no-new-privileges');
  });

  it('runs as nobody, with process, file-handle, memory and CPU limits', () => {
    expect(flag('--user')).toBe('65534:65534');
    expect(flag('--pids-limit')).toBe('128');
    expect(flag('--ulimit')).toBe('nofile=256:256');
    // Sized from the largest case limit, with no swap to spill into.
    expect(flag('--memory')).toBe('640m');
    expect(flag('--memory-swap')).toBe('640m');
    expect(flag('--cpus')).toBe('1');
  });

  it('keeps scratch space in memory and removes the container afterwards', () => {
    expect(args).toContain('--rm');
    expect(args.filter((a) => a === '--tmpfs')).toHaveLength(2);
    expect(args.at(-1)).toBe('lms-sandbox:1');
  });

  it('runs only an image the host already has, never one fetched for the job', () => {
    expect(flag('--pull')).toBe('never');
  });

  it('never carries the code or the input as an argument', () => {
    expect(args.join(' ')).not.toContain('print(input())');
    expect(args.join(' ')).not.toContain('1\n');
  });

  it('gives every case its wall-clock backstop, plus a margin, before it is killed', () => {
    // A case is judged on CPU time; its wall clock runs to twice that allowance plus 2 s.
    expect(caseWallMs('python', 1000)).toBe(2 * (1000 + 400) + 2000);
    expect(jobDeadlineMs(job())).toBe(2 * (1000 + 400) + 2000 + 2 * (2000 + 400) + 2000 + 15_000);
    expect(jobDeadlineMs(job({ language: 'java' }))).toBe(
      30_000 + 2 * (1000 + 1500) + 2000 + 2 * (2000 + 1500) + 2000 + 15_000,
    );
    // A web check runs the page, then its checker, which has a wall clock of its own (ADR-0019).
    expect(caseWallMs('web', 2000)).toBe(2 * (2000 + 4000) + 2000 + 25_000);
  });
});

describe('the limiter', () => {
  it('runs a few at a time, queues a few more and refuses the rest', async () => {
    const limiter = new Limiter(1, 1);
    let release!: () => void;
    const first = limiter.run(
      () => new Promise<string>((resolve) => (release = () => resolve('first'))),
    );
    const second = limiter.run(async () => 'second');
    await expect(limiter.run(async () => 'third')).rejects.toBeInstanceOf(QueueFullError);
    expect(limiter.load).toEqual({ running: 1, waiting: 1 });
    release();
    expect(await first).toBe('first');
    expect(await second).toBe('second');
    expect(limiter.load).toEqual({ running: 0, waiting: 0 });
  });
});

describe('reading the harness', () => {
  it('keeps the named fields, in the order the job asked for', () => {
    const text = JSON.stringify({
      harness: 1,
      compile: { ok: true, output: '', durationMs: 0 },
      cases: [
        {
          id: 'b',
          stdout: '2\n',
          stderr: '',
          exitCode: 0,
          signal: null,
          durationMs: 30,
          memoryKb: 9000,
          extra: 'x',
        },
        {
          id: 'a',
          stdout: '1\n',
          stderr: '',
          exitCode: 0,
          signal: null,
          durationMs: 31,
          memoryKb: 9100,
        },
      ],
    });
    const result = parseResult(text, job());
    expect(result.cases.map((c) => c.id)).toEqual(['a', 'b']);
    expect(result.cases[1]).not.toHaveProperty('extra');
  });

  it('treats a missing case or a harness error as a fault, never as a pass', () => {
    const partial = JSON.stringify({
      harness: 1,
      compile: { ok: true, output: '', durationMs: 0 },
      cases: [{ id: 'a', stdout: '1\n' }],
    });
    expect(() => parseResult(partial, job())).toThrow(SandboxError);
    expect(() => parseResult('{"harness":1,"error":"boom"}', job())).toThrow(SandboxError);
    expect(() => parseResult('not json', job())).toThrow(SandboxError);
  });

  it('reports no cases when the code does not compile', () => {
    const text = JSON.stringify({
      harness: 1,
      compile: { ok: false, output: 'Main.java:1: error', durationMs: 900 },
      cases: [],
    });
    const result = parseResult(text, job({ language: 'java' }));
    expect(result.compile.ok).toBe(false);
    expect(result.cases).toEqual([]);
  });
});

describe('the HTTP surface', () => {
  let server: Server;
  let base = '';
  const ran: SandboxJob[] = [];
  const logged: Record<string, unknown>[] = [];

  beforeAll(async () => {
    server = createServer({
      config,
      runJob: async (j): Promise<SandboxResult> => {
        ran.push(j);
        return {
          harness: 1,
          compile: { ok: true, output: '', durationMs: 0 },
          cases: j.cases.map((c) => ({
            id: c.id,
            stdout: c.stdin,
            stderr: '',
            exitCode: 0,
            signal: null,
            timedOut: false,
            memoryExceeded: false,
            durationMs: 1,
            memoryKb: 1,
            truncated: false,
          })),
        };
      },
      health: async () => ({ ok: true }),
      log: (line) => logged.push(line),
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const post = (body: unknown, token: string | null = TOKEN) =>
    fetch(`${base}/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  it('answers the liveness probe without a token and nothing else', async () => {
    expect((await fetch(`${base}/livez`)).status).toBe(200);
    expect((await fetch(`${base}/v1/health`)).status).toBe(401);
  });

  it('refuses a job without the token, or with the wrong one', async () => {
    expect((await post(job(), null)).status).toBe(401);
    expect((await post(job(), `${TOKEN}x`)).status).toBe(401);
    expect(ran).toHaveLength(0);
  });

  it('refuses a malformed job and says where, not what', async () => {
    expect((await post('{nope')).status).toBe(400);
    const bad = await post({ ...job(), language: 'cobol', code: 'secret-source' });
    expect(bad.status).toBe(400);
    const text = await bad.text();
    expect(text).toContain('language');
    expect(text).not.toContain('secret-source');
    const tooLong = await post({
      ...job(),
      cases: [
        { id: 'a', stdin: '', timeMs: 30_000 },
        ...Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, stdin: '', timeMs: 30_000 })),
      ],
    });
    expect(tooLong.status).toBe(400);
    expect(ran).toHaveLength(0);
  });

  it('runs a valid job and returns what the sandbox reported', async () => {
    const response = await post(job());
    expect(response.status).toBe(200);
    const result = (await response.json()) as SandboxResult;
    expect(result.cases.map((c) => c.stdout)).toEqual(['1\n', '2\n']);
    expect(ran).toHaveLength(1);
  });

  it('logs the shape of a request, never its code, input or token', () => {
    const text = JSON.stringify(logged);
    expect(text).toContain('"language":"python"');
    expect(text).not.toContain('print(input())');
    expect(text).not.toContain(TOKEN);
  });
});

describe('configuration', () => {
  it('will not start without a long token', () => {
    expect(() => loadConfig({})).toThrow(/RUNNER_TOKEN/);
    expect(() => loadConfig({ RUNNER_TOKEN: 'short' })).toThrow(/RUNNER_TOKEN/);
  });
});
