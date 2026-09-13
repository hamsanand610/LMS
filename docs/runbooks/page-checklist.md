# Page Completion Rule

Adopted verbatim from the customer brief (architecture plan §23.3). A page is **complete** only when
every item below is true. Pages that do not meet this are labelled _temporary wireframe_ in the UI
(non-production badge) and in the progress log.

| #   | Item                             | Evidence expected                                                                            |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | UI implemented                   | Screenshot or review                                                                         |
| 2   | Responsive design implemented    | Mobile and desktop screenshots; Playwright `mobile` project                                  |
| 3   | Navigation works                 | Reachable from the sidebar/menu; deep link works; back navigation sane                       |
| 4   | APIs connected                   | No mocked data left; every call goes through the typed client                                |
| 5   | Database operations work         | Rows created/updated as expected; migrations applied                                         |
| 6   | Validation works                 | Client and server messages for invalid input                                                 |
| 7   | Permissions work                 | Allowed roles see it; others get 403 or no menu entry; API test in `permissions.e2e-spec.ts` |
| 8   | Loading states exist             | Skeleton or spinner while fetching                                                           |
| 9   | Empty states exist               | Helpful text and the primary action when there is nothing yet                                |
| 10  | Error states exist               | Recoverable error with retry and reference id                                                |
| 11  | Success states exist             | Toast or inline confirmation after saving                                                    |
| 12  | Forms work                       | Submit, discard, dirty tracking, field errors                                                |
| 13  | Tables and filters work          | Sorting, filtering, paging where present                                                     |
| 14  | Related pages connected          | Links to detail/parent pages                                                                 |
| 15  | Complete user journey works      | The journey (J-xx) passes end to end                                                         |
| 16  | Relevant tests pass              | Unit/API/E2E referenced in the module README                                                 |
| 17  | Included in the demo walkthrough | Step listed in the demo script                                                               |

## Phase 1 status

| Page                            | Route                                         | Status                                        | Notes                                                                                     |
| ------------------------------- | --------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Sign in                         | `/login`                                      | complete                                      | smoke test                                                                                |
| Forgot / reset password         | `/forgot-password`, `/reset-password/[token]` | complete (API tested; browser journey manual) | emails visible in Mailpit                                                                 |
| Accept invitation               | `/invite/[token]`                             | complete (manual)                             | journey J-01 automated in Phase 2                                                         |
| Admin home                      | `/admin`                                      | complete for Phase 1                          | metric tiles arrive with reporting (Phase 5), stated on the page                          |
| Users                           | `/admin/users`                                | complete for accounts                         | student/trainer profiles and import are Phase 2                                           |
| General settings                | `/admin/settings/general`                     | complete                                      |                                                                                           |
| Branding                        | `/admin/settings/branding`                    | complete                                      | live preview, contrast check, uploads                                                     |
| Feature flags                   | `/admin/settings/feature-flags`               | complete                                      | Phase 1 has only core (locked) modules, so the list is empty until Phase 2 modules arrive |
| Navigation                      | `/admin/settings/navigation`                  | complete                                      |                                                                                           |
| Roles and permissions           | `/admin/settings/roles`                       | complete                                      |                                                                                           |
| Audit log                       | `/admin/settings/audit-log`                   | complete                                      |                                                                                           |
| System health                   | `/admin/settings/system-health`               | complete                                      |                                                                                           |
| My account                      | `/account`                                    | complete                                      |                                                                                           |
| Trainer home, student dashboard | `/trainer`, `/dashboard`                      | temporary wireframe                           | content arrives with Phases 2–3                                                           |
