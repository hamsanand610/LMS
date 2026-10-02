# ADR-0009 — Applying default role permissions when a new module ships

- **Status**: accepted
- **Date**: 2026-09-13
- **Phase**: 2 (Admin foundation)

## Context

Every module contributes its permissions to the catalogue through its manifest, and the system
roles (Admin, Trainer, Student, Placement Coordinator, Content Manager) ship with a default
bundle. Clients may edit those bundles in the roles matrix, and operating rule 24 plus plan §13.4
require that client edits survive template upgrades.

In Phase 1 the seeder applied a role's default bundle only when the role had no permissions at
all. That is safe but wrong on upgrade: when Phase 2 added `students:*`, `batches:*` and the rest,
an existing deployment would have left Admin without them, and every client would have had to
re-grant new permissions by hand after each upgrade.

The opposite behaviour — re-applying the whole default bundle on every boot — is worse: it silently
undoes deliberate client decisions, such as taking `users:import` away from Admin.

## Decision

Keep a **catalogue watermark**: the setting `rbac.seeded_permissions` records every permission key
the seeder has already handed out for this organisation.

On each `syncSystemRoles` run:

1. Super Admin is brought up to the complete catalogue, as before; it is never editable.
2. For every other system role, default entries are applied only for permission keys that are
   **not yet in the watermark** (new modules), or for a role that has no permissions at all
   (freshly created role, or the very first run).
3. The watermark is then set to the full catalogue.

Existing grants are never modified: the upsert leaves the scope of a permission a client already
holds untouched, so a client who widened or narrowed a scope keeps their choice.

## Consequences

- A new module's permissions reach the roles that should have them, once, on the next boot or seed.
- A permission a client removed stays removed, because its key is already past the watermark.
- A client who deliberately removes a **brand-new** permission before upgrading cannot express that
  intention; this is acceptable because the permission did not exist for them yet.
- The watermark is per organisation and stored as a setting, so it travels with a database dump and
  needs no extra table.
- Removing a permission from the catalogue is not handled here. Plan §13.4 asks for a warning when a
  client role references a permission an upgrade removed; that check belongs with the upgrade
  validator and is not part of this decision.

## Alternatives considered

- **A `source` column on `role_permissions`** (system vs client). More precise, but it needs a
  migration, and every UI edit must maintain it correctly; the watermark achieves the same result
  for the case that matters with no schema change.
- **Version-stamped bundles** (each bundle entry carries the template version that introduced it).
  Equivalent in effect to the watermark but harder to keep honest across manual edits of the bundle
  table in code.
- **Manual upgrade notes** telling operators which permissions to grant. Rejected: it is exactly the
  kind of step that gets skipped, and it leaves clients with silently broken pages.

## Amendment (3 October 2026, Roadmap Phases 3–4)

The watermark hands out a permission's default grants only when the key is new, so a grant added
later to a system role for a key the catalogue already had would never arrive. Phases 3–4 needed
two such grants (the trainer's `courses:publish` and `announcements:manage` at `batch`, decisions D1
and D7). They are **named bundle changes** (`BUNDLE_CHANGES` in
`apps/api/src/modules/rbac/role-bundles.ts`): each has a stable id and is applied once per
organisation, its id then recorded in the setting `rbac.applied_bundle_changes`. As with the
watermark, a client who later removes the grant keeps it removed, and an existing grant's scope is
never changed. Proposed with ADR-0023, for the client's decision at the Phases 3–4 gate.
