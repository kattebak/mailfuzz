# RFC-004: Local Dovecot QA Environment

> **Status**: Draft  
> **Created**: 2026-01-18  
> **Author**: Mailfuzz Team  
> **Depends On**: RFC-001

---

## Abstract

This RFC defines a local Dovecot IMAP server setup for manual QA and verification of generated emails. The setup uses Docker/Podman containers for portability across macOS and Linux, with minimal configuration that mounts a generated Maildir directly into the container.

---

## 1. Introduction

### 1.1 Purpose

When developing and testing Mailfuzz, we need a way to:

1. Visually inspect generated emails in a real email client
2. Verify RFC 2822 compliance through actual IMAP access
3. Test email threading, attachments, and HTML rendering
4. Debug issues that only manifest in real email clients

### 1.2 Goals

1. **Zero-Config Start**: Single command to spin up a working IMAP server
2. **Cross-Platform**: Works on macOS (Docker Desktop, Podman) and Linux
3. **Maildir Integration**: Mount generated Maildir directly into container
4. **Disposable**: Easy to reset, no persistent state requirements
5. **Developer Experience**: Simple authentication, standard ports

### 1.3 Non-Goals

- Production email server setup
- Multi-user authentication systems
- Email sending (SMTP)
- Persistent email storage across sessions

---

## 2. Technical Approach

### 2.1 Container Strategy

After evaluating several options:

| Approach                  | Pros               | Cons                                  |
| ------------------------- | ------------------ | ------------------------------------- |
| Native Dovecot (brew/apt) | Direct access      | Complex config, conflicts with system |
| Docker + Dovecot          | Isolated, portable | Requires Docker/Podman                |
| Pre-built mail server     | Full featured      | Overkill, complex                     |

**Decision**: Docker/Podman with official Dovecot image, using bind-mount for Maildir.

### 2.2 Dovecot Docker Image

Using the official `dovecot/dovecot` image:

- **Dovecot 2.3.x**: Stable, well-documented
- **Ports**: IMAP 143, IMAPS 993
- **Config Overrides**: Mount custom config to `/etc/dovecot/conf.d/`
- **Mail Storage**: Mount Maildir to `/srv/mail/`

### 2.3 Authentication Strategy

For local development, we use a simple static password file:

```
# Format: username:{scheme}password
testuser:{PLAIN}testpass
```

This allows any email client to connect with `testuser` / `testpass`.

### 2.4 Maildir Mapping

Dovecot expects a specific mail location format. Our generated Maildir at `./maildir` maps to:

```
mail_driver = maildir
mail_path = /srv/mail/Maildir
```

The container mounts: `./maildir:/srv/mail/Maildir`

---

## 3. Configuration Files

### 3.1 Custom Dovecot Config (`dovecot-qa.conf`)

```conf
# Mailfuzz QA Configuration for Dovecot
# Designed for local testing only - NOT FOR PRODUCTION

# Protocols
protocols = imap

# Logging (verbose for debugging)
log_path = /dev/stderr
auth_verbose = yes
mail_debug = yes

# Mail location - mount point for our Maildir
mail_driver = maildir
mail_path = /srv/mail/Maildir

# Disable SSL for local testing (simpler setup)
ssl = no

# Listen on all interfaces
listen = *

# Authentication - static passdb with simple password
passdb static {
  args = password=testpass
}

# Userdb - all users map to vmail user
userdb static {
  args = uid=vmail gid=vmail home=/srv/mail
}

# Service configuration for non-privileged port
service imap-login {
  inet_listener imap {
    port = 143
  }
}

# Allow plaintext auth (local testing only)
auth_mechanisms = plain login
disable_plaintext_auth = no
```

### 3.2 Docker Compose (`docker-compose.dovecot.yml`)

```yaml
version: "3.8"

services:
  dovecot:
    image: dovecot/dovecot:2.3.21
    container_name: mailfuzz-dovecot
    ports:
      - "1143:143" # IMAP on non-privileged port
    volumes:
      - ./maildir:/srv/mail/Maildir:rw
      - ./qa/dovecot/dovecot-qa.conf:/etc/dovecot/conf.d/99-local.conf:ro
    environment:
      - USER_PASSWORD={PLAIN}testpass
    restart: unless-stopped
```

---

## 4. Usage Workflow

### 4.1 Generate Test Emails

```bash
# Generate emails to the maildir directory
npm run generate -- -o ./maildir -n 100 --seed 12345
```

### 4.2 Start Dovecot Container

