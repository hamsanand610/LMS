# certificates module

Certificates of course completion (ADR-0022, Phase 2): issued automatically, kept as a record,
downloaded as a PDF and checked by anyone through the code printed on them.

| Aspect       | Detail                                                                                                                                                                                                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes       | `GET /me/certificates`, `GET /me/certificates/:id/download` (30 per 5 minutes per person), public `GET /public/certificates/:code` (30 per 5 minutes per address)                                                                                                                                                                |
| Permissions  | `certificates:read` (student `own`, trainer `batch`, admin `all`); the public check is `@Public` and shows only what confirms a certificate                                                                                                                                                                                      |
| Flag         | `module.certificates`, off by default (operating rule 35); the demo overlay switches it on. Off, every route answers 403 `module_disabled` and nothing is issued                                                                                                                                                                 |
| Issue        | `course.completed` queues `certificates.issue`; `certificates.sweep` (every 5 minutes) issues what an event missed and draws any PDF a failure left undrawn. Eligibility is the enrolment's real completion; issuing twice changes nothing, and when two calls race only the one that created the record audits and announces it |
| Record       | A snapshot: the learner's name, the course title, the institute and the dates at issue. Never recomputed when the course changes later; only revocation (Phase 4 screens) changes it                                                                                                                                             |
| Code         | 12 characters of Crockford base32 from the system's secure random source (about 60 bits); typed in any case, with or without the printed dashes                                                                                                                                                                                  |
| PDF          | Drawn with pdf-lib (write-only, standard fonts, A4 landscape) into private storage at `certificates/{organisation}/{id}.pdf`; a PDF lost from storage is drawn again on the next download                                                                                                                                        |
| Download     | The holder's own only (anybody else's reads as not found), through a signed link that lasts 5 minutes; audited (`certificate.downloaded`). Revoked: 422 `certificate_revoked`; not drawn yet: 422 `certificate_not_ready`                                                                                                        |
| Notices      | `certificate.issued` to the learner, in the app and by e-mail, linking to `/certificates`                                                                                                                                                                                                                                        |
| Events       | Subscribes to `course.completed`; publishes `certificate.issued`                                                                                                                                                                                                                                                                 |
| Known limits | The standard PDF fonts print Western European characters only; anything else prints as `?` until an embedded Unicode font is added (ADR-0022)                                                                                                                                                                                    |
| Tests        | `test/learner.e2e-spec.ts` (issue once, download, another learner and staff refused, the public check, revocation, the flag, the rate limit); `certificate-code.spec.ts`; `certificate-pdf.spec.ts`; shared `certificates.spec.ts`                                                                                               |

## Phases 3 and 4 (3 October 2026)

- **Administered, never rewritten (ADM-05, D9).** `GET /certificates` lists certificates for
  staff by scope (`certificates:read`, at least `batch`: a trainer sees the learners of the batches
  they teach). `POST /certificates/:id/revoke` and `/reinstate` take a reason
  (`certificates:manage`), are audited (`certificate.revoked`, `certificate.reinstated`) and tell
  the learner (`certificate.status`); a revoked certificate's public check says so and its PDF no
  longer downloads. `POST /certificates/:id/redraw` draws the PDF again (`certificate.redrawn`).
  The record's words stay the snapshot taken at issue.
- **Signatory (ADM-13).** The name and title under the signature line come from the settings'
  `records` section at issue and are kept on the record (`signatory_name`, `signatory_title`), so a
  later change never alters one already issued; no name, no line.
- **Erasure (ADM-11)** withdraws a learner's certificates, deletes their PDFs and keeps the record
  under the erased name, so a verifier is told it is withdrawn.
- **Tests:** `test/admin-operations.e2e-spec.ts`; `certificate-pdf.spec.ts` (the signatory).
