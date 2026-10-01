# health module

Liveness and readiness for operators, plus the admin system-health page.

| Aspect     | Detail                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes     | `GET /health/live` and `GET /health/ready` (public, outside the `/api/v1` prefix, never rate limited or logged); `GET /api/v1/admin/health` (`settings:manage`) |
| Readiness  | Database `SELECT 1` and storage bucket check; returns 503 `degraded` when either fails                                                                          |
| Admin view | Version, environment, client key, database, storage driver, email driver, queue counts and mode, execution driver and whether its sandbox answers               |
| Tests      | `test/route-table.e2e-spec.ts` (public routes), `test/settings.e2e-spec.ts` (admin health)                                                                      |
