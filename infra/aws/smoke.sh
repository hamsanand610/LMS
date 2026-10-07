#!/usr/bin/env bash
# Production smoke checks from the outside, through CloudFront (deploy workflow, job "verify"):
# read-only, anonymous, nothing written. Every failed check is listed; any failure fails the run.
#
#   STORAGE_ORIGIN=https://s3.<region>.amazonaws.com infra/aws/smoke.sh https://<site>
set -Euo pipefail

site="${1:?the site, e.g. https://d1234.cloudfront.net}"
site="${site%/}"
host="${site#https://}"
storage="${STORAGE_ORIGIN:-}"
failures=0
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

pass() { echo "ok    $*"; }
fail() {
  echo "FAIL  $*"
  failures=$((failures + 1))
}
check() {
  local name="$1"
  shift
  if "$@"; then pass "$name"; else fail "$name"; fi
}
# fetch <name> <url> [curl options] — keeps the headers and body; prints the status code.
fetch() {
  local name="$1" url="$2"
  shift 2
  curl -sS --max-time 30 -o "$work/$name.body" -D "$work/$name.headers" -w '%{http_code}' \
    "$@" "$url" 2> /dev/null || echo 000
}
header() {
  grep -i "^$2:" "$work/$1.headers" 2> /dev/null | tail -n 1 | cut -d: -f2- | tr -d '\r' |
    sed 's/^ *//'
}

# 1. Plain HTTP is sent to HTTPS.
code="$(fetch http "http://$host/login")"
check "http is redirected to https ($code)" test "$code $(header http location)" = "301 $site/login"

# 2. The sign-in page, with the web app's own security headers.
code="$(fetch login "$site/login")"
check "the sign-in page answers ($code)" test "$code" = 200
check "content security policy" test -n "$(header login content-security-policy)"
check "HSTS" grep -qi '^strict-transport-security: max-age=' "$work/login.headers"
check "framing refused" test "$(header login x-frame-options)" = DENY
if [ -n "$storage" ]; then
  check "uploads to S3 allowed by the policy ($storage)" \
    grep -qi "^content-security-policy:.*connect-src[^;]*$storage" "$work/login.headers"
fi

# 3. The home page.
code="$(fetch home "$site/")"
check "the home page answers ($code)" grep -qE '^(200|307|308)$' <<< "$code"

# 4. The web app's hashed assets, cached by CloudFront.
asset="$(grep -oE '/_next/static/[^"'"'"' ]+\.js' "$work/login.body" | head -n 1)"
if [ -n "$asset" ]; then
  fetch first "$site$asset" > /dev/null
  code="$(fetch asset "$site$asset")"
  check "a static asset answers ($code)" test "$code" = 200
  check "static assets are immutable" grep -qi '^cache-control:.*immutable' "$work/asset.headers"
  check "static assets come through CloudFront ($(header asset x-cache))" \
    grep -qi '^x-cache:.*cloudfront' "$work/asset.headers"
else
  fail "no /_next/static asset on the sign-in page"
fi

# 5. The API reaches the database: the public branding is SI Academy's (the seeded overlay).
code="$(fetch branding "$site/api/v1/branding/public")"
check "the API answers ($code)" test "$code" = 200
check "SI Academy's branding is seeded" \
  test "$(jq -r '[.. | .brandName? // empty] | first // empty' "$work/branding.body" 2> /dev/null)" = "SI Academy"

# 6. A protected route refuses an anonymous caller, in the API's problem format.
code="$(fetch anonymous "$site/api/v1/auth/sessions")"
check "a protected route refuses anonymous callers ($code)" test "$code" = 401
check "errors are problem+json" grep -qi '^content-type: application/problem+json' "$work/anonymous.headers"

# 7. Cross-origin calls: the site itself only.
fetch cors "$site/api/v1/branding/public" -X OPTIONS -H "Origin: $site" \
  -H 'Access-Control-Request-Method: GET' > /dev/null
check "the site's own origin may call the API" test "$(header cors access-control-allow-origin)" = "$site"
fetch elsewhere "$site/api/v1/branding/public" -X OPTIONS -H 'Origin: https://elsewhere.example' \
  -H 'Access-Control-Request-Method: GET' > /dev/null
check "another origin may not" test -z "$(header elsewhere access-control-allow-origin)"

# 8. Public files come from S3 through CloudFront, inert.
photo="$(jq -r '[.. | .backgroundUrl? // empty] | first // empty' "$work/branding.body" 2> /dev/null)"
if [ -n "$photo" ]; then
  check "public files are under $site/files/" test "${photo#"$site"/files/}" != "$photo"
  code="$(fetch photo "$photo")"
  check "the sign-in photograph is served ($code)" test "$code" = 200
  check "it is an image ($(header photo content-type))" grep -qi '^content-type: image/' "$work/photo.headers"
  check "public files are sandboxed" test "$(header photo content-security-policy)" = sandbox
else
  fail "the branding has no sign-in photograph"
fi
code="$(fetch missing "$site/files/none/missing.png")"
check "a missing file is refused ($code)" grep -qE '^(403|404)$' <<< "$code"

# 9. The API's health routes stay inside the network.
code="$(fetch health "$site/health/ready")"
check "health checks are not public ($code)" test "$code" = 404

echo
if [ "$failures" -ne 0 ]; then
  echo "$failures smoke check(s) failed"
  exit 1
fi
echo "every smoke check passed"
