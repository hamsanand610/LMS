# Production on AWS — runbook

How SI Academy's production environment on AWS is set up, released, rolled back and changed
(ADR-0042). Production changes only through the deploy workflow (operating rule 41); this runbook
never asks anyone to change production by hand.

```
learners ──HTTPS──▶ CloudFront ──VPC origin──▶ internal load balancer ──▶ one EC2 host (private)
                    │  /files/* ──▶ S3 (public files)      /api/* → API :4000 (worker embedded)
                    │                                      else   → web :3000
                    │                                      runner + sandbox image (Docker)
                    └─ everything else ▶ the load balancer          │
                                                         RDS PostgreSQL 16 + pgvector (TLS)
                                                         S3 (private files, signed links)
```

| Piece                  | Where                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| Account bootstrap      | `infra/aws/bootstrap.yml`, `infra/aws/bootstrap.sh` (once per account)                       |
| The environment        | `infra/aws/stack.yml` (CloudFormation), settings in `infra/aws/production.json`              |
| The pipeline           | `.github/workflows/deploy-production.yml`, scripts in `infra/aws/pipeline/`                  |
| A release on the host  | `infra/aws/host/release.sh`, `render_env.py`, `db-check.cjs`; `infra/compose.production.yml` |
| Smoke checks           | `infra/aws/smoke.sh`                                                                         |
| Starting data          | `clients/si-academy/` (AI and the optional modules off)                                      |
| Checks on every change | `.github/workflows/infra.yml` (cfn-lint, ShellCheck, actionlint, tests, compose)             |

## 1. Before the first deployment (once per AWS account)

1. **An administrator of the AWS account signs in to the AWS CLI** on a machine with this repository
   (AWS CLI 2.32 or later): `aws login`, or `aws configure sso` for IAM Identity Center. Use an
   administrator user or role, never the root user's access keys. Nobody pastes a key into chat, a
   file or the repository.
2. **Bootstrap**: `bash infra/aws/bootstrap.sh`. It creates the stack
   `si-academy-bootstrap-production` in `ap-south-1`:
   - GitHub's OpenID Connect trust;
   - the deploy role `si-academy-github-deploy-production`, which only this repository's
     `production` environment can assume;
   - CloudFormation's execution role;
   - the pipeline bucket.

   It then writes the account id into `infra/aws/production.json`. It creates nothing of the
   environment itself.

3. **Optional settings**, in `infra/aws/production.json` → `parameters`:
   - `AlarmEmail`: an address for alarms and the monthly budget. It must confirm AWS's email.
   - `MonthlyBudgetUsd`: 200 by default; it applies only when `AlarmEmail` is set.
   - The instance sizes.
4. **Commit and push** `infra/aws/production.json`.
5. **Optional**: in GitHub → Settings → Environments → `production`, add required reviewers, so that
   every deployment waits for a person.

## 2. Deploying

- **A tag on a commit of main**:
  `git tag production-2026-10-07-1 origin/main && git push origin production-2026-10-07-1`.
- **Or by hand**: GitHub → Actions → **Deploy to production (AWS)** → Run workflow.

The run has four jobs:

1. **Infrastructure** applies the stack. The first creation takes 30–45 minutes: the database,
   CloudFront and the VPC origin.
2. **Images** builds the commit's five images into ECR. Images that already exist are skipped.
3. **Release**:
   - snapshots the database (`si-academy-production-pre-release-<commit>-<run>`, the newest five
     kept);
   - on the host: checks the database (TLS verified, pgvector 0.8 or later), applies the
     migrations, and on a new deployment only, runs the base seed and creates the first Super Admin;
   - replaces the services and waits until they are healthy.
4. **Verify** waits for the load balancer's health checks, then runs the smoke checks through
   CloudFront. They are anonymous and read-only.

The run's summary shows the site's address (`https://<id>.cloudfront.net` until a domain is set).

## 3. The first sign-in

1. AWS console, region Asia Pacific (Mumbai) → Secrets Manager → `si-academy/production/admin` →
   **Retrieve secret value**: the e-mail and the password.
2. Sign in at the site, then change the password at once.
3. In the admin portal, replace the placeholder addresses with the institute's real ones (`hello@`
   and `support@siacademy.example` receive no mail), under Settings and Branding.
4. AI, labs, the leaderboard, placement, doubts, certificates and feedback are **off**. Each is turned
   on in the admin portal (Feature flags) only after the client approves it (operating rule 35).

## 4. Rolling back

- **The application**: Actions → Run workflow, with `image_sha` set to an earlier commit of main and
  `skip_infrastructure` ticked. That commit's images are deployed again.
- **The data**: only when a migration damaged it, and only with the client's written approval
  (operating rule 23). Restore the release's pre-release snapshot to a new database instance, check
  it, then switch to it.

## 5. Changing the environment

