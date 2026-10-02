# ADR-0020 — SQL Lab: SQLite in the sandbox stays the teaching engine

- **Status**: proposed — built in Roadmap Phase 1, for the client's approval at the Phase 1 gate
- **Date**: 2026-10-02
- **Phase**: Roadmap Phase 1 (Labs and Playground)
- **Keeps**: ADR-0016 (the sandbox runner)

## Context

SQL practice already runs on SQLite inside the sandbox. `infra/sandbox/sqlrun.py` works like this:

- it opens an in-memory database;
- it loads the question's dataset, then the case's own statements;
- it runs the learner's statements under an authoriser (no `ATTACH`, no unsafe pragmas, no
  extension or file functions), with a step budget and a cap on statements;
- it prints the result table as JSON.

The SQL Lab needs a schema browser, free queries shown as a table, a reset, and a guarantee that a
learner never reaches the platform's PostgreSQL, its data or its credentials.

The Phase 1 inspection found that a case's own statements (in a custom run, the learner's "extra
rows") ran before the authoriser and the step budget were installed.

## Decision

1. **The engine stays SQLite**, inside the sandbox container, in memory, one database per case. The
   engine is not migrated.
2. **Why SQLite stays isolated from PostgreSQL:**
   - the container has no network;
   - the image holds no client, driver or credential for the platform's database;
   - the database exists only in the memory of the process that runs the case, and disappears with
     it.

   So a learner's SQL cannot reach the LMS database, production data, another learner's work, or
   any credential, whatever it says.

3. **Every run starts from the dataset.** "Reset" restores the editor's starting query; there is no
   state to reset between runs because none survives one. This is told to the learner.
4. **The fix.**
   - The trusted dataset still loads first.
   - The authoriser and the step budget are now installed before the case's own statements, which
     run one at a time under them.
   - The trusted check query still runs without the authoriser.
5. **The schema browser.**
   - Tables, columns, types and keys are read in the sandbox with SQLite's own `pragma_table_info`,
     against the dataset.
   - This happens when the question is validated, or when it is first opened if it never was. The
     result is cached on the problem (`sql_schema`) and cleared whenever the dataset changes.
   - Learners also still see the dataset itself.

## Consequences

- **The dialect.** Learners learn SQLite's dialect: standard SELECT, joins, grouping, window
  functions, CTEs and DML. Vendor-specific syntax (PostgreSQL types, `ILIKE`) is not available.
  Authors are told this in the editor.
- **No new infrastructure.** No new service, credential or network path.

## Alternatives considered

- **A disposable PostgreSQL per run.** Its own container and network would make startup far
  slower, and would bring a second database engine into the sandbox. Not justified for a teaching
  dataset.
- **A shared lab database with per-learner schemas.** That is shared state and a network path from
  learner SQL to a database server. Rejected.
