# Page Completion Rule

Adopted verbatim from the customer brief (architecture plan §23.3). A page is **complete** only when
every item below is true. Pages that do not meet this are labelled _temporary wireframe_ in the UI
(non-production badge) and in the progress log.

| #   | Item                             | Evidence expected                                                                    |
| --- | -------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | UI implemented                   | Screenshot or review                                                                 |
| 2   | Responsive design implemented    | Mobile and desktop screenshots; Playwright `mobile` project                          |
| 3   | Navigation works                 | Reachable from the sidebar/menu; deep link works; back navigation sane               |
| 4   | APIs connected                   | No mocked data left; every call goes through the typed client                        |
| 5   | Database operations work         | Rows created/updated as expected; migrations applied                                 |
| 6   | Validation works                 | Client and server messages for invalid input                                         |
| 7   | Permissions work                 | Allowed roles see it; others get 403 or no menu entry; API test in the module's spec |
| 8   | Loading states exist             | Skeleton or spinner while fetching                                                   |
| 9   | Empty states exist               | Helpful text and the primary action when there is nothing yet                        |
| 10  | Error states exist               | Recoverable error with retry and reference id                                        |
| 11  | Success states exist             | Toast or inline confirmation after saving                                            |
| 12  | Forms work                       | Submit, discard, dirty tracking, field errors                                        |
| 13  | Tables and filters work          | Sorting, filtering, paging where present                                             |
| 14  | Related pages connected          | Links to detail/parent pages                                                         |
| 15  | Complete user journey works      | The journey (J-xx) passes end to end                                                 |
| 16  | Relevant tests pass              | Unit/API/E2E referenced in the module README                                         |
| 17  | Included in the demo walkthrough | Step listed in the demo script                                                       |

## Status after Phase 2

| Page                                                                                   | Route                                         | Status                                        | Notes                                                                                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Sign in                                                                                | `/login`                                      | complete                                      | smoke test; restores a session silently when only the access token expired                                                 |
| Forgot / reset password                                                                | `/forgot-password`, `/reset-password/[token]` | complete (API tested; browser journey manual) | emails visible in Mailpit                                                                                                  |
| Accept invitation                                                                      | `/invite/[token]`                             | complete (manual)                             | the J-01 acceptance step is automated in Phase 3 with the student portal                                                   |
| Admin dashboard                                                                        | `/admin`                                      | complete for what is measurable               | people and batch tiles are real; attendance, completion and assessment tiles state the phase that will deliver them        |
| Users                                                                                  | `/admin/users`                                | complete                                      | staff accounts                                                                                                             |
| Students                                                                               | `/admin/students`                             | complete                                      | filters, create, profile completeness                                                                                      |
| Student import                                                                         | `/admin/students/import`                      | complete                                      | template, dry run, row-by-row error report, job polling                                                                    |
| Student detail                                                                         | `/admin/students/[id]`                        | complete for Phase 2                          | profile, batches, documents, notes; attendance, progress and submissions tabs arrive with their modules                    |
| Trainers                                                                               | `/admin/trainers`, `/admin/trainers/[id]`     | complete                                      | records, subjects, assignment list                                                                                         |
| Programmes                                                                             | `/admin/programs`                             | complete                                      | create, archive                                                                                                            |
| Batches                                                                                | `/admin/batches`                              | complete                                      | filters, create                                                                                                            |
| Batch detail                                                                           | `/admin/batches/[id]`                         | complete for Phase 2                          | roster with history, trainer assignments, status transitions; the timetable tab states that the schedule module is Phase 3 |
| Announcements                                                                          | `/admin/announcements`                        | complete                                      | audience preview, immediate and scheduled delivery                                                                         |
| Custom fields                                                                          | `/admin/settings/custom-fields`               | complete                                      | student and batch fields                                                                                                   |
| General settings, Branding, Feature flags, Navigation, Roles, Audit log, System health | `/admin/settings/*`                           | complete                                      | Phase 1                                                                                                                    |
| Notifications                                                                          | `/notifications`                              | complete                                      | inbox, filters, preferences                                                                                                |
| My account                                                                             | `/account`                                    | complete                                      |                                                                                                                            |
| Trainer home                                                                           | `/trainer`                                    | complete for Phase 2                          | batch tiles for assigned batches; sessions and grading arrive with their modules                                           |
| Trainer batches                                                                        | `/trainer/batches`, `/trainer/batches/[id]`   | complete                                      | read-only view of own batches                                                                                              |
| Student dashboard                                                                      | `/dashboard`                                  | temporary wireframe                           | states the enrolment and links to notifications and account; courses and schedule arrive in Phase 3                        |
