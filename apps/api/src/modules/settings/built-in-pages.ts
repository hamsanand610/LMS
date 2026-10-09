import type { PublicContentPage } from '@lms/shared';

/**
 * SI Academy's Privacy Policy and Terms of Service as the platform ships them, shown at
 * `/pages/privacy` and `/pages/terms` until the institute publishes its own page at the same
 * address (Settings → Templates → Pages); a published page replaces them at once.
 *
 * Written from what the code does (docs/legal/LEGAL_REVIEW.md lists the evidence). They are DRAFTS
 * for the owner's and a lawyer's review, not legal advice: every fact the code cannot settle — who
 * the institute is, which law applies, its retention schedule, its fees and liability terms — is
 * marked `[To be confirmed: …]`, and the page shows those marks set apart. Publishing these pages is
 * not a legal approval; change a fact here only when the code or the owner confirms it.
 *
 * Format (modules/content/content-body.tsx in the web): blank lines between paragraphs, `## ` and
 * `### ` headings, `- ` list items, `**bold**`.
 */
type BuiltInPage = Omit<PublicContentPage, 'slug'>;

const DRAFT_NOTE =
  '**Draft for review.** This text describes how the SI Academy platform works today. It has not yet been approved by SI Academy or reviewed by its legal advisers. Items marked "To be confirmed" will be completed after that review, and the date above will change when they are.';

