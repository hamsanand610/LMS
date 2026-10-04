# files module

Upload registry over the S3-compatible storage adapter (ADR-0005). Bytes never pass through the API:
the client uploads directly to a presigned URL, then asks the API to verify and mark the file ready.

| Aspect       | Detail                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes       | `POST /files/uploads` (presign), `POST /files/uploads/:id/complete`, `GET /files/:id`, `GET /files/:id/url`, `DELETE /files/:id`                                                                                                |
| Permissions  | Routes are `@AuthenticatedOnly()`; each upload **context** (`contexts.ts`: `branding-logo`, `branding-favicon`, `branding-background`, `avatar`) names the permission, allowed types, size limit and bucket (public or private) |
| Verification | On complete: object exists, size within the limit, first bytes match the declared type (`sniff.ts`); mismatches mark the row failed and delete the object                                                                       |
| Access       | Private files are served through short-lived presigned download URLs; public files (branding assets) through a stable public URL                                                                                                |
| Events       | `file.uploaded`                                                                                                                                                                                                                 |
| Audit        | `files.deleted`                                                                                                                                                                                                                 |
| Tests        | `src/modules/files/sniff.spec.ts`; storage-backed flows are covered manually in Phase 1 (MinIO) and by integration tests from Phase 3 (course content)                                                                          |

Later phases add contexts (lesson resources, submissions, documents, imports) by extending
`contexts.ts` — no new routes.

## Phase 2 (2 October 2026)

- **A file attached to a record cannot be deleted on its own** (`file_attached`): it goes with the
  record. Downloads are signed only for an object that is really in storage
  (`core/storage/signed-download.ts`); a lost one answers 404.

## Phases 3 and 4 (3 October 2026)

- **Personal links are audited (SEC-06).** A signed link to a file in a personal context (one
  whose context names a read permission: documents, résumés, answers) handed to anyone but its
  uploader is recorded as `files.personal_link_issued`.
- **Erasure (ADM-11).** `FilesService.purge` deletes files from storage and their rows — those
  named, and every file a person uploaded; the privacy service removes the records that pointed at
  them and audits the whole.

## Phase 6 (3 October 2026)

- **Links browsers follow** are signed for `S3_PRESIGN_ENDPOINT` (empty: `S3_ENDPOINT`); outside
  local, one that would name an internal host is refused with `503 storage_not_public`. Public
  files are linked through `S3_PUBLIC_BASE_URL`, a public https address outside local.
- **No SVG** for logos, favicons or company logos: an SVG can carry script.
- **Deleting** through `DELETE /files/:id` is for the uploader only; reading a file is not owning it.
- Files go with what held them: a removed résumé, a replaced or removed profile photo, an export
  past its time.
- **Tests:** `test/hardening.e2e-spec.ts`, `src/core/storage/s3.driver.spec.ts`.

## Phase 8A (4 October 2026)

- **Files a module writes for its own records** are never served by id. A file whose owner type no
  upload context describes — a knowledge version's text (`knowledge-version`, ADR-0033) — is
  reached only through the module that wrote it: `GET /files/:id` and its link answer 404 to
  everyone but its uploader, whatever their `files:read` scope. It has no uploader and is attached
  nowhere else (`requireAttachableFile` checks the context).
- **Tests:** `test/ai-knowledge.e2e-spec.ts`.
