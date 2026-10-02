# Permission matrix

Generated from the code — the catalogue (`packages/shared/src/permissions.ts`) and the default
bundles with their named changes (`apps/api/src/modules/rbac/role-bundles.ts`) — by
`pnpm docs:permissions` (`scripts/permission-matrix.mjs`); never edited by hand. These are the
**defaults** a new institute starts with; a client edits bundles in the Roles screen (ADR-0009), and
`test/permissions.e2e-spec.ts` proves that each seeded role holds exactly its declared bundle.

Scopes: **all** — every record; **batch** — the records of the batches one teaches (a learner's
`batch` reach is the batches they learn in); **own** — one's own records. "—" means not held.
Every route declares one permission, at a minimum scope where it needs one, and is refused with
403 before its handler runs (`test/role-boundaries.e2e-spec.ts`, every route, five roles). The
route is only the first check: the services decide which records a scope reaches (ADR-0004,
decisions D1–D10 of `docs/phases/PHASE-03-04-trainer-and-admin.md`).

**Held by the Super Admin alone:** `roles:manage`, `privacy:manage`, `settings:manage`, `branding:manage`, `flags:manage`.

| Permission                  | Module        | What it allows                                                                                        | Super Admin | Admin | Trainer | Student | Placement | Content |
| --------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- | ----------- | ----- | ------- | ------- | --------- | ------- |
| `roles:read`                | rbac          | View roles and the permission matrix                                                                  | all         | all   | —       | —       | —         | —       |
| `roles:manage`              | rbac          | Create roles and edit permission bundles                                                              | all         | —     | —       | —       | —         | —       |
| `users:read`                | users         | View staff accounts                                                                                   | all         | all   | —       | —       | —         | —       |
| `users:manage`              | users         | Invite, edit, deactivate accounts and assign roles                                                    | all         | all   | —       | —       | —         | —       |
| `users:import`              | users         | Bulk import accounts                                                                                  | all         | all   | —       | —       | —         | —       |
| `privacy:manage`            | users         | Export a learner's data, and erase it by anonymisation                                                | all         | —     | —       | —       | —         | —       |
| `settings:read`             | settings      | View institute settings                                                                               | all         | all   | —       | —       | —         | —       |
| `settings:manage`           | settings      | Change institute settings, navigation, fields, templates, integrations                                | all         | —     | —       | —       | —         | —       |
| `branding:manage`           | settings      | Change branding and theme                                                                             | all         | —     | —       | —       | —         | —       |
| `flags:manage`              | settings      | Enable or disable modules and options                                                                 | all         | —     | —       | —       | —         | —       |
| `audit:read`                | audit         | View the audit log                                                                                    | all         | own   | —       | —       | —         | —       |
| `files:upload`              | files         | Upload files in permitted contexts                                                                    | all         | all   | own     | own     | own       | all     |
| `files:read`                | files         | Download files in permitted contexts                                                                  | all         | all   | own     | own     | own       | all     |
| `search:use`                | search        | Use global search                                                                                     | all         | all   | batch   | own     | all       | all     |
| `notifications:read`        | notifications | Read own notifications                                                                                | all         | own   | own     | own     | own       | own     |
| `notifications:broadcast`   | notifications | Send a message to a group of people                                                                   | all         | all   | batch   | —       | —         | —       |
| `announcements:manage`      | notifications | Create and schedule announcements (batch = to the batches one teaches, and only one’s own)            | all         | all   | batch   | —       | —         | —       |
| `students:read`             | students      | View student records                                                                                  | all         | all   | batch   | —       | all       | —       |
| `students:manage`           | students      | Create, edit and change the status of students                                                        | all         | all   | —       | —       | —         | —       |
| `students:read_sensitive`   | students      | See personal details and documents of students                                                        | all         | all   | —       | —       | all       | —       |
| `students:verify_documents` | students      | Verify or reject uploaded student documents                                                           | all         | all   | —       | —       | all       | —       |
| `trainers:read`             | trainers      | View trainer records                                                                                  | all         | all   | own     | —       | all       | —       |
| `trainers:manage`           | trainers      | Create and edit trainers and their batch assignments                                                  | all         | all   | —       | —       | —         | —       |
| `batches:read`              | batches       | View batches and their rosters                                                                        | all         | all   | batch   | —       | all       | all     |
| `batches:manage`            | batches       | Create batches, manage members, trainers and status                                                   | all         | all   | —       | —       | —         | —       |
| `programs:manage`           | batches       | Create and edit programmes                                                                            | all         | all   | —       | —       | —         | —       |
| `reports:read`              | reports       | View the dashboard and reports                                                                        | all         | all   | batch   | —       | all       | —       |
| `reports:export`            | reports       | Export a report as a spreadsheet                                                                      | all         | all   | batch   | —       | all       | —       |
| `courses:read`              | courses       | Open courses and lessons                                                                              | all         | all   | batch   | own     | —         | all     |
| `courses:manage`            | courses       | Create, archive and staff courses, and change any of them                                             | all         | all   | —       | —       | —         | all     |
| `courses:author`            | courses       | Change a course's details and outline (own = the courses one is staff of)                             | all         | all   | own     | —       | —         | all     |
| `courses:publish`           | courses       | Publish a course to a programme or a batch (batch = a course one is staff of, to a batch one teaches) | all         | all   | batch   | —       | —         | —       |
| `progress:read`             | progress      | See how far learners have got                                                                         | all         | all   | batch   | own     | all       | —       |
| `sessions:read`             | sessions      | See the timetable                                                                                     | all         | all   | batch   | own     | all       | —       |
| `sessions:manage`           | sessions      | Create and reschedule class series and sessions                                                       | all         | all   | —       | —       | —         | —       |
| `sessions:run`              | sessions      | Start or finish a session and attach its recording                                                    | all         | all   | batch   | —       | —         | —       |
| `questions:read`            | questions     | Browse the question bank                                                                              | all         | all   | own     | —       | —         | all     |
| `questions:create_own`      | questions     | Author questions and edit the ones you wrote                                                          | all         | own   | own     | —       | —         | own     |
| `questions:manage`          | questions     | Edit, publish and retire any question                                                                 | all         | all   | —       | —       | —         | all     |
| `questions:import`          | questions     | Import questions from a spreadsheet                                                                   | all         | all   | —       | —       | —         | all     |
| `assignments:read`          | assignments   | Open assignments                                                                                      | all         | all   | batch   | own     | —         | all     |
| `assignments:submit`        | assignments   | Answer the questions in an assignment                                                                 | all         | —     | —       | own     | —         | —       |
| `assignments:manage`        | assignments   | Create assignments and edit their structure                                                           | all         | all   | batch   | —       | —         | all     |
| `assignments:publish`       | assignments   | Publish an assignment to a batch                                                                      | all         | all   | batch   | —       | —         | —       |
| `assignments:grade`         | assignments   | Mark written answers                                                                                  | all         | all   | batch   | —       | —         | —       |
| `tests:read`                | tests         | See tests and their results                                                                           | all         | all   | batch   | own     | all       | all     |
| `tests:attempt`             | tests         | Sit a test                                                                                            | all         | —     | —       | own     | —         | —       |
| `tests:manage`              | tests         | Build a test and set its rules                                                                        | all         | all   | batch   | —       | —         | all     |
| `tests:schedule`            | tests         | Open a test to a batch for a window of time                                                           | all         | all   | batch   | —       | —         | —       |
| `tests:grade`               | tests         | Mark written answers in a test                                                                        | all         | all   | batch   | —       | —         | —       |
| `tests:release`             | tests         | Release results to the learners who sat the test                                                      | all         | all   | batch   | —       | —         | —       |
| `tests:monitor`             | tests         | Watch a test while it is running                                                                      | all         | all   | batch   | —       | —         | —       |
| `practice:use`              | practice      | Solve coding practice problems                                                                        | all         | —     | —       | own     | —         | —       |
| `practice:manage`           | practice      | Choose which problems appear in the practice catalogue                                                | all         | all   | —       | —       | —         | all     |
| `practice:publish_own`      | practice      | Put labs you wrote in the Labs catalogue, or take them out                                            | all         | own   | own     | —       | —         | own     |
| `practice:review`           | practice      | See learners' lab attempts and submissions                                                            | all         | all   | batch   | —       | —         | —       |
| `attendance:read`           | attendance    | See who attended a class                                                                              | all         | all   | batch   | own     | all       | —       |
| `attendance:mark`           | attendance    | Take the roll call for a class and correct it inside the window                                       | all         | all   | batch   | —       | —         | —       |
| `attendance:manage`         | attendance    | Correct attendance after the window has closed                                                        | all         | all   | —       | —       | —         | —       |
| `profile:read`              | profile       | See your own profile                                                                                  | all         | —     | —       | own     | —         | —       |
| `profile:update`            | profile       | Edit your own profile, resumes and documents                                                          | all         | —     | —       | own     | —         | —       |
| `placements:read`           | placement     | See companies, interview-prep kits and placement drives                                               | all         | all   | —       | own     | all       | —       |
| `placements:manage`         | placement     | Manage companies, kits, drives and applicants                                                         | all         | all   | —       | —       | all       | —       |
| `placements:apply`          | placement     | Apply to a placement drive                                                                            | all         | —     | —       | own     | —         | —       |
| `leaderboard:read`          | gamification  | See the points leaderboard (own = your batch)                                                         | all         | all   | batch   | own     | —         | —       |
| `doubts:ask`                | doubts        | Ask a doubt about a course or lesson, and follow its thread                                           | all         | —     | —       | own     | —         | —       |
| `doubts:answer`             | doubts        | Answer learners' doubts                                                                               | all         | all   | batch   | —       | —         | —       |
| `certificates:read`         | certificates  | See certificates of course completion (own = your own)                                                | all         | all   | batch   | own     | —         | —       |
| `certificates:manage`       | certificates  | Revoke, reinstate and redraw certificates; the issued record is never rewritten                       | all         | all   | —       | —       | —         | —       |
| `feedback:manage`           | feedback      | Give feedback forms to batches and read every answer                                                  | all         | all   | —       | —       | —         | —       |
| `feedback:read`             | feedback      | See feedback figures and comments (own = the forms about oneself)                                     | all         | all   | own     | —       | —         | —       |
| `feedback:respond`          | feedback      | Answer the feedback forms given to one's batch                                                        | all         | —     | —       | own     | —         | —       |

## Rules the matrix does not show

- **Granting (D4).** A role can be granted, removed or managed only by someone holding every
  permission it carries at the same scope or wider; nobody but a Super Admin changes their own
  roles; the Super Admin role is never copied; a bundle keeps to the scopes the catalogue allows.
- **Trainer reach (D1, D6).** A trainer's `batch` scope is the batches they teach; their authority
  over a course's content comes from course staff (ADR-0023), not from the batch; a learner is
  seen within the trainer's batches only.
- **Authored content (D2).** Content reached through a batch can be used, not changed: changing it
  needs its author or institute-wide staff.
- **Answered content (D3).** A paper or a question's key stops changing once answered.
- **Flags (D5).** A module's flag audience (roles, batches) is enforced on the server.
- **Feedback (D10).** Anonymous answers are never traceable; figures appear from five answers.
- **Privacy (ADM-11).** Export and erasure of a learner's data are the Super Admin's
  (`privacy:manage`) and audited.