const PRIVACY = `${DRAFT_NOTE}

This policy explains what personal information the SI Academy learning platform holds, why, who can see it, where it is kept, how long it stays and the choices you have. It covers learners, trainers, placement coordinators and administrators, and anybody who opens one of the platform's public pages (the sign-in page, these policies, or a certificate check).

## Who we are

The platform is run by SI Academy for its own programmes. [To be confirmed: the legal name of the organisation responsible for your information, its registered address, and the person or team to contact about privacy.]

## What we hold about you

### Your account

- Your name, email address and, if recorded, your mobile number.
- Your password, stored only as a one-way hash (Argon2id). Nobody at SI Academy can read it.
- A profile photo, if you add one.
- Your role (learner, trainer, coordinator or administrator) and whether your account is invited, active or deactivated.

### Your learner profile

- Your student code and the details the institute records for its programmes: date of birth, gender, guardian's name and mobile number, address, city, state and pin code, where these are collected.
- Your education, experience, projects, certifications, skills, a short summary and links you add (for example GitHub, LinkedIn or a portfolio).
- Documents and résumés you upload, and any extra fields the institute adds to its forms.

### Your learning

- The courses and batches you are enrolled in, your progress through lessons (including where you stopped in a video and how long you watched), and your attendance with any notes or corrections.
- Your assignment submissions (text, code and files), their marks and the feedback on them.
- Your test attempts and answers. During a timed test the platform records when you switch tabs, leave the test window, leave full screen or paste text, so staff can review the attempt.
- The code you run in labs and practice, with its results.
- The doubts you ask and the replies, your feedback responses (a form marked anonymous stores no link to you), your certificates, your placement applications and the companies you save, and the notifications sent to you.
- Notes staff write about a learner. These are for staff and are not shown to the learner.

### SI Academy AI

- The questions you ask SI Academy AI and its answers, each conversation's title and the short notes it keeps to follow a long conversation.
- A record of each request for usage limits and costs: when, which model, how many tokens. It does not hold the text of your question or the answer.

### Security records

- Your sign-in sessions: when they started and were last used, the IP address, and your browser's description of itself (for example the browser and operating system).
- A trail of actions taken on the platform: who did what and when, with the IP address and browser description. Passwords and secret tokens are never written to it.
- Failed sign-in attempts, counted so that an account can be locked for a short time after repeated failures.

## Why we use it

- To run your programme: courses, lessons, classes and attendance, assignments, tests, labs, certificates and placement support.
- To let trainers and administrators teach, assess and support learners, and to report on how batches are doing.
- To send you the invitations, password resets and notifications the platform sends.
- To provide SI Academy AI, when the institute has switched it on.
- To keep the platform and your account secure, and to investigate misuse.

[To be confirmed: the legal grounds on which SI Academy relies for each purpose under the law that applies to it, and whether any use needs your separate consent.]

## Who can see your information

- **You** can see your own profile, progress, marks, attendance, certificates and AI conversations.
- **Your trainers** can see the learners in their own batches: progress, attendance, submissions and marks, test monitoring, and how much each learner uses SI Academy AI. They do not see sensitive profile details such as date of birth, guardian details or address.
- **Administrators and placement coordinators** can see learner profiles, including those sensitive details. The most senior administrator role can see everything on the platform.
- **Other learners in your batch** see you on the batch leaderboard, if the leaderboard is switched on: your first name, the initial of your last name, your rank and your points, with how they were earned (lessons, practice, assignments, tests). [To be confirmed: whether learners may opt out of the leaderboard.]
- **Anybody with your certificate's code** can check it on the public verification page, which shows your name, the course, the institute, the completion and issue dates and whether the certificate is still valid.
- **Your profile photo** is stored so that anybody who has its web address can open it. Do not upload a photo you would not want shared that way.
- **Companies.** The platform does not send your profile to companies. Placement staff can open the résumé you chose for a drive and download lists of a drive's applicants (name, student code, email, batch, attendance and application stage). [To be confirmed: whether, how and with which companies SI Academy shares applicants' details outside the platform.]
- **Service providers** that host and run the platform for SI Academy, listed below.

We do not sell your information. [To be confirmed: confirm this statement and add any other sharing SI Academy does outside the platform.]

## SI Academy AI and external AI providers

When the institute switches SI Academy AI on, it can explain lessons and answer questions about the courses you can open. To answer, the platform sends the following to an external AI provider:

- your question;
- the recent turns of the same conversation (up to ten messages) and the conversation's notes;
- the course or lesson material your question is about, taken only from courses you are allowed to open.

The request does not carry your name, email address or account identifiers. It does carry whatever you type, so never include passwords, keys or personal details in a question. A message that looks like a password or key is refused and not stored.

**Providers.** Google (Gemini) is the main provider. When Gemini is unavailable, Groq answers in its place for the same kinds of material. Either may process requests outside India. [To be confirmed: where, and on what data-use terms, Google and Groq process SI Academy's requests. In particular, Google may use prompts sent with a free-tier key to improve its products; SI Academy must confirm which tier its key uses before this policy is approved.]

**What is not sent today.** Your progress, marks, submissions, lab code and other personal records are not sent to any AI provider. Features that would send them — AI hints on your own lab attempts and personal guidance based on your progress — are switched off. They will stay off until SI Academy has reviewed the data sharing, recorded the provider's terms and updated this policy.

**How long AI records stay.** Each message is deleted automatically 90 days after it was written, and a conversation you delete is removed at the next nightly clean-up. Usage records are kept for two years; daily totals, which identify nobody's questions, are kept. [To be confirmed: that these periods are SI Academy's chosen retention periods.]

Answers from SI Academy AI can be wrong. Check them against your course and ask your trainer when in doubt.

## Code you run

Code you run or submit in labs, practice, assignments and tests is executed in an isolated sandbox on SI Academy's own servers, with no network access. It is not sent to any outside service. Drafts of your code and answers are also kept in your own browser, so that a refresh does not lose your work.

## Email

Invitations, password resets, password-change notices and the notifications you choose to receive by email are sent through Amazon Simple Email Service. You can choose which kinds of notification reach you by email in your notification preferences; invitations, password resets and password-change notices are always sent.

## Where your information is kept

The platform runs on Amazon Web Services in the Sydney, Australia region: its servers, its database (encrypted), its file storage (encrypted, never publicly listable) and its email sending. Learning sessions held on Google Meet, Zoom or Microsoft Teams are run by those services under their own terms; the platform only stores the link.

[To be confirmed: the statement the applicable law requires about storing and transferring personal information outside India, or outside the learner's country.]

## How long we keep it

This is how the platform behaves today:

- Accounts and learning records are kept while the account exists. Deactivating an account stops it from signing in; it does not delete its records.
- AI conversation messages: 90 days. AI usage records: two years.
- Report exports: deleted after seven days. Data uploaded for a bulk import: cleared after 30 days.
- The trail of actions: kept indefinitely, unless the institute sets a retention period of at least three years.
- Application logs: 30 days. Database backups: one day, plus a copy taken before each software update (the five most recent are kept). Earlier versions of replaced or deleted files: 30 days.

[To be confirmed: SI Academy's retention schedule — how long learner records are kept after a programme ends, and when they are deleted or anonymised.]

## How we protect it

Passwords are hashed and never stored in readable form; your connection to the platform is encrypted; the database is encrypted and not reachable from the internet; stored files are encrypted, and private files open only through short-lived signed links; each role sees only what it needs; sessions can be reviewed and ended; accounts are locked for a short time after repeated failed sign-ins. No system is perfectly secure, and we cannot promise that information will never be exposed. [To be confirmed: how SI Academy will notify people affected by a security incident.]

## Cookies and storage in your browser

The platform uses three cookies, all needed to sign you in and protect your session:

- **lms_at** keeps you signed in for 15 minutes at a time;
- **lms_rt** renews that for up to 30 days if you choose "Keep me signed in", or until you close the browser if you do not;
- **lms_csrf** protects your actions against forged requests.

It also keeps a few settings in your browser's storage: your theme, the state of the navigation and drafts of your code and answers. There are no analytics, advertising or tracking cookies. Some lesson content may show images hosted on other websites, which your browser then fetches from them.

## Your choices and rights

- See and correct your own profile at any time; ask an administrator to fix anything you cannot change yourself.
- Choose which notifications reach you by email.
- Review your signed-in devices and sign any of them out.
- Delete your SI Academy AI conversations.
- Ask SI Academy for a copy of your information, or to have it erased. SI Academy's administrators can export a learner's records and can anonymise a learner. Anonymising removes your name and contact details but keeps marks, attendance and progress (without your identity) and the trail of actions; certificates issued to you are revoked and keep the name they were issued in. Backups and earlier file versions expire on their own schedule above.

[To be confirmed: the rights available to you under the law that applies to SI Academy, how to make a request, how quickly SI Academy will respond, and who handles complaints (for example a grievance officer).]

## Children

[To be confirmed: the minimum age to use the platform, and how SI Academy obtains a parent's or guardian's consent for any learner under 18.]

## Changes to this policy

When this policy changes, the date at the top changes with it. [To be confirmed: how SI Academy will tell users about significant changes, for example by email or a notice when they sign in.]

## Contact

[To be confirmed: the email address and postal address for privacy questions and requests.]

See also the Terms of Service.`;

