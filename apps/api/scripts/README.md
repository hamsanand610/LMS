# Operational scripts

Small one-off tools, run with `pnpm --filter @lms/api exec tsx scripts/<file>`. They use the same
validated environment and Prisma client as the API, and none of them are part of a build.

| Script                      | Purpose                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo-reset.ts`             | Drops and recreates the schema, applies migrations, then runs the base seed, the demo seed and the Super Admin CLI. Refuses to run with `APP_ENV=production`. Also available as `pnpm demo:reset`. |
| `show-roles.ts`             | Prints every role with its permission bundle — the quickest way to see what a role can do after a seed or an upgrade.                                                                              |
| `unlock-account.ts <email>` | Clears a failed-login lockout. Useful after a test run that deliberately signed in with the wrong password.                                                                                        |
| `clear-stale-imports.ts`    | Marks import jobs left `queued` or `running` by an interrupted process as failed, so a new import can start. The importer also releases such jobs on its own after fifteen minutes.                |
