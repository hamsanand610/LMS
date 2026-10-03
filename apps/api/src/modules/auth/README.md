# auth module

Sign-in, sessions, invitations and password lifecycle (ADR-0003).

| Aspect               | Detail                                                                                                                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes               | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/invitations/:token/accept`, `POST /auth/password/forgot`, `POST /auth/password/reset`, `POST /auth/password/change` |
| Permissions          | None of its own: public routes are rate limited; session routes use `@AuthenticatedOnly()` (`auth:self`)                                                                                                                                                                   |
| Tokens               | Access JWT (15 min, `{sub, tv, sid}`) in the `lms_at` cookie or a Bearer header; rotating opaque refresh token (sha256-hashed in `sessions`, family reuse detection) in `lms_rt`; readable `lms_csrf` cookie for the double-submit header                                  |
| Password policy      | Argon2id; at least 10 characters; small common-password deny-list; lockout for 15 minutes after 5 failures                                                                                                                                                                 |
| Invitations / resets | Single-use hashed tokens (72 h / 1 h); links point at the web app (`WEB_BASE_URL`)                                                                                                                                                                                         |
| Events               | `user.logged_in`, `user.invitation_accepted`, `user.password_changed`                                                                                                                                                                                                      |
| Audit                | `auth.login`, `auth.login_failed`, `auth.logout`, `auth.refresh_reuse_detected`, `auth.password_changed`, …                                                                                                                                                                |
| Emails               | Invitation and password reset sent at once (`EmailService.sendNow`: a queued job would keep the link for days); password changed queued                                                                                                                                    |
| Tests                | `src/modules/auth/password.spec.ts`; `test/auth.e2e-spec.ts` (cookies, CSRF, refresh rotation, lockout, logout)                                                                                                                                                            |

Cross-module rule: other modules never read sessions or tokens; they receive `AuthUser` from the guard.

## Phase 2 (2 October 2026)

- **Password change** is limited per account (5 per 15 minutes, whatever session the attempts
  come from) as well as per session on the route, so the current password cannot be guessed by
  refreshing between tries.

## Phase 6 (3 October 2026)

- **A session's access token ends with it.** The guard asks whether the token's session family is
  live (cached 15 s, cleared by every revocation): sign-out, a revoked device, an administrator
  ending a session, a role change and a deactivation end the token in hand.
- **Refresh** keeps the family, the sign-in's expiry and its remember-me choice
  (`sessions.persistent`). A rotation is recorded (`sessions.rotated_at`): the same token again
  within 30 s, in a family nobody signed out, is a second tab and gets its own session; later, it is
  a leaked token and the family ends (`auth.refresh_reuse_detected`).
- **Links.** An invitation activates only an `invited` account (409 for an active one, 410
  otherwise), a reset link only an `active` one (410); both are claimed in a transaction and end
  the account's other links; a password change ends them too.
- **Sign-in.** A request without a session cookie whose `Origin` is not the app's is refused
  (`csrf_failed`); a lock starts the failure count again; a successful sign-in is not counted by the
  rate limit, only failures.
- **Tests:** `test/auth-hardening.e2e-spec.ts`.
