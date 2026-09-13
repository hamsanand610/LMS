# ADR-0003: Own authentication with invitations and rotating refresh tokens

- Status: Accepted
- Context: Institutes onboard students by invitation; no per-user identity SaaS cost is acceptable; OTP and two-factor are later options (master §12.3, plan §7.2).
- Decision: Email + password with Argon2id hashing; short-lived access JWT (15 minutes) returned to the client and a rotating refresh token (30 days) in an httpOnly cookie, stored hashed in `sessions` with reuse detection; invitation and reset tokens single-use and hashed; login throttling; logout-all on password or role change. OTP and TOTP are adapters behind flags in later phases.
- Alternatives: Auth.js, Keycloak, Clerk/Auth0 (cost, external dependency, weaker fit for invite-first onboarding).
- Consequences: the auth module must be covered by unit, API and abuse tests; cookie settings differ per environment (`COOKIE_SECURE`).
