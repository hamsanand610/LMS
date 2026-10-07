# Runbooks

Operational, repeatable procedures. Update the relevant runbook whenever an operation changes
(operating rule 38).

| Runbook                                | Use it when                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [local-setup.md](local-setup.md)       | Setting up a development machine or a fresh clone; resetting the sample data                              |
| [testing.md](testing.md)               | Running unit, API and browser tests locally; understanding what CI runs                                   |
| [page-checklist.md](page-checklist.md) | Declaring a page complete (the Page Completion Rule from the architecture plan §23.3)                     |
| [staging.md](staging.md)               | Deploying to the staging VM (Roadmap Phase 14), including its database dumps                              |
| [operations.md](operations.md)         | Failed jobs, retention, a learner's privacy request, certificates; a phase migration on the main database |
| [aws-readiness.md](aws-readiness.md)   | Preparing the first AWS deployment: what is ready, what each area needs, the checklist, the blockers      |
| [aws-production.md](aws-production.md) | Production on AWS: the account bootstrap, deploying, rolling back, secrets, e-mail, a domain, AI, costs   |
