# students module

Learner records, their documents and bulk onboarding (journey J-01).

| Aspect         | Detail                                                                                                                                                                                                                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes         | `GET/POST /students`, `GET/PATCH /students/:id`, `POST /students/:id/status`, `GET /students/:id/batches`, `GET/POST /students/:id/notes`, `GET/POST /students/:id/documents`, `GET /students/:id/documents/:documentId/url`, `POST /students/:id/documents/:documentId/verify`, `GET/POST /students/import`, `GET /students/import/:jobId`, `GET /students/import/template` |
| Permissions    | `students:read` (scope `all` or `batch`), `students:manage`, `students:read_sensitive`, `students:verify_documents`; the import uses `users:import`                                                                                                                                                                                                                          |
| Record         | One `student_profiles` row per user account: student code, lifecycle status, personal/education JSON, skills, completeness score, and `custom` values for the fields a client defined                                                                                                                                                                                        |
| Student code   | `STU-<year>-<sequence>`, allocated from the highest code of the current year (`student-code.ts`)                                                                                                                                                                                                                                                                             |
| Lifecycle      | prospect → enrolled → active → completed → alumni, with `dropped` reachable from the live states and reversible to enrolled; illegal moves answer 409 `invalid_transition`                                                                                                                                                                                                   |
| Sensitive data | Date of birth, guardian details, address and postal code are stripped from the response without `students:read_sensitive`; the detail payload says which view the caller got (`sensitiveVisible`)                                                                                                                                                                            |
| Scope          | A `batch`-scoped caller sees only students of their own batches; a record outside scope answers 404, never 403, so its existence is not leaked                                                                                                                                                                                                                               |
| Documents      | Uploaded to the private bucket through the `student-document` file context; verify/reject with a reason; the student's verification status is derived from its documents; every download link issued is audited                                                                                                                                                              |
| Import         | CSV or TSV, ≤ 5,000 rows, `name` and `email` required. Runs as a queued job so one bad row never fails the batch; a dry run validates and reports without writing. One import at a time; a job abandoned by a crashed process is released after fifteen minutes                                                                                                              |
| Events         | `student.created`, `student.status_changed`, `student.document_reviewed`                                                                                                                                                                                                                                                                                                     |
| Audit          | `students.created`, `students.updated`, `students.status_changed`, `students.note_added`, `students.document_added`, `students.document_reviewed`, `students.document_downloaded`, `students.import_started`, `students.import_finished`                                                                                                                                     |
| Tests          | `src/modules/students/*.spec.ts` (codes, sheet parsing, completeness); `test/students.e2e-spec.ts` (J-01, duplicates, sensitive fields, scope, status machine, import)                                                                                                                                                                                                       |

Spreadsheet (.xlsx) import is not supported yet: it needs a library, and the one chosen for report
exports in Phase 5 will serve both directions. The importer accepts the CSV or TSV that every
spreadsheet exports.

## Phase 2 (2 October 2026)

- **Verification** follows the newest document of each kind: verified when every kind's latest is
  verified, pending otherwise, so one rejected document no longer blocks for ever.
- **Decisions are told:** the learner hears when a document is verified or rejected
  (`document.reviewed`).
- **Downloads:** `downloadOwn` for the learner's own document (audited); signed only for an object
  that is really in storage.
