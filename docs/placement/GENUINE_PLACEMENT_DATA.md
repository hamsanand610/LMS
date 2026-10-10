# Loading genuine placement data

How SI Academy's placement data goes into production: by the Super Admin, an administrator or the
Placement Coordinator, through **Admin → Companies** and **Admin → Drives**. There is no bulk import
and no seed for companies or drives: every record is entered by a person from an official source.
Never enter a fictional company, opening, salary, date, criterion or link, and never copy listings
from a site that does not allow it (for example by scraping job boards or LinkedIn).

## What to collect for each company

Entered in **Admin → Companies → Add company** (Name, Industry), then on the company's page under
**Profile** (the rest).

| Form label                                       | Required | Rules                                                                                                                                   | Source to use                                |
| ------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Name                                             | yes      | 2–120 characters, the company's legal or trading name                                                                                   | the company's own site or the offer document |
| Industry                                         | no       | up to 80 characters                                                                                                                     | the company's own description                |
| Website                                          | no       | a web address; use the company's `https://` careers or home page                                                                        | the company's own site                       |
| Technologies the kit covers, separated by commas | no       | up to 20, 40 characters each                                                                                                            | the company's job descriptions               |
| About the company and how it hires               | no       | up to 2,000 characters                                                                                                                  | the company's own description, in your words |
| Logo (Upload logo)                               | no       | PNG, JPEG or WebP, up to 1 MB — **only a logo the company allows you to use**                                                           | the company's media or brand page            |
| Interview-prep kit                               | no       | published coding problems from SI Academy's bank; learners are told they were chosen for this company, so add only ones you can justify | your own curation                            |

**Who sees a company**: staff, always. Learners, only once it has an interview-prep kit or an
announced (open or closed) drive. A company entered for a drive still in draft stays with staff.

## What to collect for each drive (opening)

Entered in **Admin → Drives → New drive**, changed later with **Edit** on the drive's page.

| Form label                            | Required | Rules                                                                                                                                                                   |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company                               | yes      | created first                                                                                                                                                           |
| Role                                  | yes      | 2–120 characters, as the company titles it                                                                                                                              |
| Type                                  | yes      | Full time or Internship                                                                                                                                                 |
| Location                              | no       | up to 120 characters ("Chennai", "Remote")                                                                                                                              |
| Package, as the company states it     | no       | up to 80 characters, exactly as published ("4.5 – 6 LPA"); leave empty if the company did not publish it                                                                |
| Applications close (IST) and Time     | yes      | the date and time applications close; must be in the future to open the drive                                                                                           |
| About the role                        | no       | up to 4,000 characters: duties, selection rounds and dates, **eligibility the platform cannot check** (degree, branch, year of passing, marks, backlogs), what to bring |
| Official application link (optional)  | no       | the company's own page for this opening, `https://` only; shown to learners who may apply                                                                               |
| Who can apply: Batches, Programmes    | no       | leave both empty to allow every learner; the platform enforces them                                                                                                     |
| Who can apply: Minimum attendance (%) | no       | 0–100; enforced (a learner with no attendance yet is not held back by it)                                                                                               |

## How to enter and publish an opportunity

1. **Verify** every detail against the company's own announcement (careers page, email or official
   PDF) and keep that source. Nothing is entered from memory, a forwarded screenshot or a job board.
2. **Company**: Admin → Companies → **Add company** (Name, Industry) → on its page, fill the
   **Profile** and **Save profile**. Learners cannot see it yet.
3. **Drive**: Admin → Drives → **New drive** → fill the form above → **Create draft**. It is a **draft**:
   learners cannot see it, nor its company.
4. **Check** the draft's page: role, closing time, "Who can apply", and the official link (it opens
   the company's page in a new tab).
5. **Open the drive** → read the confirmation → **Open and announce**. Learners who may apply are
   told in the app and by email (email reaches only addresses verified in Amazon SES while it is in
   its sandbox), and the drive and its company appear in their Placements.
6. Learners apply in the platform (their default résumé, if they added one, and their profile go with
   it) and, when there is an official link, on the company's site too.
7. Move each application with **Update** through Applied → Shortlisted → Selected or Not selected;
   each change is sent to the learner. **Export CSV** gives the applicants' list (name, student code,
   email, batch, attendance, stage) — share it outside the platform only once the Privacy Policy
   covers it (`docs/legal/LEGAL_REVIEW.md`, item 7).
8. **Close applications** when the drive ends. It does not close itself: learners stop seeing Apply
   after the closing time, but the staff "Open" list keeps it until you close it.

Corrections after opening (**Edit**) are not announced again; tell learners through an announcement
if a change matters to them.

## What the owner must supply

For each genuine opening, from the company's own announcement: the company's name, industry,
careers page and (optionally) its permission to use its logo; the role, type, location, the package
as published, the closing date and time, the description with the selection rounds and the
eligibility criteria, the official `https://` application link, and which batches or programmes (or
everybody) may apply, with any minimum attendance.

## Production, as of 10 October 2026

One programme, one batch (planned) with one learner, no résumés, no companies and no drives; the
Placement Coordinator and the Super Admin can manage placement. Restricting a drive to a batch or
programme needs those batches and programmes, with the learners in them, created first by an
administrator.
