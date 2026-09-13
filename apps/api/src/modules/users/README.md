# users module

Accounts and the signed-in user's own view (`/me`).

| Aspect      | Detail                                                                                                                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes      | `GET /users`, `POST /users` (invite), `GET /users/:id`, `PATCH /users/:id`, `POST /users/:id/deactivate`, `POST /users/:id/reactivate`, `PUT /users/:id/roles`, `POST /users/:id/invitations/resend`; `GET /me`, `PATCH /me` |
| Permissions | `users:read`, `users:manage`, `users:import` (bulk import arrives in Phase 2); `/me` is `@AuthenticatedOnly()`                                                                                                               |
| Rules       | An account cannot deactivate itself; the last active Super Admin cannot be deactivated or demoted; only a Super Admin may grant `super_admin`; role changes end every session of the user (`tokenVersion`)                   |
| `/me`       | Identity, roles, home portal, granted permissions with scopes, effective feature flags, navigation per portal (after permissions, flags and client overrides), public branding, organisation and server time                 |
| Events      | `user.created`, `user.deactivated`, `user.roles_changed`                                                                                                                                                                     |
| Audit       | `users.invited`, `users.updated`, `users.deactivated`, `users.reactivated`, `users.roles_changed`, `users.invitation_resent`, `users.self_updated`                                                                           |
| Tests       | `test/permissions.e2e-spec.ts`, `test/auth.e2e-spec.ts` (`/me` contents)                                                                                                                                                     |

Students, trainers and their profiles (documents, custom fields, batches) are Phase 2 modules that
reference `users` by id; this module stays limited to accounts.
