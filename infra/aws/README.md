# infra/aws — SI Academy on AWS

Production on AWS (ADR-0042). How to bootstrap, deploy, roll back and change it:
`docs/runbooks/aws-production.md`.

| File              | What it is                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `bootstrap.yml`   | Once per account: GitHub's OpenID Connect trust, the deploy and execution roles, the pipeline bucket |
| `bootstrap.sh`    | Applies `bootstrap.yml` with an administrator's AWS CLI sign-in; records the account id              |
| `stack.yml`       | The environment: network, RDS, S3, secrets, ECR, the load balancer, the host, CloudFront, alarms     |
| `production.json` | The environment's settings (the stack's parameters, the account id); no secret                       |
| `pipeline/`       | What the deploy workflow runs: the stack, the release over SSM, the health wait                      |
| `host/`           | What runs on the host for a release: `release.sh`, `render_env.py` (and its tests), `db-check.cjs`   |
| `smoke.sh`        | Anonymous, read-only checks through CloudFront                                                       |

The production compose file is `../compose.production.yml`; the starting data is
`../../clients/si-academy/`. Nothing here holds a secret, and nothing here may: secrets live in AWS
Secrets Manager and reach the host only at release time.
