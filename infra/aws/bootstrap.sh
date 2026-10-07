#!/usr/bin/env bash
# Once per AWS account, by an administrator of that account, from a clone of this repository
# (ADR-0042, docs/runbooks/aws-production.md):
#
#   aws login                    # or: aws configure sso
#   bash infra/aws/bootstrap.sh
#
# Creates the bootstrap stack (GitHub's OpenID Connect trust, the deploy workflow's role, the
# role CloudFormation uses, the pipeline bucket) and writes the account id into
# infra/aws/production.json. Nothing of the production environment itself is created here: that is
# the deploy workflow's job, and only its job (operating rule 41). No key is created or printed.
set -Eeuo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config="$here/production.json"
py="$(command -v python3 || command -v python || true)"
[ -n "$py" ] || {
  echo "Python 3 is needed to read $config" >&2
  exit 1
}
# value <dotted.path> — one value of production.json.
value() {
  "$py" -c 'import json, sys
c = json.load(open(sys.argv[1], encoding="utf-8"))
for key in sys.argv[2].split("."):
    c = c[key]
print(c)' "$config" "$1"
}

region="$(value region)"
environment="$(value environment)"
stack="$(value bootstrapStackName)"
owner="$(value github.owner)"
repository="$(value github.repository)"
github_environment="$(value github.environment)"

account="$(aws sts get-caller-identity --query Account --output text)"
echo "AWS account $account, region $region: bootstrap stack $stack"

existing="$(aws iam list-open-id-connect-providers \
  --query "OpenIDConnectProviderList[?ends_with(Arn, '/token.actions.githubusercontent.com')].Arn" \
  --output text)"
create_provider=true
if [ -n "$existing" ] && [ "$existing" != None ]; then
  # Already trusted (by this stack or another): kept as it is.
  if ! aws cloudformation describe-stack-resource --region "$region" --stack-name "$stack" \
    --logical-resource-id GitHubOidcProvider > /dev/null 2>&1; then
    create_provider=false
  fi
fi

aws cloudformation deploy \
  --region "$region" \
  --stack-name "$stack" \
  --template-file "$here/bootstrap.yml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
  "GitHubOwner=$owner" \
  "GitHubRepository=$repository" \
  "GitHubEnvironment=$github_environment" \
  "EnvironmentName=$environment" \
  "CreateOidcProvider=$create_provider" \
  --tags Application=si-academy "Environment=$environment"

"$py" - "$config" "$account" << 'PY'
import json
import sys

path, account = sys.argv[1], sys.argv[2]
with open(path, encoding='utf-8') as handle:
    config = json.load(handle)
config['accountId'] = account
with open(path, 'w', encoding='utf-8', newline='\n') as handle:
    json.dump(config, handle, indent=2)
    handle.write('\n')
PY

aws cloudformation describe-stacks --region "$region" --stack-name "$stack" \
  --query 'Stacks[0].Outputs' --output table
echo
echo "Bootstrap done. Commit infra/aws/production.json (it now names account $account), push it,"
echo "then deploy: push a tag production-<date> on main (docs/runbooks/aws-production.md)."
