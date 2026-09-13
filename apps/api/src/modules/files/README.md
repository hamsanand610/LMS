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
