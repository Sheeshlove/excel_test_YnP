#!/bin/bash
# Builds ExcelTrainer.app for macOS.
# Run on a Mac:  ./build_app.sh   → ExcelTrainer.app appears next to the script.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="${1:-$ROOT/ExcelTrainer.app}"
NAME="ExcelTrainer"

echo "> Building $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

# --- contents ---------------------------------------------------------------
cp -R "$ROOT/app" "$APP/Contents/Resources/app"
cp "$ROOT/packaging/server.py" "$APP/Contents/Resources/server.py"
cp "$ROOT/packaging/launcher.sh" "$APP/Contents/MacOS/$NAME"
chmod +x "$APP/Contents/MacOS/$NAME"

# --- Info.plist ------------------------------------------------------------
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Excel Trainer</string>
  <key>CFBundleDisplayName</key><string>Excel Trainer</string>
  <key>CFBundleExecutable</key><string>$NAME</string>
  <key>CFBundleIdentifier</key><string>ru.gsom.exceltrainer</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>10.14</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>Excel training app</string>
</dict>
</plist>
PLIST

# --- icon --------------------------------------------------------------------
ICON_SRC="$ROOT/packaging/icon.png"
if [ ! -f "$ICON_SRC" ] && command -v python3 >/dev/null 2>&1; then
  python3 "$ROOT/packaging/make_icon.py" "$ICON_SRC" >/dev/null 2>&1 || true
fi
if [ -f "$ICON_SRC" ] && command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
  SET="$(mktemp -d)/AppIcon.iconset"
  mkdir -p "$SET"
  # iconutil only accepts this exact set of names
  for s in 16 32 128 256 512; do
    sips -z $s $s "$ICON_SRC" --out "$SET/icon_${s}x${s}.png" >/dev/null 2>&1
    sips -z $((s*2)) $((s*2)) "$ICON_SRC" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null 2>&1
  done
  iconutil -c icns "$SET" -o "$APP/Contents/Resources/AppIcon.icns" >/dev/null 2>&1 \
    && echo "  ok: icon built" \
    || { cp "$ICON_SRC" "$APP/Contents/Resources/AppIcon.png"; echo "  -- icon copied as a PNG"; }
  rm -rf "$(dirname "$SET")"
else
  [ -f "$ICON_SRC" ] && cp "$ICON_SRC" "$APP/Contents/Resources/AppIcon.png"
  echo "  -- sips/iconutil unavailable: no .icns icon"
fi

# --- native window (only if Swift is available) ------------------------------
if command -v swiftc >/dev/null 2>&1; then
  echo "> Compiling the native WKWebView window..."
  if swiftc -O -o "$APP/Contents/Resources/NativeShell" "$ROOT/packaging/NativeShell.swift" \
       -framework Cocoa -framework WebKit 2>/dev/null; then
    echo "  ok: native window built - the app opens without a browser"
  else
    echo "  -- build failed, the app will use a browser window"
    rm -f "$APP/Contents/Resources/NativeShell"
  fi
else
  echo "  -- swiftc not found: the app will open in a browser window"
  echo "     (for a native window run: xcode-select --install)"
fi

# --- readiness check ---------------------------------------------------------
if command -v python3 >/dev/null 2>&1; then
  echo "  ok: python3 found - progress will be saved"
else
  echo "  !! python3 not found. Install the Xcode Command Line Tools:"
  echo "    xcode-select --install"
fi

touch "$APP"
echo
echo "Done: $APP"
echo "Double-click it, or drag it into /Applications."
