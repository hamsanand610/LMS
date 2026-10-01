import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { SandboxCaseResult, SandboxJob, SandboxResult } from '@lms/shared';
import type { RunnerConfig } from './config.js';
import { dockerRunArgs, jobDeadlineMs } from './docker-args.js';

/** The most a harness may print back; anything longer is a fault, not a result. */
const MAX_RESULT_BYTES = 8 * 1024 * 1024;

/** Why a job produced no result. Never contains the job's code or input. */
export class SandboxError extends Error {
  constructor(
    message: string,
    readonly reason: 'deadline' | 'crashed' | 'unreadable' | 'unavailable',
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

/** Runs one job in one fresh container and returns what the harness reported. */
export type RunJob = (job: SandboxJob) => Promise<SandboxResult>;

export function createSandbox(config: RunnerConfig): RunJob {
  return (job) => runInContainer(job, config);
}

async function runInContainer(job: SandboxJob, config: RunnerConfig): Promise<SandboxResult> {
  const name = `lms-job-${randomUUID()}`;
  // An argument list, never a shell string: nothing from the job is interpreted by a shell.
  const child = spawn(config.RUNNER_DOCKER, dockerRunArgs(job, name, config), {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });

  const stdout: Buffer[] = [];
  let stdoutBytes = 0;
  let overflow = false;
  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBytes += chunk.length;
    if (stdoutBytes > MAX_RESULT_BYTES) {
      overflow = true;
      return;
    }
    stdout.push(chunk);
  });
  // Docker's own complaints (no such image, daemon down); kept short and never echoed to callers.
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    if (stderr.length < 4096) stderr += chunk.toString('utf8');
  });

  const deadline = jobDeadlineMs(job);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killContainer(config, name);
  }, deadline);

  const exit = new Promise<{ code: number | null; spawnError: Error | null }>((resolve) => {
    child.on('error', (error) => resolve({ code: null, spawnError: error }));
    child.on('close', (code) => resolve({ code, spawnError: null }));
  });

  child.stdin.on('error', () => {
    // The container may exit before reading everything (a crash); its exit status says so.
  });
  child.stdin.end(JSON.stringify(job));

  const { code, spawnError } = await exit;
  clearTimeout(timer);

  if (spawnError) {
    throw new SandboxError('Docker could not be started', 'unavailable');
  }
  if (timedOut) {
    throw new SandboxError(`The job did not finish within ${deadline} ms`, 'deadline');
  }
  if (overflow) {
    throw new SandboxError('The harness reported more than the runner accepts', 'unreadable');
  }
  const text = Buffer.concat(stdout).toString('utf8');
  if (!text.trim()) {
    // 125: docker itself failed (no image, daemon down); anything else: the container died.
    throw new SandboxError(
      code === 125
        ? 'The sandbox image could not be started'
        : 'The sandbox stopped without a result',
      code === 125 ? 'unavailable' : 'crashed',
    );
  }
  return parseResult(text, job);
}

/**
 * Reads the harness's answer, keeping only the fields the contract names and only the cases the
 * job asked for, in the job's order.
 */
export function parseResult(text: string, job: SandboxJob): SandboxResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SandboxError('The sandbox answered with something that is not JSON', 'unreadable');
  }
  const value = raw as {
    harness?: unknown;
    error?: unknown;
    compile?: { ok?: unknown; output?: unknown; durationMs?: unknown };
    cases?: unknown;
  };
  if (typeof value.error === 'string') {
    throw new SandboxError('The sandbox harness failed', 'crashed');
  }
  const compile = {
    ok: value.compile?.ok === true,
    output: typeof value.compile?.output === 'string' ? value.compile.output.slice(0, 16_384) : '',
    durationMs: asInt(value.compile?.durationMs),
  };
  const reported = Array.isArray(value.cases) ? (value.cases as Record<string, unknown>[]) : [];
  const byId = new Map(reported.map((c) => [String(c['id'] ?? ''), c]));
  const cases: SandboxCaseResult[] = compile.ok
    ? job.cases.map((jobCase) => {
        const c = byId.get(jobCase.id);
        if (!c) {
          throw new SandboxError('The sandbox did not report every case', 'unreadable');
        }
        return {
          id: jobCase.id,
          stdout: asText(c['stdout'], job.limits.outputBytes),
          stderr: asText(c['stderr'], job.limits.outputBytes),
          exitCode: asIntOrNull(c['exitCode']),
          signal: asIntOrNull(c['signal']),
          timedOut: c['timedOut'] === true,
          memoryExceeded: c['memoryExceeded'] === true,
          durationMs: asInt(c['durationMs']),
          memoryKb: asInt(c['memoryKb']),
          truncated: c['truncated'] === true,
        };
      })
    : [];
  return { harness: asInt(value.harness), compile, cases };
}

function killContainer(config: RunnerConfig, name: string): void {
  const killer = spawn(config.RUNNER_DOCKER, ['kill', name], {
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
  });
  killer.on('error', () => undefined);
}

function asText(value: unknown, cap: number): string {
  return typeof value === 'string' ? value.slice(0, cap) : '';
}

function asInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function asIntOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}
