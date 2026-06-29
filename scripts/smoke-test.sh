#!/usr/bin/env bash
#
# Smoke test for the prod-readiness changes — automated HTTP checks only.
# DB-dependent checks (audit rows, WORM, refund lifecycle) are in SMOKE_TEST.md.
#
# Usage:
#   BASE_URL=https://staging.example.com ./scripts/smoke-test.sh
#
# Exit code is non-zero if any check fails.

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
pass=0
fail=0

ok()   { echo "  PASS: $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL: $1"; fail=$((fail+1)); }
hdr()  { echo; echo "== $1 =="; }

# Returns body in $BODY and status in $CODE
req() {
  local method="$1" path="$2"; shift 2
  BODY="$(curl -s -X "$method" "$BASE_URL$path" -w $'\n%{http_code}' "$@")"
  CODE="${BODY##*$'\n'}"
  BODY="${BODY%$'\n'*}"
}

leaks() { # grep body for internal-detail signatures
  grep -qiE "constraint|relation \"|stack|syntax error|at Object|pg_|supabase\.co|Database error:|Redis error:" <<<"$1"
}

hdr "1. /api/health does not leak internals"
req GET /api/health
if [[ "$CODE" =~ ^(200|503)$ ]] && ! leaks "$BODY"; then
  ok "health returns $CODE with no internal error text"
else
  bad "health code=$CODE or leaked internals: $BODY"
fi

hdr "2. Unauthenticated admin route -> generic 401/403 (no leak)"
req GET /api/admin/users
if [[ "$CODE" =~ ^(401|403)$ ]] && ! leaks "$BODY"; then
  ok "admin/users blocked ($CODE), generic body"
else
  bad "expected 401/403 generic, got code=$CODE body=$BODY"
fi

hdr "3. Unsigned payment webhook -> 401"
req POST /api/webhooks/payments -H 'content-type: application/json' -d '{"data":{"reference":"smoke"}}'
if [[ "$CODE" == "401" ]]; then
  ok "unsigned webhook rejected (401)"
else
  bad "expected 401 for unsigned webhook, got $CODE"
fi

hdr "4. Ghana-rails webhook without bearer -> 401"
req POST /api/payments/ghana-rails/webhook -H 'content-type: application/json' -d '{"provider_transaction_id":"x","status":"completed"}'
if [[ "$CODE" == "401" ]]; then
  ok "ghana-rails webhook rejected without bearer (401)"
else
  bad "expected 401, got $CODE"
fi

hdr "5. Cron endpoint requires CRON_SECRET"
req GET /api/cron/appointment-reminders
if [[ "$CODE" =~ ^(401|500)$ ]] && ! leaks "$BODY"; then
  ok "cron blocked without secret ($CODE), generic body"
else
  bad "expected blocked+generic, got code=$CODE body=$BODY"
fi

hdr "6. Refunds route requires auth"
req GET /api/refunds
if [[ "$CODE" == "401" ]]; then
  ok "refunds list requires auth (401)"
else
  bad "expected 401, got $CODE"
fi

echo
echo "================================"
echo "  PASS: $pass   FAIL: $fail"
echo "  (DB + authenticated-flow checks: see SMOKE_TEST.md)"
echo "================================"
[[ "$fail" -eq 0 ]]
