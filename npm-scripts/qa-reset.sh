#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Stop if running
"$SCRIPT_DIR/qa-stop.sh" 2>/dev/null || true

# Remove maildir
if [ -d "./maildir" ]; then
    echo "🗑️  Removing existing maildir..."
    rm -rf ./maildir
fi

echo ""
echo "✅ QA environment reset."
echo ""
echo "Generate new emails with:"
echo "   npm run dev -- generate -o ./maildir -n 100"
