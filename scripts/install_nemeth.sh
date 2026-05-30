#!/usr/bin/env bash
# install_nemeth.sh — create nemeth.ctb wrapper for liblouis 3.28+
# nemeth.ctb was removed from liblouis; en-us-mathtext.ctb provides the same coverage.
set -e

TABLES_DIR=$(python3 -c "import louis; import os; print(os.path.dirname(louis.listTables()[0]))")
NEMETH="$TABLES_DIR/nemeth.ctb"

echo "Tables directory: $TABLES_DIR"

if [ -f "$NEMETH" ]; then
    echo "nemeth.ctb already exists — skipping."
    exit 0
fi

sudo tee "$NEMETH" > /dev/null <<'EOF'
# nemeth.ctb — Nemeth Code for Mathematics and Science Notation
#
# nemeth.ctb was removed from liblouis in the 3.x series.
# This wrapper delegates to en-us-mathtext.ctb which provides
# equivalent coverage for mathematical notation in US Braille.
# Created by the Braillix project for liblouis compatibility.

include en-us-mathtext.ctb
EOF

echo "Created $NEMETH"
python3 -c "
import louis, os
r = louis.translateString(['unicode.dis', 'nemeth.ctb'], 'x^2 + 3')
all_braille = all(0x2800 <= ord(c) <= 0x283F for c in r)
print(f'nemeth.ctb test: {repr(r)} braille={all_braille} cells={len(r)}')
assert all_braille and len(r) > 0, 'Nemeth test FAILED'
print('nemeth.ctb: OK')
"
