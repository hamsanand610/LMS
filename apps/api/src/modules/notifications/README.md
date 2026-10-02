# notifications module

In-app messages, email delivery and announcements.

| Aspect        | Detail                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes        | `GET /me/notifications`, `GET /me/notifications/summary`, `GET /me/notifications/announcements`, `GET/PATCH /me/notifications/preferences`, `PATCH /me/notifications/:id/read`, `POST /me/notifications/read-all`; `POST /notifications/broadcast`, `POST /notifications/broadcast/preview`; `GET/POST /announcements`, `PATCH/DELETE /announcements/:id` |
| Permissions   | Own notifications are `@AuthenticatedOnly()`; `notifications:broadcast` (scope `all` or `batch`) to message a group; `announcements:manage` for announcements                                                                                                                                                                                             |
| Delivery      | `NotificationsService.deliver` queues a job; the job resolves the audience, writes the in-app rows in one insert and queues one email per recipient who wants email                                                                                                                                                                                       |
| Audience      | Roles, batches and programmes combine with OR. An empty audience means everyone with an active or invited account                                                                                                                                                                                                                                         |
| Scope         | A `batch`-scoped sender is narrowed to their own batches. If nothing remains after narrowing the result is nobody, never everybody                                                                                                                                                                                                                        |
| Preferences   | Per category (account, batch, announcement, content, assessment, attendance) and per channel; an absent row means the documented default                                                                                                                                                                                                                  |
| Announcements | Carry a validity window. One that starts in the future is delivered by the `announcements.dispatch` job (every five minutes), exactly once, guarded by `delivered_at`; ended ones are marked expired                                                                                                                                                      |
| Events        | `notification.created`, `announcement.published`                                                                                                                                                                                                                                                                                                          |
| Audit         | `announcements.created`, `announcements.updated`, `announcements.deleted`                                                                                                                                                                                                                                                                                 |
| Tests         | `test/notifications.e2e-spec.ts` (batch-only delivery, scope narrowing, read state, preferences, immediate and scheduled announcements, permissions)                                                                                                                                                                                                      |

Client-editable email templates (plan M-16) still live in code (`core/email/templates.ts`); moving
them into the database is a later-phase item.

## Phase 2 (2 October 2026)

- **E-mail links** reach the portal: a relative link is made absolute with `WEB_BASE_URL`.
- **`unread`** is read as written: `true` the unread ones, `false` the read ones, absent everything.
- **`POST /me/notifications/read-all?category=`** marks one category read when the centre is
  filtered to it. The account category is always delivered in the app.
- **`alreadySent(type, key, value)`** lets a reminder job send each notice once.
- **New notices:** a class scheduled (`session.scheduled`), an assignment due soon, a test window
  closing, a document reviewed, a certificate issued.

## Phases 3 and 4 (3 October 2026)

- **Trainers announce to their own batches (TRN-08, D7).** `announcements:manage` at `batch` (a
  named bundle change): the audience must be batches they teach (no roles or programmes), and they
  list and change only what they wrote. A delivered announcement's start cannot move
  (`announcement_delivered`).
- **Broadcasts** are audited (`notifications.broadcast`) and limited to 20 an hour per person.
- **New notices:** `doubt.resolved`, `doubt.reopened`, `test.window_extended`, `test.remarked`,
  `certificate.status`, feedback rounds opening.
- **Tests:** `test/trainer-workflows.e2e-spec.ts`, `test/notifications.e2e-spec.ts`.
