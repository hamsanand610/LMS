# SI Academy — Privacy Policy and Terms of Service: review record

- **Status**: DRAFTS, built into the platform on 9 October 2026 (Phase 10 closure). **Not legally
  approved.** Publishing them closed the gap of the sign-in page and the invitation linking to pages
  that did not exist (404 in production); it is not an approval of their content.
- **Where they live**: `apps/api/src/modules/settings/built-in-pages.ts`, served at `/pages/privacy`
  and `/pages/terms` (no sign-in) until the institute publishes its own page at the same address in
  Settings → Templates → Pages, which replaces the built-in one at once.
- **Who must review**: the product owner (facts about SI Academy) and a qualified lawyer (legal
  grounds, rights, liability, governing law). This document is not legal advice.

## 1. Owner and legal confirmations still open

Every item below is marked `[To be confirmed: …]` in the page text and shown highlighted to readers.

| #   | Item                                                                                                                                                                                                                                   | Where                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Legal name, registered address and contact of the organisation responsible                                                                                                                                                             | Privacy "Who we are", Terms "Who provides the platform", both "Contact" |
| 2   | Legal grounds for each purpose under the law that applies, and whether any use needs separate consent                                                                                                                                  | Privacy "Why we use it"                                                 |
| 3   | Which law applies (for example India's Digital Personal Data Protection Act, 2023, if SI Academy operates in India), the rights it gives, how requests are made, response times, grievance contact                                     | Privacy "Your choices and rights"                                       |
| 4   | Cross-border transfer statement: data is stored in AWS Sydney (Australia); AI providers process outside India                                                                                                                          | Privacy "Where your information is kept", "SI Academy AI"               |
| 5   | Retention schedule after a programme ends, and confirmation that the platform's defaults (AI messages 90 days, AI usage 2 years, audit trail indefinite) are SI Academy's chosen periods                                               | Privacy "How long we keep it", "SI Academy AI"                          |
| 6   | Whether the leaderboard needs an opt-out                                                                                                                                                                                               | Privacy "Who can see your information"                                  |
| 7   | Whether and how applicants' details are shared with companies outside the platform                                                                                                                                                     | Privacy "Who can see your information", Terms "Placement support"       |
| 8   | Confirm "we do not sell your information" and add any other off-platform sharing                                                                                                                                                       | Privacy                                                                 |
| 9   | Security-incident notification process                                                                                                                                                                                                 | Privacy "How we protect it"                                             |
| 10  | Minimum age; parent/guardian consent for learners under 18                                                                                                                                                                             | Privacy "Children"                                                      |
| 11  | How users are told of significant changes (email, notice at sign-in, fresh acceptance)                                                                                                                                                 | both "Changes"                                                          |
| 12  | Relationship to any enrolment agreement; fees, refunds and cancellations                                                                                                                                                               | Terms "Accepting these terms", "Fees"                                   |
| 13  | Academic-integrity rules, including AI use for graded work                                                                                                                                                                             | Terms "Tests and academic integrity", "SI Academy AI"                   |
| 14  | Ownership and licence of course material and of learners' work                                                                                                                                                                         | Terms "Course material", "Your work"                                    |
| 15  | Certificate issue and revocation criteria; placement terms; service commitments; notice before ending access                                                                                                                           | Terms                                                                   |
| 16  | Warranties, limitation of liability, indemnities, governing law and disputes                                                                                                                                                           | Terms "Responsibility and liability", "Governing law and disputes"      |
| 17  | Google (Gemini) and Groq: processing locations and data-use terms for SI Academy's own accounts, and **which Gemini tier the production key uses** (a free-tier key's prompts may be used by Google; `infra/aws/stack.yml` AiProvider) | Privacy "SI Academy AI"                                                 |

## 2. What the drafts are based on (evidence)

The drafts state only what the code does. The main sources:

- **Personal data**: `apps/api/prisma/schema.prisma` (User, StudentProfile and its `personal`,
  `education`, profile JSON in `packages/shared/src/schemas/people.ts` and `profile.ts`; attendance,
  submissions, test attempts with `integrityLog`, execution runs, doubts, feedback, certificates,
  placement applications, notifications, AI conversations and messages, AiRequest ledger, sessions
  with IP and user agent, audit log with IP and user agent).
- **Authentication**: Argon2id (`apps/api/src/modules/auth/password.ts`); cookies `lms_at` (15 min),
  `lms_rt` (30 days or browser session), `lms_csrf` (`auth/cookies.ts`, `core/config/env.ts`);
  lockout after 5 failures for 15 minutes (`auth.service.ts`).
- **AI**: Gemini primary (`store: false`, no user identifiers in the request:
  `modules/ai/providers/gemini.wire.ts`), Groq stand-in for `public`/`course` only (ADR-0038); what is
  sent (`modules/ai/context/context-assembler.ts`: system prompt, subject material, notes, up to 10
  recent messages, the question); credentials refused (`modules/ai/policy/data-class.ts`); retention
  (`modules/ai/jobs/retention.service.ts`, `packages/shared/src/schemas/ai.ts`: messages 90 days,
  ledger 730 days); production data classes `public,course` (`infra/aws/production.json`) with the
  release refusing anything else (`infra/aws/host/render_env.py`).
- **Code**: sandbox with no network on the same host (`apps/runner/README.md`).
- **Email**: Amazon SES SMTP, Sydney (`infra/aws/host/render_env.py`).
- **Hosting and retention**: AWS ap-southeast-2 (`infra/aws/stack.yml`, `docs/runbooks/aws-production.md`);
  RDS backups 1 day, the five newest pre-release snapshots (`infra/aws/pipeline/run-release.sh`), S3
  noncurrent versions 30 days, CloudWatch logs 30 days; `retention.sweep` (exports 7 days, import rows
  30 days, audit indefinite unless `auditRetentionDays` ≥ 1095).
