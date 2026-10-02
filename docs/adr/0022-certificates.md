# ADR-0022 — Certificates: issued on completion, drawn with pdf-lib, checked by a public code

- **Status**: proposed — built in Roadmap Phase 2, for the client's approval at the Phase 2 gate
- **Date**: 2026-10-02
- **Phase**: Roadmap Phase 2 (Complete learner experience)
- **Implements**: requirement F-16 and its criteria CR-S10, AC-10.1 to AC-10.3
  (`docs/PLANNING_REPORT.md`)

## Context

A learner who finishes a course has nothing to show for it: the platform issues no certificate, and
`course.completed` is emitted with no listener. The approved requirements already describe what a
certificate must do:

- issued automatically, within five minutes of the rule being met, with a notification (AC-10.1);
- downloadable as a PDF;
- a public page that confirms a code with the name, course, date and status, or says it is not
  found (AC-10.2), and a revoked certificate verifies as revoked (AC-10.3);
- a code of twelve base32 characters; a private file behind a signed link; a rate-limited public
  check that shows nothing beyond name and course; no retroactive revocation without an
  administrator (design F-16).

The architecture plan draws the PDF with headless Chromium in the worker, with pdf-lib as the
alternative. ADR-0019 measured Chromium at about 300 MB of image and about 300 MB of memory a job,
and the worker runs inside the API process by default. Open question Q-18 proposed a rule of every
mandatory lesson plus a test average of 50%; tests are not linked to courses, so only course
completion can be checked per course today.

## Decision

1. **Eligibility is the enrolment's completion**, which the progress service records only when every
   counted lesson is complete (Phase 2, D1). Nothing else issues a certificate, and a learner
   cannot ask for one.
2. **Issue.** A listener on `course.completed` queues an idempotent job; a sweep every five minutes
   issues anything an event missed and draws any PDF a failure left undrawn. One certificate per
   learner per course (a unique index), so the event, the sweep and a retry cannot make two.
3. **A record, not a view.** The learner's name, the course title, the institute and the completion
   date are stored with the certificate as they were when it was issued. It is never recomputed
   from progress, so a course that later gains a lesson does not withdraw it. Revocation is a
   status with a date and a reason; the screens that revoke or issue by hand are Roadmap Phase 4.
4. **The code** is twelve characters of Crockford base32 (about 60 bits) from the system's secure
   random source. It is printed on the certificate, so it is public by design; what protects it is
   that it cannot be guessed, and the public check is rate-limited per address (30 in 5 minutes).
5. **The PDF** is drawn with pdf-lib 1.17.1 at issue time: one A4 landscape page, the standard PDF
   fonts, no external resources. It is stored in the private bucket and downloaded through a
   five-minute signed link, and every download is audited.
6. **The module** (`certificates`) sits behind its flag, off by default (operating rule 35), with
   one permission, `certificates:read`: own for learners, batch for trainers, all for
   administrators.

### pdf-lib (operating rule 5)

- **Why:** the requirement asks for a PDF, and the stack has no way to write one (only exceljs).
- **Licence:** MIT, as are its four dependencies (`@pdf-lib/standard-fonts`, `@pdf-lib/upng`,
  `pako`, `tslib`).
- **Maintenance:** 1.17.1 is the latest release, and the registry shows no change to the package
  since May 2022: the project is stable rather than active. It is used here only to _write_ a
  document from data the server holds, never to read a PDF a user supplies, so its untouched
  parsing code is not reachable by anyone. It has no native
  code, which matters on this platform (Smart App Control blocks native modules) and in the
  container.
- **Alternatives:** headless Chromium (rejected for its weight, measured in ADR-0019); pdfkit (MIT
  and active, but more dependencies for the same page).

## Consequences

- Completing a course produces a certificate within five minutes, with a notification and a page
  that lists every certificate the learner holds.
- Anyone can confirm a certificate at `/verify/{code}` without signing in, and sees only the name,
  the course, the dates and its status.
- **Known limitation:** the standard PDF fonts cover Western European characters only. A name in
  another script prints with its unsupported characters replaced; embedding a Unicode font (and
  fontkit) is a later decision if a client needs it.
- **Not yet built:** the administrators' list, manual issue and revocation, templates and
  signatories (Phase 4); a QR code on the page (another dependency, not required); a rule that
  also needs a test score or attendance (it needs tests linked to courses, Q-18).

## Alternatives considered

- **Generate the PDF on every download.** Simpler storage, but a certificate is a record: drawing
  it once fixes what was issued, as F-16 asks.
- **Store only a hash of the code.** The code must be shown to the learner and printed again on the
  PDF, so it is stored as it is; the unique index makes it the lookup key.