```bash
# Start the QA IMAP server
npm run qa:start

# Or manually:
docker compose -f docker-compose.dovecot.yml up -d
```

### 4.3 Connect Email Client

Configure any IMAP client:

| Setting  | Value            |
| -------- | ---------------- |
| Server   | `localhost`      |
| Port     | `1143`           |
| Security | None (plaintext) |
| Username | `testuser`       |
| Password | `testpass`       |

Recommended clients for testing:

- **macOS**: Apple Mail, Thunderbird
- **Linux**: Thunderbird, Evolution
- **Cross-platform**: Thunderbird, mutt

### 4.4 Stop and Clean Up

```bash
# Stop the container
npm run qa:stop

# Remove maildir and restart fresh
npm run qa:reset
```

---

## 5. Shell Scripts

### 5.1 `scripts/qa-start.sh`

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Ensure maildir exists
if [ ! -d "./maildir" ]; then
    echo "No maildir found. Generate emails first:"
    echo "  npm run generate -- -o ./maildir -n 100"
    exit 1
fi

# Detect container runtime
if command -v docker &> /dev/null; then
    RUNTIME="docker"
elif command -v podman &> /dev/null; then
    RUNTIME="podman"
else
    echo "Error: Neither docker nor podman found. Please install one."
    exit 1
fi

echo "Starting Dovecot QA server using $RUNTIME..."
$RUNTIME compose -f docker-compose.dovecot.yml up -d

echo ""
echo "✅ Dovecot IMAP server is running!"
echo ""
echo "Connect with any IMAP client:"
echo "  Server:   localhost"
echo "  Port:     1143"
echo "  Username: testuser"
echo "  Password: testpass"
echo "  Security: None"
echo ""
echo "View logs: npm run qa:logs"
echo "Stop:      npm run qa:stop"
```

### 5.2 `scripts/qa-stop.sh`

```bash
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
    echo "Error: Neither docker nor podman found."
    exit 1
fi

echo "Stopping Dovecot QA server..."
$RUNTIME compose -f docker-compose.dovecot.yml down

echo "✅ Dovecot stopped."
```

### 5.3 `scripts/qa-reset.sh`

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Stop if running
"$SCRIPT_DIR/qa-stop.sh" 2>/dev/null || true

# Remove maildir
if [ -d "./maildir" ]; then
    echo "Removing existing maildir..."
    rm -rf ./maildir
fi

echo "✅ QA environment reset. Generate new emails with:"
echo "   npm run generate -- -o ./maildir -n 100"
```

---

## 6. NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "qa:start": "./scripts/qa-start.sh",
    "qa:stop": "./scripts/qa-stop.sh",
    "qa:logs": "docker compose -f docker-compose.dovecot.yml logs -f",
    "qa:reset": "./scripts/qa-reset.sh"
  }
}
```

---

## 7. Troubleshooting

### 7.1 Permission Issues

If Dovecot can't read the Maildir:

```bash
# Ensure correct permissions (container runs as vmail:vmail, uid 1000)
chmod -R 755 ./maildir
```

### 7.2 Port Already in Use

Change the port mapping in `docker-compose.dovecot.yml`:

```yaml
ports:
  - "11143:143" # Use different host port
```

### 7.3 Container Won't Start

Check logs:

```bash
npm run qa:logs
# or
docker compose -f docker-compose.dovecot.yml logs
```

### 7.4 Empty Mailbox in Client

1. Verify maildir has messages: `ls -la ./maildir/new ./maildir/cur`
2. Check Dovecot logs for mail location errors
3. Ensure maildir structure is correct (has `tmp/`, `new/`, `cur/` directories)

---

## 8. Security Considerations

**WARNING**: This configuration is for LOCAL DEVELOPMENT ONLY.

- Plain text authentication is enabled
- No TLS/SSL encryption
- Static password for all users
- Debug logging exposes sensitive data

Never expose this configuration to a network or use in production.

---

## 9. Future Enhancements

1. **TLS Support**: Add self-signed certificates for testing encrypted connections
2. **Web Interface**: Add Roundcube or similar webmail for browser-based testing
3. **Multiple Users**: Support testing with multiple mailboxes
4. **CI Integration**: Automated email validation in CI pipelines

---

## 10. References

- [Dovecot Documentation](https://doc.dovecot.org/)
- [Dovecot Docker Hub](https://hub.docker.com/r/dovecot/dovecot)
- [Maildir Format Specification](https://cr.yp.to/proto/maildir.html)
- [RFC 2822 - Internet Message Format](https://tools.ietf.org/html/rfc2822)