- **Visibility**: trainers lack `students:read_sensitive` (date of birth, guardian, address stripped);
  leaderboard shows first name, last initial, rank, points and breakdown
  (`modules/gamification/leaderboard.service.ts`); public certificate check
  (`GET /public/certificates/:code`); avatars are served publicly by URL (`modules/files/contexts.ts`,
  CloudFront `/files`).
- **Browser**: no analytics or tracking scripts; CSP limits scripts and connections to the app's own
  origin; external https images in lesson HTML are allowed; local storage holds theme, navigation and
  drafts of code and answers.
- **Erasure**: a Super Admin can export a learner as JSON and anonymise a learner
  (`apps/api/src/modules/users/privacy.service.ts`); marks, attendance, progress and the audit trail are kept
  without identity; certificates are revoked; backups and noncurrent file versions are not touched.

## 3. AI data sharing: review

| Data class   | What it is                                                               | Providers allowed                      | Production today                 |
| ------------ | ------------------------------------------------------------------------ | -------------------------------------- | -------------------------------- |
| `public`     | Questions with no course subject                                         | Gemini, Groq                           | on                               |
| `course`     | SI Academy's own course and lesson material, plus the learner's question | Gemini, Groq                           | on                               |
| `personal`   | A learner's own records: progress, what is due, lab code and verdicts    | Gemini only, after approval (ADR-0041) | **off** (refused by the release) |
| `restricted` | Credentials, hidden tests, reference solutions, answer keys, staff notes | none                                   | never                            |

Points for the reviewer:

1. **The learner's question itself is free text** and reaches the provider whatever it contains; the
   platform refuses credential-like text but does not redact names or other personal details. The
   composer tells users not to include personal details; the Privacy Policy says the same.
2. **Free tier.** If the production Gemini key is on Google's free tier, Google may use prompts
   (questions and course material) to improve its products. The owner must confirm the tier (item 17).
3. **Groq** processes in the United States (ADR-0038's recorded terms: no retention by default, logs
   up to 30 days). It never receives `personal`.
4. **Acceptance is recorded (since 10 October 2026).** The invitation asks the user to accept the
   Terms and confirm reading the Privacy Policy. The `auth.invitation_accepted` audit entry now keeps
   both consents and which documents they were — each one's title and "last updated" date as a
   visitor read it at that moment — beside the time, IP address and browser the audit already keeps.
   Accounts that accepted before that date have the acceptance (`Invitation.acceptedAt`) but not the
   versions. Whether this is the consent the applicable law needs (for example a separate consent for
   AI processing of personal data, or fresh acceptance when the documents change) is the lawyer's
   question. The general settings' `termsPageSlug`, `privacyPageSlug` and `consentText` are not read
   by the sign-in and invitation pages (their links are fixed to `/pages/privacy` and `/pages/terms`).

## 4. `ai.lab_hints` and learner context: conditions for enabling

`ai.lab_hints` is **OFF** in production (switched off by the client, 9 October 2026), and stays off.
AI Hint sends the learner's own latest submission (code and verdicts) — the `personal` class — so it
needs, in order:

1. **Provider terms recorded**: Gemini's paid-tier data-use terms (retention, training use, region)
   verified and recorded in ADR-0041's terms table, with the production key confirmed on that tier.
2. **Policy approved**: the Privacy Policy's AI section updated to describe the personal data sent
   (own code, verdicts, progress) and approved by the owner and the lawyer, with items 2–5 and 17
   above settled.
3. **Consent or disclosure decided**: the lawyer decides whether disclosure is enough or a separate,
   explicit consent is needed for this processing (see 3.4); if a separate consent, it is built and
   recorded first.
4. **Client approval in writing** to approve `personal` for real learners.
5. **Configuration change through a release**: the stack parameter and `render_env.py` both refuse
   `personal` today; allowing `public,course,personal` is a reviewed code change and a production
   release, then `AI_DATA_CLASSES` and the institute's AI settings data classes.
6. **Verification before switching the flag on**: the AI e2e and evaluation suites with `personal`
   on the fake provider; a live check on the production host with synthetic learner data only; then
   the flag on for a pilot batch.

The same conditions apply to the learning agent's learner context (`subjects.learnerContext`,
ADR-0040), which reads progress and lab attempts.

## 5. Open questions found while drafting

- Avatars are public by URL; consider whether learners' photos should be private.
- There is no self-service account deletion or data export (administrators do both).
- Test integrity events (tab switch, blur, full-screen exit, paste) are recorded; the lawyer may want
  this disclosed before each test as well as in the policy.

## 6. Who does what

**Technical work, done in the platform** (verifiable in the code and tests):

- Both pages built in, readable without signing in, linked from the landing page, the sign-in page,
  the invitation and account settings; every unconfirmed fact marked and highlighted.
- Acceptance recorded with the document versions (3.4).
- Personal data never sent to an AI provider: `personal` is refused by the release, the router and
  the agent; lab hints off; credential-like text refused before sending.
- Replacing a draft with approved text needs no code: publish a page at `privacy` or `terms`.

**Facts the owner must supply** (section 1): items 1, 5–8, 10–15 and 17 — the organisation, retention
schedule, leaderboard opt-out, sharing with companies, "we do not sell", age policy, change notices,
enrolment agreement and fees, integrity rules, ownership of material and work, certificate and
placement terms, and the Gemini tier.

**Legal review** (section 1): items 2–4, 9 and 16 — grounds and consents under the applicable law,
users' rights and the grievance contact, cross-border transfer wording, incident notification,
warranties, liability, governing law and disputes — and the sign-off that the published texts are
approved. Until then the pages stay marked "Draft for review".
