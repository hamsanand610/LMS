#!/usr/bin/env bash
# Waits until the load balancer sees the API and the web app healthy (deploy workflow, job
# "verify"): the API's /health/ready (database and storage) and the web app's /login.
set -Eeuo pipefail
# shellcheck source=infra/aws/pipeline/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

for name in ApiTargetGroupArn WebTargetGroupArn; do
  group="$(stack_output "$name")"
  state=""
  for _ in $(seq 1 40); do
    state="$(aws elbv2 describe-target-health --target-group-arn "$group" \
      --query 'TargetHealthDescriptions[].TargetHealth.State' --output text)"
    [ "$state" = healthy ] && break
    sleep 15
  done
  echo "${name%Arn}: $state"
  if [ "$state" != healthy ]; then
    aws elbv2 describe-target-health --target-group-arn "$group" --output table
    echo "::error::${name%Arn} is not healthy"
    exit 1
  fi
done
