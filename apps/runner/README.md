# @lms/runner — the sandbox runner

Runs learners' code for the API (ADR-0016). For every job it starts one throwaway, locked-down
container from the sandbox image (`infra/sandbox`), passes the job in on standard input, and
returns what the program printed, how it ended and what it cost. It never runs code itself, holds
no data and never sees an expected output: the API keeps those and does every comparison.

## HTTP surface

| Route            | Auth         | What it does                                                                                                               |
| ---------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /livez`     | none         | The process is up (container probe). Says nothing else.                                                                    |
| `GET /v1/health` | bearer token | Docker answers and the sandbox image is present; current load.                                                             |
| `POST /v1/jobs`  | bearer token | Runs one job (`sandboxJobSchema` in `packages/shared`); 503 + `Retry-After` when the queue is full, 504 past the deadline. |

The token is compared in constant time. Requests are logged by shape only (language, number of
cases, status, duration): never code, input or the token.

## Isolation (every flag is asserted in `src/runner.spec.ts`)

`--network none`, `--read-only`, `--cap-drop ALL`, `no-new-privileges`, user `65534:65534`,
`--pids-limit 128`, `nofile=256`, memory with no swap (largest case limit plus runtime overhead),
`--cpus 1`, size-limited `tmpfs` for `/work` and `/tmp`, `--log-driver none`, `--rm`,
`--pull never`, and a deadline after which the container is killed. Jobs are queued with a
concurrency limit; a full queue answers 503 so the API retries later.

Time is judged on CPU: a case passes its time limit when the CPU it used stays within the limit
plus the runtime's start-up, so a cold or busy host cannot fail a correct answer. The wall clock
stops code that waits instead of computing, at twice that allowance plus two seconds; the runner's
deadline (`jobDeadlineMs`) and the API's request budget are sized on that backstop.

## Configuration

From the environment, or `apps/runner/.env` locally (`.env.example` lists them):
`RUNNER_TOKEN` (required, at least 32 characters, the same value as the API's), `RUNNER_HOST`,
`RUNNER_PORT` (4100), `RUNNER_IMAGE` (`lms-sandbox:1`), `RUNNER_CONCURRENCY` (2),
`RUNNER_QUEUE` (32), `RUNNER_CPUS` (1), `RUNNER_DOCKER` (`docker`).

## Running it locally

```bash
docker build -t lms-sandbox:1 infra/sandbox   # once, and after editing infra/sandbox
pnpm --filter @lms/runner build
pnpm --filter @lms/runner start               # reads apps/runner/.env
```

The API finds it through `EXECUTION_DRIVER=runner`, `RUNNER_URL` and `RUNNER_TOKEN` in
`apps/api/.env`. `pnpm env:init` puts one random token into both files.

## Tests

- `pnpm --filter @lms/runner test` — unit tests, no Docker: arguments, deadlines, the limiter,
  result parsing and the HTTP surface.
- `pnpm --filter @lms/runner test:sandbox` — real jobs in real containers: every language, SQL,
  time and memory limits, no network, a read-only root, fork bombs, output caps.
- `pnpm --filter @lms/api verify:questions` — every reference solution in the question bank.

## Deployment

`apps/runner/Dockerfile` builds the service image (Node plus the Docker client). In staging
(`infra/compose.staging.yml`) it reaches the host's Docker through the mounted socket, joins the
docker group instead of running as root, and is reachable only by the API on the compose network.
Whoever holds the Docker socket holds the host, so the runner gets nothing else: no published
port, no database, no storage and no secret but its own token.
