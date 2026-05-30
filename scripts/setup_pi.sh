#!/bin/bash
# Braillix — one-command Raspberry Pi setup.
# Idempotent: safe to run more than once. Exits on the first error (set -e),
# so a partial/broken setup fails LOUDLY instead of looking like it worked.
#
# Target: Raspberry Pi OS Bookworm (Debian 12), Python 3.11.
# Run from the repo root:  bash scripts/setup_pi.sh

set -euo pipefail

echo "Braillix Pi Setup — starting"
echo "----------------------------------------"

# Resolve repo root (this script lives in scripts/).
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# --- 1. System dependencies (liblouis comes from apt, not pip, on ARM) ---
echo "[1/5] Installing system packages..."
sudo apt-get update -q
sudo apt-get install -y \
    python3 python3-venv python3-pip \
    python3-louis liblouis-data \
    git curl

# --- 2. Nemeth table: copy our wrapper into the liblouis tables dir if absent ---
echo "[2/5] Ensuring nemeth.ctb is installed..."
TABLES_DIR="$(dpkg -L liblouis-data 2>/dev/null | grep -m1 '/tables$' || echo /usr/share/liblouis/tables)"
if [ ! -f "$TABLES_DIR/nemeth.ctb" ]; then
    sudo cp scripts/nemeth.ctb "$TABLES_DIR/nemeth.ctb"
    echo "      installed nemeth.ctb -> $TABLES_DIR"
else
    echo "      nemeth.ctb already present at $TABLES_DIR"
fi

# --- 3. Python virtual environment (Bookworm requires a venv for pip) ---
echo "[3/5] Creating Python venv..."
if [ ! -d venv ]; then
    python3 -m venv --system-site-packages venv   # --system-site-packages so apt's python3-louis is importable
    echo "      created venv (with system site packages for python3-louis)"
else
    echo "      venv already exists"
fi
# shellcheck disable=SC1091
source venv/bin/activate

# --- 4. Python dependencies (backend only — no torch/pix2tex) ---
echo "[4/5] Installing Python dependencies (this can take a few minutes)..."
pip install --upgrade pip -q
pip install -q -r requirements_pi.txt

# --- 5. Environment file ---
echo "[5/5] Preparing .env..."
if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    echo "      created .env from .env.example — review it before starting"
else
    echo "      .env already present (or no .env.example to copy)"
fi

# --- Sanity check: can we import the app and liblouis? ---
echo "----------------------------------------"
echo "Verifying install..."
python3 -c "import louis; print('  liblouis', louis.version())"
python3 -c "from backend.main import app; print('  FastAPI app imports OK')"

echo "----------------------------------------"
echo "Braillix Pi Setup — complete."
echo "Start the backend with:"
echo "  source venv/bin/activate && uvicorn backend.main:app --host 0.0.0.0 --port 8000"
echo "Or install the systemd service (auto-start on boot): see scripts/braillix.service"
