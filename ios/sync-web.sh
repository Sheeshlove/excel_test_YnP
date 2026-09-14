#!/bin/bash
# Copies the web app into the Xcode project.
# Run it after changing anything under app/, then rebuild in Xcode.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/ios/Web"

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$ROOT/app/." "$DEST/"

# the service worker is pointless inside the bundle: the files are already local,
# and a custom URL scheme cannot register one anyway
rm -f "$DEST/sw.js"

echo "Web assets copied to ios/Web"
echo "File count: $(find "$DEST" -type f | wc -l | tr -d ' ')"
echo
echo "In Xcode: make sure the blue 'Web' folder reference points at ios/Web,"
echo "then Product > Run."
