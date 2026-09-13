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

Trainer availability, performance and payroll are outside the demo scope (master plan §7).
