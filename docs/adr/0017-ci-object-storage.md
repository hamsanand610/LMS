# ADR-0017 — The CI smoke run's object storage is Chainguard's build of MinIO

- **Status**: accepted
- **Approved**: 2026-10-02, by the client
- **Date**: 2026-10-02
- **Phase**: Task 4 release (first CI runs on GitHub)
- **Scope**: the CI smoke job only. Local development and staging are unchanged and still need a
  decision (see Consequences).

## Context

The Playwright smoke job starts the real API, and J-12 exports a report, so the job needs object
storage that speaks S3; without it the export ends "failed" and the journey cannot pass. The
approved stack (`docs/STACK.md`, `infra/compose.yml`) runs MinIO from `quay.io/minio/minio` and
creates buckets with `quay.io/minio/mc`.

On 2026-10-01 a CI runner could not pull either image. MinIO has withdrawn its open-source
distribution: `quay.io/minio/*` answers 401 Unauthorized, `docker.io/minio/*` answers that the
repository does not exist, and `dl.min.io` answers 410 Gone, stating that the open-source MinIO
Server, Client and KES are archived and no longer maintained, with no security updates or
advisories, and that no community release is served any more. The local machine still runs only
because it pulled its images (September 2025 builds) before then.

## Decision

The smoke job runs `cgr.dev/chainguard/minio:latest` and creates the buckets with
`cgr.dev/chainguard/minio-client:latest`: Chainguard's builds of the same MinIO server and client
from MinIO's source (server `RELEASE.2026-09-22T19-25-18Z` on the day of the decision), signed and
rebuilt daily. Nothing else about the step changes: the same two buckets as `infra/compose.yml`
(the public one readable anonymously), a secret key generated per run and masked, and the data on
a fresh tmpfs (the image's own `/data` sits on the container's overlay, where MinIO cannot rename
its work folders). The data is throw-away and lives as long as the job.

**Dependency check (operating rule 5).** Justification: the only way to keep the smoke run on the
same object store as local development once MinIO stopped publishing. Licence: MinIO is AGPL-3.0,
as before; it runs as a separate service and is neither modified nor distributed by this project.
Maintenance: Chainguard rebuilds the images daily from the last MinIO source, so dependency fixes
arrive but MinIO itself gets no new fixes upstream; the free tier publishes `latest` only, which is
why the tag is not pinned to a version.

## Consequences

- CI tests uploads and exports against a real S3 implementation, the same server software as
  local development.
- No secrets and no repository data are involved: the key is made per run, the data is discarded.
- **Open: local development and staging.** `infra/compose.yml` and `infra/compose.staging.yml`
  still name the `quay.io/minio` images. A machine that has not pulled them before, and the
  staging host, cannot start object storage, and MinIO itself is unmaintained. Before staging
  starts, the client decides what local development and staging use (for example this same
  build, another maintained S3-compatible server, or a managed store such as Cloudflare R2 for
  staging); that is a separate ADR.

## Alternatives considered

- **Compile MinIO from its archived source in CI.** No new publisher, but several minutes more per
  run (or a cache to maintain), and the result is the same unmaintained code.
- **Another S3-compatible server (SeaweedFS, Garage, RustFS…).** A larger change that should be
  made once, for local development and staging as well; it belongs to the open decision above.
- **Leave the smoke run red until that decision.** Not chosen.
- **An in-memory store for the smoke run.** Rejected: the browser journeys exist to exercise the
  real S3 driver (the API tests already use an in-memory stand-in).
