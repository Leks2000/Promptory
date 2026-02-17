#!/bin/bash
# Promptory - Chrome Web Store build script
# Creates a clean zip file excluding dev/test files

set -e

VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
OUTPUT="../promptory-v${VERSION}.zip"

echo "Building Promptory v${VERSION}..."

# Remove previous build
rm -f "$OUTPUT"

# Create zip excluding dev/test/build files
zip -r "$OUTPUT" . \
  -x ".vscode/*" \
  -x "tests/*" \
  -x "*.sql" \
  -x "supabase/*" \
  -x "demo.html" \
  -x "test-ui.html" \
  -x "sample-data.json" \
  -x "deno.json" \
  -x "deno.lock" \
  -x "STRUCTURE.txt" \
  -x "EXAMPLES.md" \
  -x "PROJECT_ROADMAP.md" \
  -x "README.md" \
  -x "LICENSE" \
  -x "assets/create-icons.html" \
  -x "assets/icon-source*.png" \
  -x "i18n.js" \
  -x "build.sh" \
  -x ".DS_Store" \
  -x "*.map" \
  -x ".git/*" \
  -x ".gitignore"

echo ""
echo "Built: $OUTPUT"
echo "Size: $(du -h "$OUTPUT" | cut -f1)"
echo ""
echo "Contents:"
unzip -l "$OUTPUT"
