# ADR-0026 — Vector storage readiness

- **Status**: accepted (decided in the client's Phase 7A brief, 3 October 2026)
- **Date**: 2026-10-03
- **Phase**: Roadmap Phase 7 (AI foundation), slice 7A
- **Implements**: `docs/architecture/AI_ARCHITECTURE.md` §9, decision 3

## Context

Retrieval (Phase 8) needs vector search. Keeping vectors in the same PostgreSQL keeps chunk metadata
in the same transactions and lets authorisation filters be plain joins. Today every environment runs
`postgres:16-alpine`, which has no pgvector. The database's collation is `en_US.utf8` under Alpine's
musl library, which orders text byte by byte; Debian-based pgvector images use glibc, which orders it
differently.

## Decision

1. **PostgreSQL with pgvector** is the intended storage for retrieval.
2. pgvector is **not** enabled in Phase 7A, and the PostgreSQL image and databases are not changed.
3. Readiness is a gated step before Phase 8, planned in Phase 7F or the Phase 8 plan:
   - a glibc-based image must never be pointed at an existing musl data volume, because its text
     indexes would be read in a different order;
   - the change is either an Alpine image with pgvector built in, applied in place, or a dump and
     restore under the database gate;
   - local, CI and staging change together. A move to AWS RDS is a dump and restore anyway.

## Alternatives

- A separate vector database: a second store, and authorisation joins become cross-system filters.
- Enabling pgvector now: infrastructure risk with nothing yet to use it.

## Consequences

- No Phase 7 table depends on a vector column.
- Prisma's `Unsupported("vector(n)")` columns and the raw-SQL index migrations belong to Phase 8.
