# reports module

The admin dashboard. The full reporting module (report pages, filters, charts, exports) is Phase 5;
this is the people subset the platform can measure today.

| Aspect           | Detail                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes           | `GET /reports/dashboard`                                                                                                                                                                                          |
| Permissions      | `reports:read`, scope `all` or `batch`                                                                                                                                                                            |
| Measured now     | Students in batches, active in the last seven days, added in the range, running batches, trainers assigned                                                                                                        |
| Not measured yet | Attendance, course completion and assessment averages are returned as `value: null` with the phase that will deliver them, so the page states what is missing instead of showing an invented number (plan DP-A01) |
| Scope            | A `batch`-scoped caller sees only their own batches, and every figure is computed inside that set                                                                                                                 |
| Tests            | `test/admin.e2e-spec.ts` (figures, pending tiles, trainer scope, student refused)                                                                                                                                 |
