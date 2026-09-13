#!/bin/bash
# Quick start without building the .app bundle.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

PY="$(command -v python3 || true)"
if [ -z "$PY" ]; then
  echo "Python 3 is required. Install the Xcode Command Line Tools: xcode-select --install"
  echo "As a fallback, open app/index.html in Google Chrome."
  exit 1
fi

PORTFILE="$(mktemp)"
"$PY" "$ROOT/packaging/server.py" "$ROOT/app" > "$PORTFILE" &
SRV=$!
trap 'kill $SRV 2>/dev/null || true; rm -f "$PORTFILE"' EXIT INT TERM

PORT=""
for _ in $(seq 1 20); do
  PORT="$(head -n 1 "$PORTFILE" 2>/dev/null | tr -dc '0-9')"
  [ -n "$PORT" ] && break
  sleep 0.1
done
[ -z "$PORT" ] && { echo "Could not start the local server"; exit 1; }

URL="http://127.0.0.1:$PORT/index.html"
echo "Excel Trainer is running at $URL"
echo "Press Ctrl+C to stop."

if [ "$(uname)" = "Darwin" ]; then
  for NAME in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium"; do
    BIN="/Applications/$NAME.app/Contents/MacOS/$NAME"
    if [ -x "$BIN" ]; then
      "$BIN" --app="$URL" --user-data-dir="$HOME/Library/Application Support/ExcelTrainer/browser-profile" \
        --no-first-run --no-default-browser-check >/dev/null 2>&1
      exit 0
    fi
  done
  open "$URL"
fi
wait $SRV
