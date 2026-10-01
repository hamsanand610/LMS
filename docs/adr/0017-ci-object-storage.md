# ADR-0017 — Object storage runs on Chainguard's build of MinIO

- **Status**: accepted
- **Approved**: 2026-10-02, by the client
- **Amended**: 2026-10-02, extended to local development and staging; approved by the client
- **Date**: 2026-10-02
- **Phase**: Task 4 release (first CI runs on GitHub)
- **Scope**: first the CI smoke job only (the decision below, under its original title "The CI
  smoke run's object storage is Chainguard's build of MinIO"); since the amendment also the
  object store of local development and staging.

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
  staging); that is a separate ADR. _Resolved the same day by the amendment below, which the
  client approved in this ADR instead._

## Alternatives considered

- **Compile MinIO from its archived source in CI.** No new publisher, but several minutes more per
  run (or a cache to maintain), and the result is the same unmaintained code.
- **Another S3-compatible server (SeaweedFS, Garage, RustFS…).** A larger change that should be
  made once, for local development and staging as well; it belongs to the open decision above.
- **Leave the smoke run red until that decision.** Not chosen.
- **An in-memory store for the smoke run.** Rejected: the browser journeys exist to exercise the
  real S3 driver (the API tests already use an in-memory stand-in).

## Amendment — local development and staging (2026-10-02)

The client approved using the same build for the object store wherever MinIO's own image can no
longer be pulled: `infra/compose.yml` and `infra/compose.staging.yml` now run
`cgr.dev/chainguard/minio:latest`. What the application sees does not change: the same S3 API on
the same addresses and ports, the same keys, the same two buckets, and the same access policies
(the public bucket readable anonymously, the private one only through signed links).

- **The image.** The server image also carries the client (`mc`) and a shell, so the bucket set-up
  (`minio-init`) runs the same commands from it, and the health check (`mc ready local`) is
  unchanged. Chainguard's client-only image has no shell to run the set-up with.
- **The user.** The server runs as an unprivileged user (65532); MinIO's image ran as root. A
  volume that image wrote belongs to root, so a one-shot service, `minio-volume`, runs
  `chown -R --from=0 65532:65532 /data` before the server starts: it hands root's files over once
  and changes nothing on a volume already handed over or a new one. No object is moved or
  rewritten.
- **Validated** before the change was committed, without touching the running local stack: a copy
  of the local volume (148 objects) started under the new definitions with the same keys, sizes
  and ETags in both buckets and the same policies as on the old server; the API's storage paths
  (readiness, a public and a private upload with content checks, signed and public links,
  anonymous access refused on the private bucket, a server-written export, deletion) passed 15 of
  15 on that copy, on a new volume, and on staging's definitions with staging's own keys; running
  `up` again changed nothing.

Validating staging's definitions also found two problems that are not about the image; they are
recorded in the progress log (session 16).
