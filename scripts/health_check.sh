#!/bin/bash
# Braillix — demo-day health check.
# Run this on the Pi (or wherever the backend runs) BEFORE the demo.
# Exits 0 if everything is healthy, 1 if anything failed (CI/script friendly).
#
#   bash scripts/health_check.sh

BASE="${BRAILLIX_URL:-http://localhost:8000}"
FAILED=0

http_code() { curl -s -o /dev/null -w "%{http_code}" "$1"; }

check() {
    local name="$1" url="$2"
    local code
    code="$(http_code "$url")"
    if [ "$code" = "200" ]; then
        echo "  [OK]   $name"
    else
        echo "  [FAIL] $name (HTTP $code)"
        FAILED=1
    fi
}

echo "Braillix Health Check — $(date)"
echo "----------------------------------------"
echo "Target: $BASE"

check "API root"        "$BASE/"
check "Health endpoint" "$BASE/health"

# liblouis must actually be available (not just the endpoint responding).
HEALTH="$(curl -s "$BASE/health")"
if echo "$HEALTH" | grep -q '"liblouis_available": *true'; then
    echo "  [OK]   liblouis available"
else
    echo "  [FAIL] liblouis NOT available — translation will 503"
    FAILED=1
fi

# End-to-end translation (grade defaults to grade1; do NOT pass grade:1 — the
# API expects the string 'grade1'/'grade2').
RESULT="$(curl -s -X POST "$BASE/translate" \
    -H "Content-Type: application/json" \
    -d '{"text": "hello"}')"
if echo "$RESULT" | grep -q "braille_unicode"; then
    echo "  [OK]   translation pipeline"
else
    echo "  [FAIL] translation pipeline (unexpected response: ${RESULT:0:80})"
    FAILED=1
fi

# Nemeth math translation (the headline feature).
MATH="$(curl -s -X POST "$BASE/translate-math" \
    -H "Content-Type: application/json" \
    -d '{"latex": "x^2 + 1 = 0"}')"
if echo "$MATH" | grep -q "braille_unicode"; then
    echo "  [OK]   Nemeth math translation"
else
    echo "  [FAIL] Nemeth math translation (check nemeth.ctb)"
    FAILED=1
fi

echo "----------------------------------------"
if [ "$FAILED" -eq 0 ]; then
    echo "All checks passed. Demo ready."
else
    echo "FAILURES DETECTED. Do not start the demo — see docs/demo-day-runbook.md."
fi
exit "$FAILED"
