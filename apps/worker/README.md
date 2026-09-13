# @lms/worker — separate job process

The platform runs background jobs (emails, later exports and reminders) through pg-boss
(ADR-0006). By default (`WORKER_MODE=embedded`) the API process runs the workers itself, which is
the right choice for the local demo and a small deployment.

For a deployment that wants job processing isolated from request handling, set
`WORKER_MODE=separate` in the API environment and run this process with the same environment:

```bash
pnpm --filter @lms/worker worker:dev   # development (tsx)
pnpm --filter @lms/api build && pnpm --filter @lms/worker start   # built
```

The entry point is `apps/api/src/worker.ts`: it boots the same Nest modules as the API
(`AppModule`) as an application context, without an HTTP listener, and marks the process role as
`worker` so the queue service starts the handlers. There is no separate code base to keep in sync;
every module's jobs are registered through the same `JobsService`.

This package deliberately defines no `dev` script so `pnpm dev` (Turborepo) does not start a second
worker next to the embedded one.
