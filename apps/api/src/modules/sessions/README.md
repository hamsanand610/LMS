# sessions module

The timetable: repeating classes, the sessions they create, and running them (journey J-07).

| Aspect      | Detail                                                                                                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes      | `GET /batches/:batchId/series`, `POST /batches/:batchId/series/preview`, `POST /batches/:batchId/series`, `POST /batches/:batchId/sessions`, `DELETE /series/:id`; `GET /sessions`, `GET/PATCH /sessions/:id`, `POST /sessions/:id/status`; `GET /me/schedule` |
| Permissions | `sessions:read` (scope `all`, `batch` or `own`), `sessions:manage`, `sessions:run` (scope `all` or `batch`)                                                                                                                                                    |
| Series      | Weekdays, a start and end time, a date range and any holidays to skip. Expanding it creates every class at once, capped at 400 so a mistyped year cannot flood the timetable                                                                                   |
| Timezone    | Times are wall-clock in the institute's timezone; what is stored is the UTC instant. `zonedDateTimeToUtc` resolves the offset at that date, so a daylight-saving change does not move a class                                                                  |
| Conflicts   | `POST …/series/preview` writes nothing and names every clash with the batch or the trainer. Creating without `allowConflicts` is refused (`session_conflict`); with it, the person who saw the clashes decides                                                 |
| Ending      | Ending a series withdraws its future classes and keeps the ones already taught, so the record of what happened survives                                                                                                                                        |
| Status      | scheduled → live/completed/cancelled, with completed and cancelled reversible to scheduled. Cancelling tells the batch and says why                                                                                                                            |
| Reminders   | A cron job every five minutes announces classes starting within half an hour. `reminder_sent_at` is stamped before the message goes out, so a restart or a second worker never sends it twice                                                                  |
| Join link   | Offered from fifteen minutes before a class until it ends, and never for a cancelled or finished one                                                                                                                                                           |
| Personal    | `GET /me/schedule` gives a learner their batches' classes and a trainer the ones they are teaching                                                                                                                                                             |
| Mapper      | `session-item.ts` is a pure module with no Nest or Prisma imports, so the progress module can present a class without depending on this one                                                                                                                    |
| Events      | `session.created`, `session.updated`, `session.cancelled`                                                                                                                                                                                                      |
| Audit       | `session.series_created`, `session.series_ended`, `session.created`, `session.updated`, `session.status_changed`                                                                                                                                               |
| Tests       | `src/modules/sessions/recurrence.spec.ts` (expansion, timezone, conflicts); `test/sessions.e2e-spec.ts` (J-07 and J-08 end to end, scope, reminders, cancellation)                                                                                             |

Attendance against a class arrives in Phase 5; recordings are attached through the courses module,
which is what keeps this module free of any dependency on course content.

## Phase 2 (2 October 2026)

- **The join link** reaches a learner only once the class can be joined (15 minutes before it
  starts until it ends), on every route they can read a class through: their timetable, the
  dashboard, `GET /sessions`, `GET /sessions/:id` (`learnerSessionItem`), and a series' link is
  never sent to them (`sessions:read` at `own` scope is what makes a caller a learner here).
- **Ranges are the institute's days**: `from` at its midnight, `to` up to the next midnight.
- **Notices:** a new class or series tells the batch (`session.scheduled`, one notice per series);
  reminders send learners to `/schedule` and the trainer to `/trainer/schedule`.

## Phases 3 and 4 (3 October 2026)

- **Taught classes in one's own timetable (review L4)** appear only while one still holds
  `sessions:run` at `batch` or wider; an assignment that outlives a trainer role keeps its
  timetable and join links closed. The leaderboard likewise limits `own` scope to the batches
  one learns in.
- **Recordings (SEC-05).** Someone who is not a course's author attaches a recording only to a
  course published to that class's batch and to no batch they do not teach.
- **Schedules** list the classes one teaches as well as those one attends; the staff list filters
  by batch and subject (TRN-04).
