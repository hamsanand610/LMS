import { caseWallMs, type SandboxJob } from '@lms/shared';
import type { RunnerConfig } from './config.js';

/** Memory the container gets on top of the largest program limit: runtime, compiler, harness. */
const CONTAINER_OVERHEAD_MB = 384;
/** Scratch space for the source, the compiled classes and each case's output; the sandbox user's alone. */
const WORK_TMPFS = 'size=64m,uid=65534,gid=65534,mode=0700';

/**
 * The `docker run` arguments for one job. Every flag here is part of the isolation, so each one
 * is asserted by a test:
 *
 * - no network, a read-only root, every capability dropped and no privilege escalation;
 * - an unprivileged user, a process limit (no fork bombs), a file-handle limit;
 * - memory with no swap and one CPU;
 * - a small tmpfs for scratch, gone when the container is;
 * - `--rm`, so nothing of the job outlives it, and a name the runner can kill it by;
 * - `--pull never`: a job runs the image the host was given and never fetches one.
 *
 * The job itself never appears here: it goes in on standard input, as data.
 */
export function dockerRunArgs(job: SandboxJob, name: string, config: RunnerConfig): string[] {
  const largest = Math.max(job.limits.memoryMb, ...job.cases.map((c) => c.memoryMb ?? 0));
  const memory = `${largest + CONTAINER_OVERHEAD_MB}m`;
  return [
    'run',
    '--rm',
    '--interactive',
    '--name',
    name,
    '--network',
    'none',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    '128',
    '--memory',
    memory,
    '--memory-swap',
    memory,
    '--cpus',
    config.RUNNER_CPUS,
    '--ulimit',
    'nofile=256:256',
    '--user',
    '65534:65534',
    '--tmpfs',
    `/work:rw,exec,nosuid,nodev,${WORK_TMPFS}`,
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777',
    '--env',
    'JAVA_TOOL_OPTIONS=',
    '--stop-timeout',
    '1',
    '--log-driver',
    'none',
    '--pull',
    'never',
    config.RUNNER_IMAGE,
  ];
}

/**
 * How long a job may take before the runner kills its container: the compiler, then every case's
 * wall-clock backstop, plus the time Docker needs to start and stop it.
 */
export function jobDeadlineMs(job: SandboxJob): number {
  const compile = job.language === 'java' ? 30_000 : 0;
  const perCase = job.cases.reduce(
    (total, c) => total + caseWallMs(job.language, c.timeMs ?? job.limits.timeMs),
    0,
  );
  return compile + perCase + 15_000;
}

/**
 * A case's wall-clock backstop, from packages/shared, which mirrors infra/sandbox/harness.py: a
 * case is judged on CPU time, so a cold or busy host cannot fail a correct answer.
 */
export { caseWallMs };
