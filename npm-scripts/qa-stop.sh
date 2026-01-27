#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Detect container runtime (prefer podman)
if command -v podman &> /dev/null; then
    RUNTIME="podman"
elif command -v docker &> /dev/null; then
    RUNTIME="docker"
else
    echo "❌ Error: Neither podman nor docker found."
    exit 1
fi

echo "🛑 Stopping Dovecot QA server..."
$RUNTIME compose -f docker-compose.dovecot.yml down

echo "✅ Dovecot stopped."
