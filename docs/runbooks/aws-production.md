# Production on AWS — runbook

How SI Academy's production environment on AWS is set up, released, rolled back and changed
(ADR-0042). Region **ap-southeast-2 (Sydney)**, locked. Production changes only through the deploy
workflow (operating rule 41); this runbook never asks anyone to change production by hand.

```
learners ──HTTPS──▶ CloudFront ──VPC origin──▶ internal load balancer ──▶ the existing EC2 host
                    │  /files/* ──▶ S3 (public files)   (private subnets)   i-0659cb9f754afdf5d, t3.small
                    │                                                       /api/* → API :4000 (worker)
                    └─ everything else ▶ the load balancer                  else   → web :3000
                                                                            runner + sandbox (Docker)
                                                                                 │
                                                         RDS PostgreSQL 16.15 + pgvector (TLS)
                                                         S3 (private files, signed links)
```

| Piece                  | Where                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Account bootstrap      | `infra/aws/bootstrap.yml`, `infra/aws/bootstrap.sh` (once per account)                                          |
| The environment        | `infra/aws/stack.yml` (CloudFormation), settings in `infra/aws/production.json`                                 |
| The pipeline           | `.github/workflows/deploy-production.yml`, scripts in `infra/aws/pipeline/` (`adopt-host.sh` adopts the host)   |
| A release on the host  | `infra/aws/host/prepare-host.sh`, `release.sh`, `render_env.py`, `db-check.cjs`; `infra/compose.production.yml` |
| Smoke checks           | `infra/aws/smoke.sh`                                                                                            |
| Starting data          | `clients/si-academy/` (AI and the optional modules off)                                                         |
| Checks on every change | `.github/workflows/infra.yml` (cfn-lint, ShellCheck, actionlint, tests, compose, configuration)                 |

**What the deployment reuses**:

- the existing instance `i-0659cb9f754afdf5d` (Amazon Linux 2023, 30 GiB);
- the default VPC `vpc-0253ea9db6f605f92`;
- the security group launch-wizard-1, keeping its SSH rule;
- the key pair si-academy-prod;
- the account's Zero Spend Alert.

**What it never creates**: a VPC, a NAT gateway, an Elastic IP, an EC2 instance, a launch template, a
budget, or anything in us-east-1.

## 1. Before the first deployment (once per AWS account)

1. **An administrator of the AWS account signs in to the AWS CLI** on a machine with this repository
   (AWS CLI 2.32 or later): `aws login --region ap-southeast-2`. The computer's clock must be right;
   `aws login` fails with `TOKEN_EXPIRED` when it is minutes off. Never use the root user's access
   keys, and never paste a key into chat, a file or the repository.
2. **Bootstrap**: `bash infra/aws/bootstrap.sh`. It creates the stack
   `si-academy-bootstrap-production` in `ap-southeast-2`:
   - the deploy role `si-academy-github-deploy-production`;
   - who may assume it, by `deployAuth` in `production.json`:
     - `iam-user` (today): the deploy user `si-academy-github-deployer-production`, whose only
       permission is to assume that role. The organization denies OpenID Connect providers, so
       nothing tries to create one.
     - `oidc` (preferred, once the organization's administrator allows
       `iam:CreateOpenIDConnectProvider`): GitHub's OpenID Connect, from this repository's
       `production` environment only, with no key stored anywhere;
   - CloudFormation's execution role;
   - the pipeline bucket.

   It then writes the account id into `infra/aws/production.json`. It creates nothing of the
   environment itself, and no access key.

