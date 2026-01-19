# Mailfuzz QA Environment

Local Dovecot IMAP server for testing generated emails.

## Quick Start

```bash
# 1. Generate test emails
npm run dev -- generate -o ./maildir -n 100 --seed 12345

# 2. Start the IMAP server
npm run qa:start

# 3. Connect with any IMAP client (see below)

# 4. When done, stop the server
npm run qa:stop
```

## Email Client Configuration

| Setting  | Value            |
| -------- | ---------------- |
| Server   | `localhost`      |
| Port     | `1143`           |
| Security | None (plaintext) |
| Username | `testuser`       |
| Password | `testpass`       |

### Apple Mail (macOS)

1. Mail → Add Account → Other Mail Account
2. Enter any name/email, use `testuser` / `testpass`
3. Incoming Mail Server: `localhost:1143`
4. Uncheck SSL/TLS

### Thunderbird

1. Account Settings → Account Actions → Add Mail Account
2. Enter any name/email
3. Manual Config:
   - Incoming: IMAP, `localhost`, Port `1143`, No SSL, Normal Password
   - Skip outgoing (we don't send mail)

## Available Commands

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run qa:start` | Start the Dovecot container          |
| `npm run qa:stop`  | Stop the container                   |
| `npm run qa:logs`  | View container logs (Ctrl+C to exit) |
| `npm run qa:reset` | Stop container and remove maildir    |

## Requirements

- Docker or Podman installed
- Generated maildir (run `npm run dev -- generate ...` first)

### Installing Podman (macOS)

```bash
# Install podman and podman-compose
brew install podman podman-compose

# Initialize and start the Podman VM (required on macOS)
podman machine init
podman machine start
```

The Podman VM needs to be running before you can start containers. To check status:

```bash
podman machine info
```

To stop the VM when done:

```bash
podman machine stop
```

### Installing Docker (macOS)

Alternatively, install Docker Desktop:

```bash
brew install --cask docker
```

Then launch Docker Desktop from Applications.

### Installing on Linux

```bash
# Podman (Debian/Ubuntu)
sudo apt install podman podman-compose

# Or Docker (Debian/Ubuntu)
sudo apt install docker.io docker-compose-v2
```

## Troubleshooting

### Empty Mailbox

1. Check maildir has messages:

   ```bash
   ls -la ./maildir/new ./maildir/cur
   ```

2. Check Dovecot logs:
   ```bash
   npm run qa:logs
   ```

### Permission Issues

```bash
chmod -R 755 ./maildir
```

### Port Already in Use

Edit `docker-compose.dovecot.yml` and change `1143:143` to use a different host port.

## ⚠️ Security Warning

This configuration is for **LOCAL DEVELOPMENT ONLY**:

- Plain text authentication
- No TLS/SSL encryption
- Debug logging enabled

**Never expose to network or use in production.**
