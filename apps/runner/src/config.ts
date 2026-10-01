import { z } from 'zod';

/**
 * The runner's settings, from its environment. It refuses to start without a token: an open
 * runner is a machine anyone on the network could run code on.
 */
const configSchema = z.object({
  RUNNER_HOST: z.string().min(1).default('127.0.0.1'),
  RUNNER_PORT: z.coerce.number().int().min(1).max(65_535).default(4100),
  RUNNER_TOKEN: z.string().min(32, 'RUNNER_TOKEN must be at least 32 characters'),
  RUNNER_IMAGE: z
    .string()
    .regex(/^[a-z0-9][a-z0-9._/:-]{0,127}$/, 'RUNNER_IMAGE is not an image reference')
    .default('lms-sandbox:1'),
  RUNNER_DOCKER: z.string().min(1).default('docker'),
  /** Jobs run at the same time; each gets one CPU. */
  RUNNER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
  /** Jobs waiting beyond those; more are refused with 503 so callers can retry later. */
  RUNNER_QUEUE: z.coerce.number().int().min(0).max(1000).default(32),
  RUNNER_CPUS: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .default('1'),
});
export type RunnerConfig = z.infer<typeof configSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): RunnerConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid runner configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
