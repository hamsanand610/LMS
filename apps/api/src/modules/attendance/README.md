# attendance module

Who was in the room: the roll call, its corrections, and the percentage every other page quotes
(journey J-05).

| Aspect        | Detail                                                                                                                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes        | `GET /sessions/:id/attendance`, `PUT /sessions/:id/attendance`, `GET /attendance/sessions`, `GET /attendance/alerts`, `GET /attendance/students/:id`; learner: `GET /me/attendance`                                                                         |
| Permissions   | `attendance:read` (scope `all`, `batch` or `own`), `attendance:mark` (`all` or `batch`), `attendance:manage` (`all`, for corrections after the window)                                                                                                      |
| Own means own | A learner holds `attendance:read` at scope `own`, which is their own record and nothing else. The roll call, the class list and another learner's record are refused to an `own`-scoped caller rather than showing them the rest of the class               |
| The formula   | Attended ÷ classes marked, where "attended" is the statuses the institute counts (`present`, `late`, `excused` by default). A class nobody marked counts towards nobody, and a learner with no marked class has no percentage rather than 0% (plan FR-05.3) |
| One call      | Everybody starts present, so a full class is one request; only the exceptions are touched (plan AC-05.1)                                                                                                                                                    |
| Corrections   | Changing a mark that has already been taken needs a reason, and the record keeps who changed it, when and why. The audit row carries the before and after (plan AC-05.2)                                                                                    |
| The window    | `attendanceCorrectionWindowHours` (48 by default) from the moment the roll call was taken. After it, `attendance:manage` is required — an administrator can still put a record right; the trainer is told to ask                                            |
| When          | A class can be marked once it is live or finished, never before (`session_not_started`), and only for students on its roster (`not_in_batch`)                                                                                                               |
| Jobs          | `attendance.nudge_unmarked` every quarter hour tells a trainer about a class that finished an hour ago and has not been marked; `attendance.low_attendance` on Monday mornings tells learners who have fallen below the threshold. Both are safe to re-run  |
| Settings      | `academic.attendanceThresholdPct`, `academic.attendanceCountedStatuses`, `academic.attendanceCorrectionWindowHours`                                                                                                                                         |
| Events        | `attendance.marked`                                                                                                                                                                                                                                         |
| Audit         | `attendance.marked`, `attendance.corrected`                                                                                                                                                                                                                 |
| Tests         | `attendance-math.spec.ts` (the formula against a known dataset, AC-05.3); `test/attendance.e2e-spec.ts` (the journey, the window, the scopes); `apps/web/e2e/operations.spec.ts` (marking and correcting through the pages)                                 |

The reference portal also shows "week off" and "holiday" as attendance states. Here they are the
absence of a class rather than a mark against a person: a holiday is a skipped date on the
timetable, so nobody is marked and nobody's percentage moves.

## Phase 2 (2 October 2026)

- **One rule for the headline figure:** `headlineFor(studentId)` (the learner's current batches,
  since each began) is what the progress page, the dashboard and the Attendance page show.
- **History** covers every class since the batch began, with each class's time; low-attendance
  alerts look only at active memberships.

## Phases 3 and 4 (3 October 2026)

- **One save (TRN-04).** A roll call is written in one transaction: every mark or none. A student
  named twice in one roll call is refused (400).
- **Corrections are kept.** Changing a mark after it was first taken writes an
  `attendance_corrections` row (from, to, reason, who, when) and `attendance.corrected`; the
  roll call shows each learner's history.
- **A trainer sees a learner within their own batches (D6).** A learner's record, read by
  someone who teaches only some of their batches, holds those batches' classes only.
- **Tests:** `test/trainer-workflows.e2e-spec.ts` (atomic save, history), `test/staff-scope.e2e-spec.ts` (D6).
