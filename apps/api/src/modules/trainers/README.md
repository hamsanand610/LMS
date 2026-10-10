# trainers module

Teaching-staff records and the subjects they cover.

| Aspect      | Detail                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes      | `GET/POST /trainers`, `GET /trainers/subjects`, `GET/PATCH /trainers/:id`                                                                                      |
| Permissions | `trainers:read` (scope `all`, or `own` for a trainer looking at their own record), `trainers:manage`                                                           |
| Record      | One `trainer_profiles` row per user account: subjects, headline, bio. Creating a trainer creates the account, grants the trainer role and sends the invitation |
| Scope       | With `trainers:read` at scope `own` the list returns exactly one row — the caller's own record — and any other id answers 404                                  |
| Assignments | A trainer is attached to a batch for one subject (`batch_trainers`); the assignment is made on the batch page and shown here read-only                         |
| Events      | `trainer.created`, `trainer.updated`                                                                                                                           |
| Audit       | `trainers.created`, `trainers.updated`                                                                                                                         |
| Tests       | `test/batches.e2e-spec.ts` (listing, assignment counts, own-record scope)                                                                                      |

Trainer availability and payroll are not part of the product (master plan §7). Trainer performance
is a report of its parts side by side; no single score is computed until the institute agrees one.

## Phases 3 and 4 (3 October 2026)

- **A profile for every trainer account (ADM-01).** An account created with, or later given, the
  trainer role gets its trainer profile at once.
