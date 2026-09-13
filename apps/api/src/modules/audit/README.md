# audit module

Read side of the append-only audit log. Writing happens through the core `AuditService`
(`record()`), which every module calls for state changes; it redacts password hashes and tokens and
never throws into the caller's request.

| Aspect      | Detail                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Routes      | `GET /audit-logs` (filters: `actorId`, `action` prefix, `resourceType`, `resourceId`, `from`, `to`; paginated)                      |
| Permissions | `audit:read` with scopes `all` (Super Admin) or `own` (Admin sees only their own actions)                                           |
| Row shape   | who (actor), when, action key (`module.event`), resource type and id, summary, before/after snapshots, IP, request id               |
| Retention   | Not enforced yet; an archival job is a later-phase item                                                                             |
| Tests       | `test/permissions.e2e-spec.ts` (own scope), `test/auth.e2e-spec.ts` and `test/settings.e2e-spec.ts` (rows written by other modules) |
