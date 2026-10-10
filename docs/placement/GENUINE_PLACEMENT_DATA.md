# Loading genuine placement data

How SI Academy's placement data goes into production: by the Super Admin, an administrator or the
Placement Coordinator, through **Admin → Companies** and **Admin → Drives**. There is no bulk import
and no seed for companies or drives: every record is entered by a person from an official source.
Never enter a fictional company, opening or link, and never copy listings from a site that does not
allow it (for example by scraping job boards or LinkedIn).

## What to collect for each company

| Field (form)  | Required | Rules                                                                                                                                       | Source to use                                |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Name          | yes      | 2–120 characters, the company's legal or trading name                                                                                       | the company's own site or the offer document |
| Industry      | no       | up to 80 characters                                                                                                                         | the company's own description                |
| Website       | no       | a web address; prefer the `https://` careers or home page                                                                                   | the company's own site                       |
| Technologies  | no       | up to 20, 40 characters each (what the company hires for)                                                                                   | the company's job descriptions               |
| About         | no       | up to 2,000 characters                                                                                                                      | the company's own description, in your words |
| Logo          | no       | PNG, JPEG or WebP, up to 1 MB — **only a logo the company allows you to use**                                                               | the company's media or brand page            |
| Interview kit | no       | published coding problems from SI Academy's bank; learners are told they were chosen for this company, so add only problems you can justify | your own curation                            |

A company is visible to learners as soon as it is created (companies have no draft state): create it
when its first drive is ready.

## What to collect for each drive (opening)

| Field (form)                      | Required | Rules                                                                                                                                                         |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company                           | yes      | created first                                                                                                                                                 |
| Role                              | yes      | 2–120 characters, as the company titles it                                                                                                                    |
| Type                              | yes      | Full time or Internship                                                                                                                                       |
| Location                          | no       | up to 120 characters ("Chennai", "Remote")                                                                                                                    |
| Package, as the company states it | no       | up to 80 characters, exactly as published ("4.5 – 6 LPA"); leave empty if not published                                                                       |
| Applications close (IST)          | yes      | date and time; must be in the future to open the drive                                                                                                        |
| About the role                    | no       | up to 4,000 characters: duties, selection rounds, **eligibility the platform cannot check** (degree, branch, year of passing, marks, backlogs), what to bring |
| Official application link         | no       | the company's own page for this opening, `https://` only; learners see it beside Apply                                                                        |
| Who can apply                     | no       | batches, programmes and a minimum attendance %; the platform enforces these three                                                                             |

## How a drive runs

1. Create the drive: it starts as a **draft**, invisible to learners.
2. Check it, then **Open** it: the learners who meet "Who can apply" are notified in the app and by
   email (email reaches only addresses verified in Amazon SES while it is in its sandbox).
3. Learners apply in the platform (their default résumé and profile go with it) and, when there is an
   official link, on the company's site too.
4. Move each application through Applied → Shortlisted → Selected or Not selected; each change is
   sent to the learner. Export the applicants as CSV when the company asks for the list.
5. **Close** the drive when it ends (it does not close itself: learners stop seeing Apply after the
   closing time, but staff lists keep it under "open" until you close it).

## What the owner must supply

For each genuine opening: the company's details above, the role, type, location, package as
published, closing date and time, the description with the eligibility criteria, the official
application link, and which batches or programmes may apply. Confirm too, before sharing any
learner's details with a company outside the platform, that the Privacy Policy covers it
(`docs/legal/LEGAL_REVIEW.md`, item 7).
