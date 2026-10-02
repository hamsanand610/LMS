# batches module

Programmes (curriculum templates) and the cohorts that run them (journey J-02).

| Aspect      | Detail                                                                                                                                                                                                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes      | `GET/POST /programs`, `PATCH /programs/:id`; `GET/POST /batches`, `GET/PATCH /batches/:id`, `POST /batches/:id/status`, `GET/POST /batches/:id/members`, `GET /batches/:id/members/candidates`, `DELETE /batches/:id/members/:studentId`, `POST /batches/:id/members/transfer`, `PUT /batches/:id/trainers` |
| Permissions | `batches:read` (scope `all` or `batch`), `batches:manage`, `programs:manage`                                                                                                                                                                                                                                |
| Programme   | Code, name, duration in weeks. Archiving is refused while a planned or running batch still uses it (`program_in_use`)                                                                                                                                                                                       |
| Batch       | Belongs to one programme; unique code, mode, dates, capacity and `custom` values for client-defined fields                                                                                                                                                                                                  |
| Lifecycle   | planned → running → completed → archived; a batch with no students cannot start (`batch_empty`); moving to running notifies every member                                                                                                                                                                    |
| Roster      | Membership rows are kept when a student leaves (`is_active` false, `left_at` and reason), so history survives; capacity is enforced on add; a transfer is a remove plus an add, audited as one move                                                                                                         |
| Trainers    | `PUT /batches/:id/trainers` replaces the whole assignment list; one subject may not be assigned twice to the same trainer                                                                                                                                                                                   |
| Scope       | A `batch`-scoped caller sees only the batches they are assigned to, and gets no status transitions offered                                                                                                                                                                                                  |
| Events      | `batch.created`, `batch.status_changed`, `batch.members_changed`                                                                                                                                                                                                                                            |
| Audit       | `programs.created`, `programs.updated`, `batches.created`, `batches.updated`, `batches.status_changed`, `batches.members_added`, `batches.member_removed`, `batches.member_transferred`, `batches.trainers_changed`                                                                                         |
| Tests       | `packages/shared/src/schemas/people.spec.ts` (schemas and transitions); `test/batches.e2e-spec.ts` (J-02 end to end, capacity, roster history, trainer scope)                                                                                                                                               |

Timetables, published content and attendance attach to a batch in Phases 3 to 5; the batch page
shows the timetable tab as pending until then.

## Phases 3 and 4 (3 October 2026)

- **Membership has one path (SEC-04).** `insertMembers` adds students inside the caller's
  transaction: only to a planned or running batch (`batch_closed`), with the batch row locked so
  two additions cannot both take the last place, and nobody twice. `membersJoined` follows the
  commit: the audit entry, enrolment in the batch's courses (by event), fresh scope and a notice.
  A transfer leaves one batch and joins the next in one transaction. Students created or imported
  with a batch join through the same path, so they are enrolled in its courses.
- **Screens (ADM-03).** Batches and programmes are edited, and learners moved between batches,
  from the batch and programme pages; trainers' links stay inside the trainer portal (TRN-02),
  with a Reports tab per batch.
- **Tests:** `test/staff-scope.e2e-spec.ts` (transfers, capacity, closed batches),
  `test/batches.e2e-spec.ts`.