const TERMS = `${DRAFT_NOTE}

These terms apply to everybody who uses the SI Academy learning platform: learners, trainers, placement coordinators and administrators. The Privacy Policy explains how the platform handles personal information.

## Who provides the platform

The platform is provided by SI Academy. [To be confirmed: the legal name, registered address and contact details of the organisation providing it.]

## Accepting these terms

Accounts are created by invitation. You accept these terms, and confirm that you have read the Privacy Policy, when you accept your invitation and set your password. [To be confirmed: whether learners also sign a separate enrolment agreement, and which document prevails if the two differ.]

## Your account

- Your account is for you alone. Do not share your password or let anybody else sign in, study, submit work or sit a test as you.
- Keep your password secret and choose one you do not use elsewhere. Tell an administrator straight away if you think somebody else has used your account.
- After repeated failed sign-ins, an account is locked for a short time.
- Administrators can deactivate an account, for example at the end of a programme or after a breach of these terms.

## Using the platform properly

You must not:

- try to get around the platform's security, see information you are not meant to see, or interfere with how it runs;
- use the code sandbox for anything other than your coursework, including trying to break out of it, reach other systems or run software that is not part of an exercise;
- upload anything unlawful, harmful or infringing, or malware;
- copy the platform's content in bulk, or use automated tools to collect it;
- harass or mislead other people in doubts, feedback, announcements or elsewhere;
- upload other people's personal information without the right to do so;
- type passwords, keys or other people's personal details into SI Academy AI.

## Tests and academic integrity

Timed tests close at their set time. While you sit a test, the platform records when you switch tabs, leave the test window, leave full screen or paste text, and staff may review those records with your answers. SI Academy AI is not available during a timed test. [To be confirmed: SI Academy's academic-integrity rules — what counts as misconduct, including the use of AI tools for graded work, and what happens if it is found.]

## Course material

Courses, lessons, recordings, questions, tests and other material on the platform are provided for your own study on your programme. Do not copy, publish, sell or pass them on. [To be confirmed: who owns the material, what licence learners have, and what they may keep after their programme ends.]

## Your work

What you submit — code, answers, files, doubts and feedback — is stored on the platform, shown to the staff who teach and assess you, evaluated (code is run in the sandbox) and kept as described in the Privacy Policy. [To be confirmed: who owns learners' work and projects, and what rights SI Academy needs to use them, for example to showcase projects.]

## SI Academy AI

When the institute has switched it on, SI Academy AI helps you understand your courses. It answers from SI Academy's own material and shows its sources, but its answers can still be wrong: check them against your course and ask your trainer when in doubt. It is not a substitute for your trainers, and it does not decide marks. Each person can ask a limited number of questions a day, and the service may be unavailable at times. [To be confirmed: any further rules on using AI for assignments and projects.]

## Certificates

Certificates are issued when a learner meets the requirements of a course or programme. Anybody holding a certificate's code can check that it is genuine. SI Academy may revoke a certificate issued in error or obtained improperly, and the check then shows it as revoked. [To be confirmed: the criteria for issuing and revoking certificates.]

## Placement support

SI Academy may share placement drives and help you apply. Taking part does not guarantee an interview, an offer or a job, and the companies make their own decisions. [To be confirmed: SI Academy's placement terms, including any eligibility rules or commitments.]

## Fees

The platform takes no payments. [To be confirmed: where fees, refunds and cancellations are set out, for example in the enrolment agreement.]

## Availability and changes

The platform may change, and parts of it may be switched on or off or be unavailable for maintenance. We aim to give notice of planned changes that affect your programme. [To be confirmed: any service commitments SI Academy makes.]

## Ending your access

Your access may end when your programme ends, or earlier if you break these terms. Your records are then kept or deleted as the Privacy Policy describes. [To be confirmed: notice periods and how a learner can ask to close their account.]

## Responsibility and liability

[To be confirmed: SI Academy's warranties, the limits of its liability and any indemnities, to be written after legal review. Nothing on this page limits rights that the applicable law does not allow to be limited.]

## Governing law and disputes

[To be confirmed: the law that governs these terms, and where and how disputes are resolved.]

## Changes to these terms

When these terms change, the date at the top changes with them. [To be confirmed: how SI Academy will tell users about significant changes, and whether continued use or a fresh acceptance is required.]

## Contact

[To be confirmed: the email address and postal address for questions about these terms.]`;

/** The built-in pages, by address. A Map, so an address such as `constructor` finds nothing. */
export const BUILT_IN_PAGES: ReadonlyMap<string, BuiltInPage> = new Map([
  ['privacy', { title: 'Privacy Policy', body: PRIVACY, updatedAt: '2026-10-09T00:00:00.000Z' }],
  ['terms', { title: 'Terms of Service', body: TERMS, updatedAt: '2026-10-09T00:00:00.000Z' }],
]);
