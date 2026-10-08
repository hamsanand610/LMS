# infra/aws — SI Academy on AWS

Production on AWS in ap-southeast-2 (ADR-0042). How to bootstrap, deploy, roll back and change it:
`docs/runbooks/aws-production.md`.

| File              | What it is                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bootstrap.yml`   | Once per account: the deploy role and who may assume it (a deploy user today, GitHub OIDC once allowed), the execution role, the pipeline bucket |
| `bootstrap.sh`    | Applies `bootstrap.yml` with an administrator's AWS CLI sign-in; records the account id                                                          |
| `stack.yml`       | The environment: two private subnets in the default VPC, RDS, S3, secrets, ECR, the load balancer, CloudFront, the host's role, alarms           |
| `production.json` | The environment's settings (the stack's parameters, the existing host, the account id); no secret                                                |
| `pipeline/`       | What the deploy workflow runs: the stack, adopting the existing host, the release over SSM, the health wait                                      |
| `host/`           | What runs on the host for a release: `prepare-host.sh`, `release.sh`, `render_env.py` (and its tests), `db-check.cjs`                            |
| `smoke.sh`        | Anonymous, read-only checks through CloudFront                                                                                                   |

The production compose file is `../compose.production.yml`; the starting data is
`../../clients/si-academy/`. Nothing here holds a secret, and nothing here may: secrets live in AWS
Secrets Manager and reach the host only at release time. The stack never creates, replaces or stops
the host.
