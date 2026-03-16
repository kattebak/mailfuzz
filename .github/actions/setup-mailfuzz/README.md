# Setup Mailfuzz Action

Composite GitHub Action that sets up a complete local mail testing environment:

1. Installs and configures **Dovecot** IMAP server with Maildir support
2. Installs and configures **Postfix** for local-only delivery
3. Runs **mailfuzz** to generate a deterministic test inbox
4. Starts both services and verifies authentication

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `config` | Path to a mailfuzz config file | _(none)_ |
| `test-user` | IMAP test account username | `testuser` |
| `test-password` | IMAP test account password | `testpass` |
| `message-count` | Number of messages to generate | `50` |
| `seed` | Seed for deterministic generation | `1984` |
| `install-mailfuzz` | Install mailfuzz from npm | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `imap-host` | Always `localhost` |
| `imap-port` | Always `143` |
| `maildir-path` | Path to the generated Maildir |
| `message-count` | Actual number of messages generated |

## Usage

```yaml
steps:
  - uses: actions/checkout@v4

  # Install from npm
  - uses: kattebak/mailfuzz/.github/actions/setup-mailfuzz@main
    with:
      message-count: "100"
      seed: "42"

  # Or use a local build (set install-mailfuzz to false)
  - uses: ./.github/actions/setup-mailfuzz
    with:
      install-mailfuzz: "false"
      message-count: "100"
```
