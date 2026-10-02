# health module

Liveness and readiness for operators, plus the admin system-health page.

| Aspect     | Detail                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes     | `GET /health/live` and `GET /health/ready` (public, outside the `/api/v1` prefix, never rate limited or logged); `GET /api/v1/admin/health` (`settings:manage`) |
| Readiness  | Database `SELECT 1` and storage bucket check; returns 503 `degraded` when either fails                                                                          |
| Admin view | Version, environment, client key, database, storage driver, email driver, queue counts and mode, execution driver and whether its sandbox answers               |
| Tests      | `test/route-table.e2e-spec.ts` (public routes), `test/settings.e2e-spec.ts` (admin health)                                                                      |

## Phases 3 and 4 (3 October 2026)

- **Failed jobs (ADM-10).** `GET /admin/jobs/failed` lists recent failures per queue (name, when,
  the error message only) and `POST /admin/jobs/:id/retry` sends one back (`settings:manage`, so
  the Super Admin's; audited `jobs.retried`). Runbook: `docs/runbooks/operations.md`.
- **Retention (ADM-12).** `retention.sweep` runs nightly at 02:30 (Asia/Kolkata, as every queue schedule): export files are deleted once
  their links expire (the row stays, `expired`); finished import sheets keep their counts but lose
  their rows after 30 days; audit entries older than the Super Admin's period are removed, only
  when one is set (at least 1,095 days; off by default). A sweep that removes anything is audited
  (`retention.swept`).
- **Tests:** `test/queue.e2e-spec.ts` (failed jobs), `test/admin-operations.e2e-spec.ts` (retention).
