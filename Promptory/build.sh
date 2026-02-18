#!/bin/bash
# Promptory - Chrome Web Store build script
# Creates a clean zip file excluding dev/test files
#
# Usage:
#   ./build.sh          - Standard build (unminified, for CWS review)
#   ./build.sh --prod   - Production build (minified JS/CSS)
#   ./build.sh --both   - Build both variants

set -e

VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
BUILD_MODE="${1:-standard}"

EXCLUDE_COMMON=(
  ".vscode/*"
  "tests/*"
  "*.sql"
  "supabase/*"
  "demo.html"
  "test-ui.html"
  "sample-data.json"
  "deno.json"
  "deno.lock"
  "STRUCTURE.txt"
  "EXAMPLES.md"
  "PROJECT_ROADMAP.md"
  "BRAINSTORM_FEATURES.md"
  "NEW_FEATURES_V1.10.md"
  "ONBOARDING_TUTORIAL_FINAL.md"
  "PRE_LAUNCH_AUDIT.md"
  "LEGAL_AUDIT_COMPLETE.md"
  "ADMIN_PANEL_TROUBLESHOOTING.md"
  "CWS_REVIEW_JUSTIFICATION.md"
  "SETUP_ADMIN_AND_DATA.md"
  "QUICK_ADMIN_SETUP.sql"
  "README.md"
  "LICENSE"
  "assets/create-icons.html"
  "assets/icon-source*.png"
  "i18n.js"
  "build.sh"
  ".DS_Store"
  "*.map"
  ".git/*"
  ".gitignore"
)

build_standard() {
  local OUTPUT="../promptory-v${VERSION}.zip"
  echo "Building Promptory v${VERSION} (standard/CWS review)..."
  rm -f "$OUTPUT"

  local ARGS=()
  for excl in "${EXCLUDE_COMMON[@]}"; do
    ARGS+=(-x "$excl")
  done

  zip -r "$OUTPUT" . "${ARGS[@]}"
  echo ""
  echo "Built: $OUTPUT"
  echo "Size: $(du -h "$OUTPUT" | cut -f1)"
  echo ""
  echo "Contents:"
  unzip -l "$OUTPUT"
}

build_prod() {
  local PROD_DIR="../promptory-prod-v${VERSION}"
  local OUTPUT="../promptory-prod-v${VERSION}.zip"
  echo "Building Promptory v${VERSION} (production/minified)..."

  # Check if terser/csso are available
  if ! command -v npx &> /dev/null; then
    echo "Warning: npx not found. Installing terser and csso-cli..."
    npm install -g terser csso-cli 2>/dev/null || true
  fi

  # Create prod copy
  rm -rf "$PROD_DIR"
  mkdir -p "$PROD_DIR"
  
  # Copy all files except excluded
  rsync -a --exclude='.git' --exclude='.vscode' --exclude='tests' \
    --exclude='supabase' --exclude='*.sql' --exclude='demo.html' \
    --exclude='test-ui.html' --exclude='sample-data.json' \
    --exclude='deno.json' --exclude='deno.lock' --exclude='*.md' \
    --exclude='build.sh' --exclude='i18n.js' --exclude='*.map' \
    --exclude='.gitignore' --exclude='.DS_Store' \
    . "$PROD_DIR/"

  # Minify JS files
  echo "Minifying JS..."
  find "$PROD_DIR" -name '*.js' -type f | while read jsfile; do
    if npx terser "$jsfile" --compress --mangle -o "${jsfile}.min" 2>/dev/null; then
      mv "${jsfile}.min" "$jsfile"
      echo "  ✓ $(basename "$jsfile")"
    else
      echo "  ⚠ $(basename "$jsfile") (kept original)"
    fi
  done

  # Minify CSS files
  echo "Minifying CSS..."
  find "$PROD_DIR" -name '*.css' -type f | while read cssfile; do
    if npx csso "$cssfile" -o "${cssfile}.min" 2>/dev/null; then
      mv "${cssfile}.min" "$cssfile"
      echo "  ✓ $(basename "$cssfile")"
    else
      echo "  ⚠ $(basename "$cssfile") (kept original)"
    fi
  done

  # Create zip
  rm -f "$OUTPUT"
  cd "$PROD_DIR"
  zip -r "$OUTPUT" .
  cd -

  echo ""
  echo "Built: $OUTPUT"
  echo "Size: $(du -h "$OUTPUT" | cut -f1)"

  # Cleanup
  rm -rf "$PROD_DIR"
}

case "$BUILD_MODE" in
  --prod)
    build_prod
    ;;
  --both)
    build_standard
    echo ""
    echo "=============================="
    echo ""
    build_prod
    ;;
  *)
    build_standard
    ;;
esac
