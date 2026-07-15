# Verify IMAP Action

Composite GitHub Action that verifies a local IMAP server is running and serving emails.

Connects to the server, authenticates, lists mailboxes, checks message count, and samples message envelopes.

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `imap-host` | IMAP server hostname | `localhost` |
| `imap-port` | IMAP server port | `143` |
| `username` | Authentication username | `testuser` |
| `password` | Authentication password | `testpass` |
| `expected-messages` | Minimum messages expected (0 = connection check only) | `0` |

## Outputs

| Output | Description |
|--------|-------------|
| `message-count` | Actual number of messages found |
| `success` | `true` or `false` |

## Usage

```yaml
steps:
  - uses: actions/checkout@v5

  - uses: kattebak/mailfuzz/.github/actions/verify-imap@main
    with:
      expected-messages: "50"
```
