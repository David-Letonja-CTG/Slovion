#!/usr/bin/env bash
# Checks a running Slovion stack from the outside. Usage: deploy/smoke-test.sh http://localhost:8080
# Used by CI against the stack built from a pull request, and usable against production.
set -euo pipefail

base="${1:?usage: smoke-test.sh <base URL>}"
failures=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "ok   $name"
  else
    echo "FAIL $name"
    failures=$((failures + 1))
  fi
}

# Waits up to 3 minutes for the API (through the web server) to report healthy.
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null "$base/health"; then break; fi
  sleep 2
done

headers() { curl -fsS -o /dev/null -D - "$@" | tr -d '\r'; }

check "/health answers 200" curl -fsS -o /dev/null "$base/health"
check "/ serves the client" bash -c "curl -fsS '$base/' | grep -q '<app-root'"
check "/play (deep link) serves the client" bash -c "curl -fsS '$base/play' | grep -q '<app-root'"
check "index.html is not cached" bash -c "$(declare -f headers); headers '$base/' | grep -qi '^cache-control: no-cache'"
check "security headers are set" bash -c "$(declare -f headers); h=\$(headers '$base/'); grep -qi '^x-content-type-options: nosniff' <<<\"\$h\" && grep -qi '^referrer-policy: no-referrer' <<<\"\$h\""
check "hashed bundles are immutable" bash -c "$(declare -f headers); js=\$(curl -fsS '$base/' | grep -o 'main-[A-Z0-9]\{8\}\.js' | head -n 1); [ -n \"\$js\" ] && headers '$base/'\"\$js\" | grep -qi 'immutable'"
check "a map is served without caching" bash -c "$(declare -f headers); headers '$base/content/maps/dravsko_polje_meadow.json' | grep -qi '^cache-control: no-cache'"
check "POST /api/saves creates a save" bash -c "curl -fsS -X POST '$base/api/saves' | grep -q '\"token\"'"
check "an unknown API path is a problem response" bash -c "[ \"\$(curl -s -o /dev/null -w '%{http_code}' '$base/api/nope')\" = 404 ]"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
