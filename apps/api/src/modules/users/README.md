# users module

Accounts, the signed-in user's own view (`/me`), and the privacy operations on a learner.

| Aspect      | Detail                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Routes      | `GET /users`, `POST /users` (invite), `GET /users/:id`, `PATCH /users/:id`, `POST /users/:id/deactivate`, `POST /users/:id/reactivate`, `PUT /users/:id/roles`, `POST /users/:id/invitations/resend`, `POST /users/:id/unlock`, `GET/DELETE /users/:id/sessions[/:sessionId]`, `POST /users/:id/privacy/export`, `POST /users/:id/privacy/erase`; `GET /me`, `PATCH /me` |
| Permissions | `users:read`, `users:manage`, `users:import`; `privacy:manage` (in no bundle but the Super Admin's); `/me` is `@AuthenticatedOnly()`                                                                                                                                                                                                                                     |
| Rules       | An account cannot deactivate itself; the last active Super Admin cannot be deactivated or demoted; granting, removing or managing a role needs every permission it carries (D4); role changes end every session of the user (`tokenVersion`); ending all sessions also revokes access tokens already issued                                                              |
| Privacy     | See below                                                                                                                                                                                                                                                                                                                                                                |
| `/me`       | Identity, roles, home portal, granted permissions with scopes, effective feature flags, navigation per portal (after permissions, flags and client overrides), public branding, organisation and server time                                                                                                                                                             |
| Events      | `user.created`, `user.deactivated`, `user.roles_changed` (the students and trainers modules create the matching profile on the first and last)                                                                                                                                                                                                                           |
| Audit       | `users.invited`, `users.updated`, `users.deactivated`, `users.reactivated`, `users.roles_changed`, `users.invitation_resent`, `users.self_updated`, `users.unlocked`, `users.session_ended`, `users.signed_out_everywhere`, `privacy.exported`, `privacy.erased`                                                                                                         |
| Tests       | `test/permissions.e2e-spec.ts`, `test/auth.e2e-spec.ts` (`/me` contents), `test/admin-operations.e2e-spec.ts` (unlock, sessions, privacy)                                                                                                                                                                                                                                |

## Privacy operations (Phases 3–4, ADM-11)

Requests arrive outside the platform (the privacy notice names the contact); the Super Admin acts
on them from the learner's page (Privacy tab). Both operations are audited.

- **Export** (`POST /users/:id/privacy/export`) returns the learner's data as JSON
  (`LearnerDataExport`): account, profile (with the institute's own fields only where the field is
  visible to its owner), batches, enrolments, lessons, attendance, submissions with their text and
  code, tests (scores only once released), documents and résumés listed by file name, applications,
  doubts, certificates, named feedback answers, the latest 1,000 notifications and active sessions.
  Staff notes and staff-only fields are not the learner's and are not included.
- **Erasure** (`POST /users/:id/privacy/erase`, confirmed with the learner's e-mail address and a
  reason) anonymises rather than deletes, so the institute's figures keep their rows: the account
  becomes "Erased learner" with an unusable address, no password and no sessions; the profile,
  documents, résumés, photo, staff notes, notifications, activity, drafts and favourites are
  deleted, with their files removed from storage; certificates are withdrawn and their PDFs deleted
  (the record stays, so a verifier is told it is withdrawn); batch places end; the text of
  submissions, test answers, doubts, the learner's replies and review comments is removed, while
  marks, verdicts, attendance and progress stay. Accounts with a staff role are refused (they are
  deactivated, not erased), as is one's own account. The audit log is left as it is: it is the
  security record, and its retention is a setting of its own (ADM-12).

Students, trainers and their profiles (documents, custom fields, batches) are modules of their own
that reference `users` by id.

## Phase 5 (3 October 2026)

- **Deactivation and reactivation are followed through inside the request**:
  `user.deactivated` / `user.reactivated` are awaited, so places and courses settle before it
  returns. An erasure raises `user.deactivated` too.
