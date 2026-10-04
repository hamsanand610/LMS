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

## Readiness record (Phase 7F, 4 October 2026)

Phase 7F checked readiness and settled what Phase 8 needs decided before it starts. Nothing was
installed or enabled: no extension, image, column or index changed in Phase 7.

**Where things stand (checked 4 October 2026).**

- Local (`infra/compose.yml`), CI (`.github/workflows/ci.yml`) and staging
  (`infra/compose.staging.yml`) run `postgres:16-alpine`. The local server reports PostgreSQL 16.14
  on musl, and `vector` is not among its available extensions.
- `lms`, `lms_test` and `lms_preview` use the `en_US.utf8` collation and character type.
- No Phase 7 table has, or depends on, a vector column. The answer cache (ADR-0032) matches exact
  keys.

**Settled for Phase 8.**

1. **Storage.** One extension, `vector` (pgvector), in the existing database. Retrieval gets tables
   of its own — the knowledge sources and their chunks, with the metadata authorisation and
   filtering need (AI architecture §4) — and the vector column lives on the chunk table alone.
   `ai_conversations`, `ai_messages`, `ai_requests`, `ai_usage_daily` and `ai_cache_entries` gain
   no vector column. A similarity cache, if Phase 8 adds one, keeps its vectors in a table of its
   own, so the exact cache and its rules stay as they are.
2. **The image.** The preferred path keeps musl: an image built `FROM postgres:16-alpine` with a
   pinned pgvector release compiled in, used by local, CI and staging together, on their existing
   volumes. A glibc image (such as pgvector's own Debian-based one) is allowed only through a dump
   and a restore into a fresh volume under the database gate — never pointed at an existing data
   directory — with every text index rebuilt and checked. Managed PostgreSQL (AWS RDS) offers the
   extension; moving there is a dump and restore anyway.
3. **The migration.** A Phase 8 migration runs `CREATE EXTENSION IF NOT EXISTS vector` and creates
   the chunk table, its vector column as Prisma's `Unsupported("vector(n)")`, and its index in raw
   SQL. It reaches `lms` like every migration: after a verified backup and the client's approval
   (runbook §5).
4. **The dimension.** Fixed by the embedding model Phase 8 chooses (ADR-0027), stored with every
   vector beside the model's name, and at most 2,000, so the `vector` type's HNSW index applies. A
   model whose native size is larger is used at a reduced output size when the provider offers one;
   otherwise the column is `halfvec`, whose HNSW index accepts up to 4,000. A change of model or
   dimension embeds everything again into a new column or table, then switches over: vectors of
   two models are never compared.
5. **The index.** HNSW, with the distance the chosen model is made for (cosine,
   `vector_cosine_ops`, unless the model's documentation says otherwise), built after the first
   load. The authorisation filters (institute, course, visibility) are in the same query, and
   pgvector's iterative index scans keep a filtered query from returning too few rows. IVFFlat is
   not used: it needs trained lists, rebuilt as the data grows.
6. **Local and tests.** The same image runs locally and in CI, so `lms_test` gets the extension
   from the migrations like any other schema change. No test embeds through a real provider: a
   deterministic stand-in embeds, as the fake provider answers.
7. **Ownership.** All of this is Phase 8's, started only after the client approves Phase 7 and the
   Phase 7 migrations have reached `lms` under the database gate.

## Phase 8A record (4 October 2026)

Phase 8A prepared the image and proved it. No environment uses it yet.

- **The image.** `infra/postgres/Dockerfile` builds `FROM postgres:16-alpine` (the `POSTGRES_IMAGE`
  argument) with pgvector v0.8.7 compiled in: cloned at its tag, checked against the commit
  `f37c13f68b57d2c3472b2214fbcff699d6d34876`, built with `OPTFLAGS=""` (no `-march=native`, so an
  image built on one machine runs on another) and without LLVM bitcode, the build tools removed in
  the same layer. Same base, same musl: an existing data volume keeps its text order.
- **Proved on 4 October 2026** in a throwaway container from that image (no published port, removed
  afterwards): PostgreSQL 16.14 on x86_64-pc-linux-musl, `en_US.utf8`; `vector` 0.8.7 available;
  `CREATE EXTENSION vector` succeeded; a `vector(3)` column with an HNSW `vector_cosine_ops` index
  answered a nearest-neighbour query in the expected order.
- **Not adopted.** `infra/compose.yml`, CI and staging still run `postgres:16-alpine`, no database
  has the extension, and no table has a vector column. The knowledge tables (ADR-0033) are ordinary
  tables. The status route `GET /ai/knowledge/status` says whether the extension is available and
  installed, from `pg_available_extensions` and `pg_extension`.
- **For Phase 8C.** Local, CI and staging switch to the image together, on their existing volumes;
  then a migration creates the extension and the embeddings table under the database gate. Whether
  CI builds the image on each run or pulls it from a registry is decided then.

## Phase 8C record (4 October 2026)

Phase 8C adopted the image and the extension (ADR-0035).

- **Local.** `infra/compose.yml` builds and runs `lms-postgres:16-pgvector-0.8.7` from
  `infra/postgres/Dockerfile`, on the existing `pgdata` volume. Before the switch `lms` was backed
  up (`E:\LMS-backups\lms-before-pgvector.dump`, 617,693 bytes, SHA-256
  `8b241a4f3171764e05bee215dab4f85715bcb63db701a3eb6d02bf7e268c0d87`). After it: PostgreSQL 16.14
  on musl, `en_US.utf8`, every database still there, and every table's row count and content
  fingerprint in `lms` (88 tables) and `lms_preview` identical to before. `vector` 0.8.7 available.
- **CI.** The two jobs with a database build the image from `infra/postgres` on each run and start
  it with `docker run` and a health check (a service container cannot be built). Building on each
  run was chosen over a registry: nothing to publish or keep, at the cost of the build's time; a
  registry can replace it if that time matters.
- **Staging.** `infra/compose.staging.yml` builds the same image; it takes effect at the next
  staging deployment, on the existing volume, as locally.
- **The extension** is created by the migration `20261011090000_phase8c_knowledge_embeddings`
  (`CREATE EXTENSION IF NOT EXISTS vector`), under the database gate on `lms`.
- **Type and index**, as item 4 and item 5 above settled: `vector(768)` (768 dimensions, ADR-0035),
  HNSW with `vector_cosine_ops`, created with the table. Prisma 7.10 cannot describe an HNSW index,
  so it is raw SQL in the migration; a schema diff shows it as the one difference, and an
  end-to-end test checks it. Filtered queries and `hnsw.iterative_scan` are Phase 8D's.

**8D record (4 October 2026; ADR-0036).** Retrieval filters inside the search and sets, per
transaction, `hnsw.iterative_scan = relaxed_order` and `hnsw.ef_search` to at least the candidates
it asks for; the candidates are re-sorted by distance. The migration
`20261012090000_phase8d_knowledge_retrieval` sets `toast_tuple_target = 8160` on
`knowledge_chunk_embeddings`: a 768-dimension vector (3,080 bytes) had been moved out of its row into
the TOAST table, which made ranking a scope exactly read every vector from there; rows now stay
whole, two to a page. No other index was added (Phase 8 plan, Performance).
