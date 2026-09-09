#!/bin/bash
# Запуск Excel-тренажёра. Лежит внутри ExcelTrainer.app/Contents/MacOS/.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
RES="$(cd "$HERE/../Resources" && pwd)"
APPDIR="$RES/app"
PROFILE="$HOME/Library/Application Support/ExcelTrainer"
mkdir -p "$PROFILE"

alert() { osascript -e "display alert \"Excel-тренажёр\" message \"$1\"" >/dev/null 2>&1; }

# --- 1. Локальный сервер (нужен, чтобы сохранялся прогресс) -----------------
PY=""
for cand in /usr/bin/python3 /usr/local/bin/python3 /opt/homebrew/bin/python3; do
  [ -x "$cand" ] && PY="$cand" && break
done
[ -z "$PY" ] && PY="$(command -v python3 2>/dev/null || true)"

PORT=""
SRV=""
if [ -n "$PY" ]; then
  PORTFILE="$(mktemp -t exceltrainer)"
  "$PY" "$RES/server.py" "$APPDIR" > "$PORTFILE" 2>/dev/null &
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

# --- 2. Родное окно, если оно собрано --------------------------------------
if [ -x "$RES/NativeShell" ]; then
  "$RES/NativeShell" "$URL"
  exit 0
fi

# --- 3. Окно браузера без вкладок и адресной строки ------------------------
for NAME in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium" "Yandex"; do
  BIN="/Applications/$NAME.app/Contents/MacOS/$NAME"
  if [ -x "$BIN" ]; then
    "$BIN" --app="$URL" \
      --user-data-dir="$PROFILE/browser-profile" \
      --no-first-run --no-default-browser-check --disable-features=Translate >/dev/null 2>&1
    exit 0
  fi
done

# --- 4. Запасной путь: браузер по умолчанию --------------------------------
open "$URL"
if [ -z "$PORT" ]; then
  MSG="Тренажёр открыт в браузере по умолчанию.\n\nPython 3 не найден, поэтому страница открыта как файл. В Safari прогресс в этом режиме не сохраняется — используйте Chrome или установите Xcode Command Line Tools (xcode-select --install).\n\nНе закрывайте это окно, пока занимаетесь."
else
  MSG="Тренажёр открыт в браузере по умолчанию.\n\nНе закрывайте это окно, пока занимаетесь: оно держит локальный сервер."
fi
osascript -e "display dialog \"$MSG\" buttons {\"Завершить\"} default button 1 with title \"Excel-тренажёр\"" >/dev/null 2>&1