3. **The deploy user's key** (with `iam-user` only), done by an administrator:
   1. In the IAM console, open the user `si-academy-github-deployer-production` → Security
      credentials → **Create access key** (use case: third-party service).
   2. In GitHub, go to Settings → Environments → `production` → **Environment secrets**, and add
      `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
   3. Nowhere else: not chat, not a file, not the repository.

   Rotate the key every 90 days: make a new one, replace both secrets, then deactivate and delete the
   old one. When OIDC is allowed, set `deployAuth` to `oidc`, run the bootstrap again, then delete the
   user's key and the two secrets.

4. **Optional settings**, in `infra/aws/production.json` → `parameters`: `AlarmEmail`, an address for
   alarms, which must confirm AWS's email.
5. **Commit and push** `infra/aws/production.json`.
6. **Optional**: in GitHub → Settings → Environments → `production`, add required reviewers, so that
   every deployment waits for a person.

## 2. Deploying

- **A tag on a commit of main**:
  `git tag production-2026-10-08-1 origin/main && git push origin production-2026-10-08-1`.
- **Or by hand**: GitHub → Actions → **Deploy to production (AWS)** → Run workflow.

The run has four jobs:

1. **Infrastructure**:
   - applies the stack. The first creation takes 30–45 minutes: the database, CloudFront and the VPC
     origin.
   - **adopts the host** (`adopt-host.sh`), each step only if not already so:
     1. tags it `Application=si-academy`, `Environment=production`;
     2. attaches the stack's instance profile and app security group (launch-wizard-1 stays);
     3. sets IMDSv2 to one hop;
     4. closes launch-wizard-1's ports 80 and 443 to the internet, leaving SSH as it is;
     5. waits for the host to answer Systems Manager.
2. **Images** builds the commit's five images **in CI** into ECR. Images that already exist are
   skipped. Nothing is ever built on the host.
3. **Release**:
   - snapshots the database (`si-academy-production-pre-release-<commit>-<run>`, the newest five
     kept);
   - on the host:
     - prepares it (`prepare-host.sh`): Docker and the CloudWatch agent from Amazon Linux,
       Docker Compose v5.5.1 checked against its SHA-256, 2 GiB of swap, the RDS authority;
     - checks the database (TLS verified, pgvector 0.8 or later) and applies the migrations;
     - on a new deployment only, runs the base seed and creates the first Super Admin;
   - replaces the services and waits until they are healthy.
4. **Verify** waits for the load balancer's health checks, then runs the smoke checks through
   CloudFront. They are anonymous and read-only.

The run's summary shows the site's address (`https://<id>.cloudfront.net`).

## 3. The first sign-in

1. AWS console, region Asia Pacific (Sydney) → Secrets Manager → `si-academy/production/admin` →
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

- the database's class, storage and backups (`DbBackupRetentionDays` is 1, the Free plan's maximum;
  the pre-release snapshots are separate and kept five deep);
- log retention and the alarm address;
- e-mail and AI (below).

The host itself is not in the stack:

- **Resizing it** (t3.small → t3.medium if the memory alarm fires) is a manual stop-change-start with
  the client's approval, about two minutes offline.
- **Security updates**: `dnf upgrade` through Session Manager, in a quiet hour.

PostgreSQL stays on the minor version set in `production.json` (16.15). Minor upgrades happen
themselves in the maintenance window: Monday 01:30–02:30 in India.

## 6. Secrets (`si-academy/production/*` in Secrets Manager)

| Secret                      | Rotate by                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `jwt-access`, `jwt-refresh` | a new random value in the console, then a deployment (everyone signs in again)                  |
| `runner-token`              | a new random value (64 letters and digits), then a deployment                                   |
| `storage`                   | raising `Serial` of `StorageAccessKey` in `infra/aws/stack.yml`, then a deployment              |
| `database`                  | changing the RDS master password and this secret together, then a deployment                    |
| `data-encryption-key`       | never casually: the integration passwords stored with it must be entered again                  |
| `admin`                     | used once, by the first release; afterwards the Super Admin changes the password in the product |

A secret's value appears nowhere else: not in an image, a log, a stack output or this repository.
The deploy user's key (section 1) lives only in GitHub's `production` environment.

## 7. E-mail through Amazon SES (until then, no e-mail is sent)

1. SES console (Sydney): verify the sending domain (its DNS records) or a sending address, and
   request **production access**.
2. `parameters`: `EmailDriver` = `ses`, `EmailFrom` = the verified sender, such as
   `SI Academy <no-reply@your-domain>`. Then deploy: the stack creates a sending-only key, and the
   host derives the SMTP password from it.

