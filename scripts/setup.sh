#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Braillix dev environment setup
# Installs liblouis system library, creates Python venv, installs deps.
# ---------------------------------------------------------------------------

VENV_DIR=".venv"

detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unsupported"
    fi
}

install_liblouis() {
    local os="$1"
    echo ">>> Installing liblouis system library..."
    if [[ "$os" == "linux" ]]; then
        sudo apt-get update -qq
        sudo apt-get install -y liblouis-dev liblouis-data
    elif [[ "$os" == "macos" ]]; then
        if ! command -v brew &>/dev/null; then
            echo "ERROR: Homebrew not found. Install it from https://brew.sh first." >&2
            exit 1
        fi
        brew install liblouis
    else
        echo "ERROR: Unsupported OS '$OSTYPE'. Install liblouis manually." >&2
        exit 1
    fi
}

create_venv() {
    echo ">>> Creating Python virtual environment at $VENV_DIR ..."
    python3 -m venv "$VENV_DIR"
    # shellcheck source=/dev/null
    source "$VENV_DIR/bin/activate"
    pip install --upgrade pip --quiet
}

install_python_deps() {
    echo ">>> Installing Python dependencies from requirements.txt ..."
    pip install -r requirements.txt --quiet
}

verify_liblouis() {
    echo ">>> Verifying liblouis installation ..."
    python3 -c "import louis; print('liblouis OK:', louis.translateString(['en-us-g1.ctb'], 'hello'))"
}

# ---------------------------------------------------------------------------
main() {
    OS=$(detect_os)
    echo "Detected OS: $OS"

    install_liblouis "$OS"
    create_venv
    install_python_deps
    verify_liblouis

    echo ""
    echo "Setup complete. Activate your venv with:"
    echo "  source $VENV_DIR/bin/activate"
    echo "Then run:  make dev"
}

main "$@"
