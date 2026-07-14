#!/bin/bash
# Builds Focus.app from the web app one folder up.
# Re-run this after changing index.html / styles.css / app.js.
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
OUT="$ROOT/Focus.app"

echo "→ Building $OUT"
rm -rf "$OUT"
mkdir -p "$OUT/Contents/MacOS" "$OUT/Contents/Resources"

echo "→ Compiling Swift wrapper"
swiftc -O -o "$OUT/Contents/MacOS/Focus" main.swift

echo "→ Bundling resources"
cp Info.plist "$OUT/Contents/"
cp "$ROOT/index.html" "$ROOT/styles.css" "$ROOT/app.js" "$OUT/Contents/Resources/"
cp "$ROOT/manifest.webmanifest" "$ROOT/sw.js" "$OUT/Contents/Resources/" 2>/dev/null || true
if [ -d "$ROOT/icons" ]; then
  cp -R "$ROOT/icons" "$OUT/Contents/Resources/"
fi
if [ -d "$ROOT/backgrounds" ]; then
  cp -R "$ROOT/backgrounds" "$OUT/Contents/Resources/"
fi
if [ -d "$ROOT/sounds" ]; then
  cp -R "$ROOT/sounds" "$OUT/Contents/Resources/"
fi

echo "→ Generating icon"
ICONSET="$(mktemp -d)/AppIcon.iconset"
mkdir -p "$ICONSET"
if swift gen_icon.swift "$ICONSET" && iconutil -c icns "$ICONSET" -o "$OUT/Contents/Resources/AppIcon.icns"; then
  echo "   icon ok"
else
  echo "   icon generation failed — app will use the default icon" >&2
fi

echo "→ Signing (ad-hoc, required on Apple Silicon)"
codesign --force -s - "$OUT"

echo "✓ Done: $OUT"
