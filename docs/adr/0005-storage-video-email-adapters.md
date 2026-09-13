# ADR-0005: Storage, video and email behind drivers

- Status: Accepted
- Context: The demo must be free; production uses client-owned providers (plan §7.4, refinement R-2).
- Decision: A file registry with an S3-compatible driver (MinIO locally, Cloudflare R2 in staging, R2/S3 in production) and a local-disk driver; presigned uploads and downloads; a video driver interface with `storage-file` (MP4/HLS in the same storage with signed URLs) now and hosted providers later; an email driver interface with SMTP (Mailpit locally) now and API providers later. Drivers are selected by environment variables.
- Alternatives: hosted video from day one (cost), local disk only (not portable).
- Consequences: no feature code depends on a concrete provider; adding a provider is a driver, not a change to modules.
