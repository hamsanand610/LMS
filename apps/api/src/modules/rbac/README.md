# rbac module

Roles, permission bundles and scopes (ADR-0004; architecture plan §13).

| Aspect       | Detail                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes       | `GET /roles`, `POST /roles`, `PATCH /roles/:id`, `GET /roles/:id/permissions`, `PUT /roles/:id/permissions`, `GET /permissions`                                              |
| Permissions  | `roles:read`, `roles:manage`                                                                                                                                                 |
| Catalogue    | Every module declares its permissions in its manifest; `syncPermissionCatalogue` writes them to `permissions` at boot and in the seed                                        |
| System roles | `role-bundles.ts` (`super_admin` always holds every permission at scope `all`; other bundles are defaults a client may edit)                                                 |
| Scopes       | `all` (every record), `batch` (records of the user's batches, from Phase 2), `own` (the user's own records); the permission guard records the effective scope on the request |
| Cache        | Role/permission lookups are cached for 60 s per user (`AuthContextService`); bundle changes invalidate immediately                                                           |
| Audit        | `rbac.role_created`, `rbac.role_updated`, `rbac.bundle_updated`                                                                                                              |
| Tests        | `test/route-table.e2e-spec.ts` (every route declares a permission or is public), `test/permissions.e2e-spec.ts` (matrix for the four roles)                                  |

Adding a permission: add it to the module manifest (`FOUNDATION_PERMISSIONS` for foundation modules),
reference it with `@RequirePermission`, extend the default bundles where appropriate, and extend
`permissions.e2e-spec.ts`.

## Phases 3 and 4 (3 October 2026)

- **No privilege from someone who lacks it (D4, SEC-03).** Granting, removing or managing a role
  needs every permission it carries at the same scope or wider; nobody but a Super Admin changes
  their own roles; role bundles keep to the scopes the catalogue allows; the Super Admin role is
  never copied.
- **Named bundle changes (amends ADR-0009).** `BUNDLE_CHANGES` adds a grant to a system role for a
  permission the catalogue already had; each is applied once per institute and remembered in the
  setting `rbac.applied_bundle_changes`, so a client who later removes it keeps it removed. This
  phase: the trainer's `courses:publish` and `announcements:manage` at `batch`.
- **New permissions:** `courses:author`, `certificates:manage`, `feedback:manage`, `feedback:read`,
  `feedback:respond`, `privacy:manage` (in no bundle but the Super Admin's).
- **Tests:** `test/role-boundaries.e2e-spec.ts` (every route, five roles), `test/staff-scope.e2e-spec.ts`,
  `role-matrix.spec.ts`. The matrix: `docs/architecture/PERMISSION_MATRIX.md`.
