#!/usr/bin/env bash
# Values the pipeline scripts share, read from infra/aws/production.json (the deployment's
# configuration; it holds no secret). Sourced, never run; the scripts that source it use these.
# shellcheck disable=SC2034

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CONFIG="$ROOT/infra/aws/production.json"
ACCOUNT_ID="$(jq -r .accountId "$CONFIG")"
REGION="$(jq -r .region "$CONFIG")"
ENVIRONMENT="$(jq -r .environment "$CONFIG")"
STACK="$(jq -r .stackName "$CONFIG")"

if ! [[ "$ACCOUNT_ID" =~ ^[0-9]{12}$ ]]; then
  echo "::error::infra/aws/production.json has no AWS account id yet: run infra/aws/bootstrap.sh first (docs/runbooks/aws-production.md)" >&2
  exit 1
fi

PIPELINE_BUCKET="si-academy-$ENVIRONMENT-$ACCOUNT_ID-$REGION-pipeline"
EXECUTION_ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/si-academy-cfn-exec-$ENVIRONMENT"
export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION"

# One output of the environment's stack.
stack_output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
