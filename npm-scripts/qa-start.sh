#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Ensure maildir exists with proper structure
if [ ! -d "./maildir" ] || [ ! -d "./maildir/new" ]; then
    echo "⚠️  No valid maildir found. Generate emails first:"
    echo "   npm run dev -- generate -o ./maildir -n 100"
    echo ""
    echo "Or create empty maildir structure:"
    mkdir -p ./maildir/{tmp,new,cur}
    echo "   Created empty maildir at ./maildir"
fi

# Detect container runtime (prefer podman)
if command -v podman &> /dev/null; then
    RUNTIME="podman"
elif command -v docker &> /dev/null; then
    RUNTIME="docker"
else
    echo "❌ Error: Neither podman nor docker found. Please install one."
    exit 1
fi

echo "🚀 Starting Dovecot QA server using $RUNTIME..."
$RUNTIME compose -f docker-compose.dovecot.yml up -d

echo ""
echo "✅ Dovecot IMAP server is running!"
echo ""
echo "📧 Connect with any IMAP client:"
echo "   Server:   localhost"
echo "   Port:     1143"
echo "   Username: testuser"
echo "   Password: testpass"
echo "   Security: None (plaintext)"
echo ""
echo "📝 Commands:"
echo "   View logs: npm run qa:logs"
echo "   Stop:      npm run qa:stop"
echo "   Reset:     npm run qa:reset"
