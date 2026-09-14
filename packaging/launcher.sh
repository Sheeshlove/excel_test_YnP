#!/bin/bash
# Launches Excel Trainer. Lives inside ExcelTrainer.app/Contents/MacOS/.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
RES="$(cd "$HERE/../Resources" && pwd)"
APPDIR="$RES/app"
PROFILE="$HOME/Library/Application Support/ExcelTrainer"
mkdir -p "$PROFILE"

alert() { osascript -e "display alert \"Excel Trainer\" message \"$1\"" >/dev/null 2>&1; }

# --- 1. Local server: it holds the progress file and gives the page a stable
#        address, so what you did last time is still there next time -------
PY=""
for cand in /usr/bin/python3 /usr/local/bin/python3 /opt/homebrew/bin/python3; do
  [ -x "$cand" ] && PY="$cand" && break
done
[ -z "$PY" ] && PY="$(command -v python3 2>/dev/null || true)"

PORT=""
SRV=""
if [ -n "$PY" ]; then
  PORTFILE="$(mktemp -t exceltrainer)"
  "$PY" "$RES/server.py" "$APPDIR" --profile "$PROFILE" > "$PORTFILE" 2>/dev/null &
  SRV=$!
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    PORT="$(head -n 1 "$PORTFILE" 2>/dev/null | tr -dc '0-9')"
    [ -n "$PORT" ] && break
    sleep 0.1
  done
  rm -f "$PORTFILE"
  if [ -z "$PORT" ]; then kill "$SRV" 2>/dev/null; SRV=""; fi
fi

cleanup() { [ -n "$SRV" ] && kill "$SRV" 2>/dev/null; }
trap cleanup EXIT INT TERM

if [ -n "$PORT" ]; then
  URL="http://127.0.0.1:$PORT/index.html"
else
  URL="file://$APPDIR/index.html"
fi

# --- 2. Native window, if it was built --------------------------------------
if [ -x "$RES/NativeShell" ]; then
  "$RES/NativeShell" "$URL"
  exit 0
fi

# --- 3. A browser window with no tabs and no address bar --------------------
for NAME in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium" "Yandex"; do
  BIN="/Applications/$NAME.app/Contents/MacOS/$NAME"
  if [ -x "$BIN" ]; then
    "$BIN" --app="$URL" \
      --user-data-dir="$PROFILE/browser-profile" \
      --no-first-run --no-default-browser-check --disable-features=Translate >/dev/null 2>&1
    exit 0
  fi
done

# --- 4. Fallback: the default browser ---------------------------------------
open "$URL"
if [ -z "$PORT" ]; then
  MSG="Excel Trainer has opened in your default browser.\n\nPython 3 was not found, so the page was opened as a file and progress can only be kept by the browser itself - Chrome does that, Safari does not. For progress saved to a file instead, install the Xcode Command Line Tools (xcode-select --install) and rebuild the app.\n\nLeave this window open while you work."
else
  MSG="Excel Trainer has opened in your default browser.\n\nLeave this window open while you work - it is holding the local server, which is what saves your progress to:\n$PROFILE/progress.json"
fi
osascript -e "display dialog \"$MSG\" buttons {\"Quit\"} default button 1 with title \"Excel Trainer\"" >/dev/null 2>&1
