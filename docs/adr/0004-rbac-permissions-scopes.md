# ADR-0004: Permission-based RBAC with scopes

- Status: Accepted
- Context: Four demo roles plus seeded placement and content roles; trainers see only their batches; clients edit role bundles without code (master §7, plan §13).
- Decision: Permissions are `resource:action` strings contributed by module manifests and seeded into a catalogue; roles are database-stored bundles with a scope (`all`, `batch`, `own`) per permission; the API enforces with a permission guard plus service-level scope filters; every route declares a permission or is explicitly public (a test walks the route table); the web hides what the API forbids; role changes are audited and propagate within a minute via cache TTL.
- Alternatives: hard-coded role checks (not configurable), CASL (can be layered later if rules grow).
- Consequences: new permissions require module code and tests; clients cannot invent permissions, only bundles.