## 8. A custom domain (blocked today)

CloudFront needs the domain's certificate in ACM in **us-east-1**, which the organization denies.
Once its administrator allows ACM there:

1. Request the certificate in us-east-1 and add the DNS record that validates it.
2. `parameters`: `DomainName` and `CertificateArn`. Then deploy: the web image is rebuilt with the
   new address.
3. DNS: point the domain at the stack's `CloudFrontDomainName` output (CNAME).

## 9. AI (off until the client approves it)

Gemini is the only provider, and only on its **free tier**:

1. The client approves the surface (operating rules 35 and 48).
2. A Gemini API key from a Google project **without billing**, so usage cannot become paid. Free-tier
   prompts may be used by Google.
3. Secrets Manager → **Store a new secret** → Other type → plaintext `{"GEMINI_API_KEY":"…"}`, named
   `si-academy/production/ai`. The client enters it in the console only.
4. `parameters`: `AiProvider` = `gemini` and `AiModel`. `AiUserDailyRequests` (5) keeps everyone
   within the free tier's shared quota. Then deploy, and turn the approved flags on in the admin
   portal.
5. `AiDataClasses` stays `public`. Course material or the learner's own records (ADR-0041) need the
   client's approval and a reviewed change to the template; the host refuses anything else.

## 10. Looking at the host and the logs

- **The host**: EC2 console → `SI-Academy-Production` → Connect → Session Manager. SSH stays
  restricted to the one address launch-wizard-1 allows. Read only:
  - `sudo docker compose -p si-academy ps`;
  - `sudo cat /opt/si-academy/releases.log`;
  - `free -m` (memory and swap).

  Never change a container by hand: the next release replaces it.

- **Logs**: CloudWatch Logs `/si-academy/production/api`, `/web`, `/runner`, `/release`, and the
  database's `/aws/rds/instance/si-academy-production/postgresql`. They are kept 30 days.
- **Ten alarms** (CloudWatch, to `AlarmEmail` once it is confirmed):
  - the host's system and instance checks: EC2 recovers or reboots it;
  - the host's memory and disk;
  - the API's and the web app's health;
  - server errors;
  - the database's CPU, free storage and memory.

## 11. When a deployment fails

- **The stack** is never rolled back automatically. A failed change leaves it in `CREATE_FAILED` or
  `UPDATE_FAILED` with everything that worked kept. Read the failed events in the job's log, fix the
  template, and run again: it carries on from there. `ROLLBACK_*` or `DELETE_FAILED` needs a person
  (AWS console → CloudFormation).
- **The adoption** stops before changing anything if the host already has another instance profile.
- **The release** prints the host's log, and the full log is in `/si-academy/production/release`.
  - **Failed before the services were replaced**: the previous release keeps serving.
  - **Failed after a migration**: the pre-release snapshot is named in the job's log.

## 12. Costs and the account

About US$70 a month at Sydney list prices, before tax and credits (ADR-0042):

- **Already running**: the host about $26, with its disk and public address.
- **New**:
  - the load balancer about $20;
  - the database about $20;
  - secrets about $3;
  - logs, images and files about $1–2.
- **No charge**: CloudFront and the ten alarms stay within their free tiers.

The account is on AWS's **Free plan** with US$120 of credits: about 1.7 months. AWS closes a
Free-plan account when its credits run out or the plan ends (7 April 2027), unless it is upgraded.
Upgrade before learners depend on it.

The Zero Spend Alert counts credits, so it stays silent until they are spent. Watch the remaining
credits in the Billing console, or set a budget that ignores credits.

## 13. Taking it down

Only with the client's written approval. Turn off the database's deletion protection, then delete
the stack `si-academy-production`.

- **The host** is not part of the stack and is left as it is. Detach its instance profile and the
  app security group first.
- **Kept on purpose**, deleted by hand if wanted:
  - the S3 buckets;
  - the ECR repositories;
  - the database's final snapshot.
