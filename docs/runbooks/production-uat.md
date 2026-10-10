# Production acceptance testing (UAT), signed in

The script the institute follows to accept SI Academy in production, at
`https://d39kxid0rpunjw.cloudfront.net`, with its own accounts: the Super Admin, the Trainer, the
Placement Coordinator and a learner. It is the signed-in half of the release check; the anonymous
half (the 29 smoke checks) runs on every deployment. Nobody else signs in to production for it,
and no step needs a password, key or token to be shared.

The local pass that came before it (Step 5, 10 October 2026: every page of every role at desktop,
phone and dark-mode sizes, checked for accessibility, errors, failed requests and sideways
scrolling) is recorded in `docs/phases/STEP-05-ui-refinement-and-uat.md`.

## Before you start

- **Accounts.** One per role: the Super Admin, the Trainer, the Placement Coordinator, and a
  learner the institute controls for testing. Prefer that test learner to a real student: some
  steps leave records (a doubt, an answer, a notification read).
- **Email.** Amazon SES is in its sandbox: a message reaches only an address verified in SES. The
  steps that send email say so; a missing email to an unverified address is expected, not a defect.
- **Content for the learner.** The learner's batch needs at least one published course for the
  learning steps (the curriculum's courses are drafts until an administrator publishes them).
- **Placement.** Production has no companies or drives yet. The placement steps run with the first
  genuine opening, entered as `docs/placement/GENUINE_PLACEMENT_DATA.md` describes; never enter a
  fictional company or drive to test with.
- **Devices.** A desktop or laptop browser (current Chrome, Edge or Firefox), and a phone (Android
  Chrome or iPhone Safari). Run each role's steps on the desktop, then the phone pass at the end.
- **What not to do in production.** Do not switch on `ai.lab_hints`, do not start a timed test
  with the learner unless the attempt is genuine (each learner gets the attempts the test allows),
  and do not publish a course, open a drive or send an announcement only to test it.

## How to record

Copy this table into the acceptance record (a sheet or a document), one row per step:

| Step | Desktop: pass / fail | Phone: pass / fail | Notes (page address, time, what you saw) |
| ---- | -------------------- | ------------------ | ---------------------------------------- |
| A1   |                      |                    |                                          |

A **fail** is anything that does not do what the step says, shows a technical message, leaves a
page loading for more than about ten seconds, or needs sideways scrolling of the whole page on the
phone. Take a screenshot of each fail and note the page address and the time: the time finds the
request in the server's logs.

## E. Everyone (run once per account)

| Step | Do                                                                                                             | Expect                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| E1   | Open the address; sign in                                                                                      | The sign-in page shows SI Academy's branding; sign-in lands on the role's home page                      |
| E2   | Sign in with a wrong password once                                                                             | A plain message; no detail about whether the account exists                                              |
| E3   | Open the user menu (top right; on a phone, the menu button) → Theme → Dark, then Light                         | The whole page changes theme and stays readable; the choice is kept after a reload                       |
| E4   | Open **Search** (or press Ctrl+K / ⌘K) and look up a course or page you can see                                | Results only from what this role may open; choosing one opens it                                         |
| E5   | Open **Notifications**; mark one read                                                                          | The count in the header drops                                                                            |
| E6   | Settings → **Notification preferences**: switch one email preference off, then on again                        | Each change is saved (a confirmation appears)                                                            |
| E7   | Settings → **Privacy Policy** and **Terms of Service**                                                         | Each opens, marked as a draft until the legal review is complete                                         |
| E8   | **SI Academy AI** (the launcher at the bottom right, or the AI page): ask a question about the course material | A reply in plain words, citing the course or knowledge-base document it used, or saying it does not know |
| E9   | Sign out                                                                                                       | Back on the sign-in page; opening a page of the portal asks you to sign in again                         |

## A. Super Admin (and administrators)

| Step | Do                                                                                             | Expect                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A1   | The **dashboard**                                                                              | "Needs attention", the figures with a definition behind each ⓘ, the batches and courses; nothing technical |
| A2   | **Users**: open the list, filter by role, open the Trainer                                     | The three staff accounts and the learner with the right roles                                              |
| A3   | **Students**: the list, then the learner's record                                              | Profile completeness reads as a percentage; documents and the activity tab open                            |
| A4   | **Programmes** and **Batches**: open the batch                                                 | The roster, the trainers, the timetable and the content published to it                                    |
| A5   | **Courses**: open a course, its curriculum and a lesson in the builder                         | Modules and lessons as entered; nothing is changed unless you save                                         |
| A6   | **Question bank**, **Assignments**, **Tests**: open one of each                                | Each opens with its details; filters narrow the lists                                                      |
| A7   | **Reviews** and **Doubts**                                                                     | The queues open (they may be empty: an empty queue says so)                                                |
| A8   | **Reports**: open the Students report, filter it, then **Export**                              | The export appears under **Exports** and downloads with the same rows as the table                         |
| A9   | **Knowledge base**: open the published source                                                  | Its documents and their processing state                                                                   |
| A10  | **AI usage** and Settings → **AI settings**                                                    | Usage figures; `ai.lab_hints` stays off                                                                    |
| A11  | Settings → **Feature flags**, **Branding**, **Templates and pages**, **Roles and permissions** | Each opens; change nothing unless the change is intended                                                   |
| A12  | Settings → **Audit log**                                                                       | Today's sign-ins and any changes made during this UAT, with who and when                                   |
| A13  | Settings → **System health**                                                                   | Every check green, or a plain reason for any that is not                                                   |

## T. Trainer

| Step | Do                                                                            | Expect                                                                                            |
| ---- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| T1   | The **dashboard**                                                             | Today's classes, the roll calls waiting, the batches, the learners who need attention             |
| T2   | **Courses**: open a course you teach, then one you do not                     | Your course opens its workspace; another course shows its curriculum with no learner-only buttons |
| T3   | **Batches** → your batch → its students                                       | Only your batches and their students                                                              |
| T4   | **Schedule**; open a class's **roll call** (only if a class is genuinely due) | Everybody starts present; saving asks nothing more; a correction asks why                         |
| T5   | **Reviews**, **Doubts**, **Tests**, **Assignments**                           | The queues and lists open; a test's Grading tab lists answers waiting to be marked                |
| T6   | **Question bank**: open a question                                            | The question with its answer and its technology                                                   |
| T7   | **Reports** and **Exports**                                                   | Reports cover only your batches                                                                   |

## P. Placement Coordinator

| Step | Do                                                                                                  | Expect                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| P1   | The home page and the menu                                                                          | Drives, Companies, Reports and Exports; nothing else of the admin area                    |
| P2   | **Companies** and **Drives** (empty until the first genuine opening)                                | Each says it is empty and offers **Add company** / **New drive**                          |
| P3   | With the first genuine opening only: follow `docs/placement/GENUINE_PLACEMENT_DATA.md` steps 2 to 5 | The draft stays hidden from learners; **Open the drive** asks for confirmation first      |
| P4   | As the learner, after the drive is open: **Placements**                                             | The drive and its company appear; the official link opens the company's page in a new tab |

## S. Learner

| Step | Do                                                                                              | Expect                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| S1   | The **dashboard**                                                                               | A greeting, what to do next, the courses in progress, the week's classes and deadlines |
| S2   | **Courses** → a course → **Start the course** (or **Continue**)                                 | The lesson opens; the contents list shows where you are; finishing it marks it done    |
| S3   | **Schedule**: switch Week / Month                                                               | The batch's classes on the right days                                                  |
| S4   | **Assignments**: open one and its first question (answer only if the answer is genuine)         | The question opens with its instructions; saving keeps the answer                      |
| S5   | **Tests**: open a test's "Before you start" page; do not start it unless the attempt is genuine | The rules, the time and the attempts allowed                                           |
| S6   | **Labs** → **Playground**: run a short program                                                  | The output appears                                                                     |
| S7   | **Doubts** → **Ask a doubt** (only a genuine question)                                          | The trainer sees it under Doubts; the answer comes back as a notification              |
| S8   | **Progress**, **Attendance**, **Certificates**                                                  | Figures for this learner only; empty sections say why                                  |
| S9   | **Profile**: edit one section and save; **Resumes**: open the page                              | The completeness figure updates                                                        |
| S10  | **Interview prep** and **Placements**                                                           | Empty until a company has a kit or an open drive, and they say so                      |

## M. Phone and tablet pass

On the phone, for each account, repeat E1, E3, E9 and the role's first three steps, then check:

- the bottom bar (learners) or the menu button (staff) reaches every section, and **More** opens
  the rest;
- no page needs sideways scrolling of the whole page (wide tables scroll inside their own box);
- tabs that do not fit scroll sideways within their row;
- the SI Academy AI launcher never covers a button you need (it is hidden on roll calls);
- text stays readable when the phone is turned to landscape.

On a tablet (or a desktop window about 800 px wide), open the dashboard, a list and a detail page
for each role.

## K. Keyboard and zoom (one account is enough)

- With the keyboard only (Tab, Shift+Tab, Enter, Space, arrows): sign in, move through the menu,
  open a course, switch a page's tabs. The focus ring is always visible.
- At 200% browser zoom on the desktop, the dashboard and a list page still read without sideways
  scrolling of the whole page.

## When a step fails

Record it in the table with the screenshot, page address and time, and report it. Fixes go through
the normal release: a change, its tests, CI green, then a deployment the institute approves.
