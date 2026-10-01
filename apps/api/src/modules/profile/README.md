# profile module

The learner's own record: the same data staff see on a student, edited by the person it belongs to
(plan DP-S17–S20, module M-04 student side).

| Aspect       | Detail                                                                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes       | `GET /me/profile`, `PATCH /me/profile/:section`; resumes: `GET/POST /me/resumes`, `POST /me/resumes/:id/default`, `DELETE /me/resumes/:id`, `GET /me/resumes/:id/download`; documents: `GET/POST /me/documents`            |
| Permissions  | `profile:read` and `profile:update`, both at scope `own` and nothing else                                                                                                                                                  |
| One section  | The section is in the path, and a body carrying anything outside it is refused rather than written — so a page can only change what it was showing                                                                         |
| Completeness | One function, shared with the staff view, and the learner is told which part is still missing rather than only shown a number (plan AC-12.3)                                                                               |
| Resumes      | PDF only, and no larger than the `resume` upload context allows — that context is the "configured size" of AC-12.1. At most three, and exactly one default: removing the default promotes the next, so there is never none |
| Documents    | Uploaded by the learner, decided by staff. A rejection carries its reason, because a learner who does not know what was wrong cannot put it right (AC-12.2)                                                                |
| Not here     | Projects and certificates are named on the page with the module that would supply them, rather than shown as empty sections (plan §12.3)                                                                                   |
| Audit        | `profile.updated`, `profile.resume_added`, `profile.resume_default`, `profile.resume_removed`, `profile.document_added`                                                                                                    |
| Tests        | `test/profile.e2e-spec.ts` (the sections, the resume rules, the documents, and what one learner cannot do to another)                                                                                                      |

The resume generator the master report describes (F-21) is Standard tier and is not here: a learner
uploads a PDF, the platform does not write one.
