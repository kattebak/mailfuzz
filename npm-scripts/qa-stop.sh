#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Detect container runtime
if command -v docker &> /dev/null; then
    RUNTIME="docker"
elif command -v podman &> /dev/null; then
    RUNTIME="podman"
else
    echo "❌ Error: Neither docker nor podman found."
    exit 1
fi

echo "🛑 Stopping Dovecot QA server..."
$RUNTIME compose -f docker-compose.dovecot.yml down

echo "✅ Dovecot stopped."
