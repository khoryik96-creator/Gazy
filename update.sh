#!/usr/bin/env bash
# ============================================================================
#  Gazy — one-click updater (macOS / Linux)
#  Run this whenever a new version has been pushed. It pulls the latest prebuilt
#  extension into this same folder, so you never re-download or re-extract.
#  After it finishes, reload the extension in Chrome.
# ============================================================================
set -e
cd "$(dirname "$0")"

if ! command -v git >/dev/null 2>&1; then
  echo "Git is not installed. Install it from https://git-scm.com then run again."
  exit 1
fi

echo "Updating Gazy to the latest version..."
echo
git pull --ff-only

cat <<'EOF'

============================================================================
 Updated. Now finish in Chrome (about 10 seconds):
   1. Open  chrome://extensions
   2. Click the circular reload arrow on the Gazy card
   3. Refresh your LinkedIn tab
============================================================================
EOF