Edit `infra/aws/production.json` → `parameters`, commit, push and deploy:

- instance sizes: a host resize restarts it for about two minutes;
- storage, backups, the alarm address, the budget;
- the domain, e-mail and AI (below).

Two values are chosen when the stack is created and kept afterwards:

- **The host's Ubuntu image.** Security updates install themselves.
- **PostgreSQL's minor version.** Minor upgrades happen in the maintenance window: Monday 01:30–02:30
  in India.

## 6. Secrets (`si-academy/production/*` in Secrets Manager)

| Secret                      | Rotate by                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `jwt-access`, `jwt-refresh` | a new random value in the console, then a deployment (everyone signs in again)                  |
| `runner-token`              | a new random value (64 letters and digits), then a deployment                                   |
| `storage`                   | raising `Serial` of `StorageAccessKey` in `infra/aws/stack.yml`, then a deployment              |
| `database`                  | changing the RDS master password and this secret together, then a deployment                    |
| `data-encryption-key`       | never casually: the integration passwords stored with it must be entered again                  |
| `admin`                     | used once, by the first release; afterwards the Super Admin changes the password in the product |

A secret's value appears nowhere else: not in GitHub, an image, a log, a stack output or this
repository.

## 7. E-mail through Amazon SES (until then, no e-mail is sent)

1. SES console (Mumbai): verify the sending domain (its DNS records) or a sending address, and
   request **production access**.
2. `parameters`: `EmailDriver` = `ses`, `EmailFrom` = the verified sender, such as
   `SI Academy <no-reply@your-domain>`. Then deploy: the stack creates a sending-only key, and the
   host derives the SMTP password from it.

## 8. A custom domain

1. In ACM, in **us-east-1** (CloudFront's region), request a certificate for the domain, and add the
   DNS record that validates it.
2. `parameters`: `DomainName` and `CertificateArn`. Then deploy: the web image is rebuilt with the
   new address.
3. DNS: point the domain at the stack's `CloudFrontDomainName` output, with a CNAME or a Route 53
   alias.

## 9. AI (off until the client approves it)

1. The client approves the surface and the costs (operating rules 35 and 48).
2. Secrets Manager → **Store a new secret** → Other type → plaintext
   `{"GEMINI_API_KEY":"…","GROQ_API_KEY":"…"}`, named `si-academy/production/ai`, entered in the
   console by the client only.
3. `parameters`:
   - `AiProvider` = `gemini`, `AiModel`, `AiModelCosts`, `AiOrgMonthlyBudgetUsd`;
   - `AiFallbackProvider` and `AiFallbackModel` only if Groq's terms are accepted.

   Then deploy, and turn the approved flags on in the admin portal.

4. `AiDataClasses` stays `public,course`. The template cannot express `personal`, and the host
   refuses it as well, until ADR-0041's terms are recorded and a reviewed change allows it.

## 10. Looking at the host and the logs

- **The host**: EC2 console → the instance `si-academy-production-host` → Connect → Session
  Manager. There is no SSH, no key pair and no public address. Read only: `sudo docker compose -p
si-academy ps`, `sudo cat /opt/si-academy/releases.log`. Never change a container by hand: the
  next release replaces it.
- **Logs**: CloudWatch Logs `/si-academy/production/api`, `/web`, `/runner`, `/release`, and the
  database's `/aws/rds/instance/si-academy-production/postgresql`. They are kept 90 days.
- **Alarms** (CloudWatch, to `AlarmEmail` once it is confirmed):
  - the host's system and instance checks: EC2 recovers or reboots it;
  - the host's CPU, memory and disk;
  - the API's and the web app's health;
  - server errors;
  - the database's CPU, free storage and memory.

## 11. When a deployment fails

- **The stack** is never rolled back automatically. A failed change leaves it in `CREATE_FAILED` or
  `UPDATE_FAILED` with everything that worked kept. Read the failed events in the job's log, fix the
  template, and run again: it carries on from there. `ROLLBACK_*` or `DELETE_FAILED` needs a person
  (AWS console → CloudFormation).
- **The release** prints the host's log, and the full log is in `/si-academy/production/release`.
  - **Failed before the services were replaced**: the previous release keeps serving.
  - **Failed after a migration**: the pre-release snapshot is named in the job's log.

## 12. Costs

At low traffic, about US$135–150 a month before tax (ADR-0042): the NAT gateway about $45, the host
about $33, the database about $29, the load balancer about $20, and the rest (storage, logs, alarms,
secrets, CloudFront) under $15. The budget alarm (`MonthlyBudgetUsd`) warns at 80% and when the
forecast passes 100%.

## 13. Taking it down

Only with the client's written approval. Turn off the database's deletion protection, then delete
the stack `si-academy-production`. Some things are kept on purpose and deleted by hand if wanted:

- the S3 buckets;
- the ECR repositories;
- the database's final snapshot.
