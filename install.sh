#!/usr/bin/env bash
# FoldLock one-click install. Counted download via this project's Worker.
# Usage: curl -fsSL https://foldlock-download-tracker.vibelock.workers.dev/install.sh | bash
set -euo pipefail

HOST="${FOLDLOCK_HOST:-https://foldlock-download-tracker.vibelock.workers.dev}"
ASSET="${FOLDLOCK_ASSET:-foldlock-0.8.0.tar.gz}"
WORKDIR="${FOLDLOCK_HOME:-$HOME/foldlock}"

mkdir -p "$WORKDIR"
cd "$WORKDIR"

echo "Downloading counted tarball from ${HOST}/download (User-Agent Mozilla/5.0)…"
curl -fsSL -A 'Mozilla/5.0' "${HOST}/download?asset=${ASSET}" -o "${ASSET}"

tar -xzf "${ASSET}"
DIR="$(find . -maxdepth 1 -type d -name 'foldlock-*' | head -n 1)"
if [ -n "${DIR}" ]; then
  cd "${DIR}"
fi

python3 -m venv .venv
# shellcheck disable=SC1091
. .venv/bin/activate
python -m pip install -U pip
python -m pip install -e .

echo
echo "Installed FoldLock."
echo "Run:  foldlock ui"
echo "Then open http://127.0.0.1:8872  (loopback only)"
echo "Zip-class compression engine. Author: Aziel Eliab."
