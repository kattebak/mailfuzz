# mailfuzz

Generate massive amounts of RFC-compliant synthetic emails for testing.

Mailfuzz produces realistic email content and outputs to RFC-compliant Maildir directories. It supports deterministic generation via seeding, making it ideal for testing email clients, parsers, search systems, and migration tools.

## Features

- **RFC 2822 Compliant** - Generated emails pass mailparser validation
- **Maildir Output** - Proper directory structure with atomic writes
- **Deterministic** - Same seed produces identical output
- **Threading** - Realistic reply chains with proper In-Reply-To/References headers
- **Plugin Architecture** - Extensible content generation system
- **Dual Interface** - CLI for scripting, library API for integration

## Installation

```bash
npm install @kattebak/mailfuzz
```

## Quick Start

### CLI Usage

```bash
# Generate 100 emails to ./maildir
npx mailfuzz generate -o ./maildir -n 100

# Reproducible generation with seed
npx mailfuzz generate -o ./test-maildir -n 500 --seed 12345

# Use all available plugins
npx mailfuzz generate -n 100 --all-plugins

# Use specific plugins
npx mailfuzz generate -n 100 --plugins standard,marketing,spam

# List available plugins
npx mailfuzz plugins

# Validate an existing maildir
npx mailfuzz validate ./maildir
```

### Library Usage

```typescript
import {
  MailfuzzGenerator,
  MaildirWriter,
  StandardEmailPlugin,
} from "@kattebak/mailfuzz";

const generator = new MailfuzzGenerator({
  seed: 12345,
  messageCount: 100,
  plugins: [new StandardEmailPlugin()],
});

// Write to maildir
const writer = new MaildirWriter("./output-maildir");
const result = await writer.writeFromGenerator(generator.stream());

console.log(`Generated ${result.totalWritten} messages`);

// Or generate individual messages
const message = await generator.generateMessage();
console.log(message.subject, message.from.email);
```

## CLI Reference

```
mailfuzz generate [options]
mailfuzz validate <maildir-path>
mailfuzz plugins

GENERATE OPTIONS:
  -o, --output <path>       Output maildir path (default: ./maildir)
  -n, --count <number>      Number of messages to generate (default: 100)
  -s, --seed <number>       Random seed for deterministic generation
  -p, --participants <n>    Max participants in pool (default: 20)
  --conversations <n>       Max conversation threads (default: 30)
  --start-date <date>       Oldest message date (default: 30 days ago)
  --end-date <date>         Newest message date (default: now)
  --html-probability <n>    Probability of HTML content 0-1 (default: 0.7)
  --reply-probability <n>   Probability of reply vs new (default: 0.4)
  --forward-probability <n> Probability of forward (default: 0.1)
  --unread-probability <n>  Probability of unread messages 0-1 (default: 0.2)
  --recipient <email>       Fixed recipient email for all messages
  -w, --weight <plugin=n>   Override plugin weight (can be repeated)
  -q, --quiet               Suppress progress output

PLUGIN SELECTION (choose one):
  --plugins <list>          Comma-separated list of plugin IDs
  --all-plugins             Use all available plugins
  --plugin <name>           Add a plugin (can be repeated)

  If no plugin option is specified, only the "standard" plugin is used.

VALIDATE OPTIONS:
  --skip-content            Skip validating message content (faster)
```

## Library API

### MailfuzzGenerator

The main orchestrator for email generation.

```typescript
import { MailfuzzGenerator } from "@kattebak/mailfuzz";

const generator = new MailfuzzGenerator({
  seed: 12345, // Random seed for determinism
  messageCount: 100, // Total messages to generate
  maxParticipants: 20, // Size of fake participant pool
  maxConversations: 30, // Max concurrent threads
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-01-31"),
  htmlProbability: 0.7, // Chance of HTML content
  replyProbability: 0.4, // Chance of reply vs new
  forwardProbability: 0.1, // Chance of forward
  unreadProbability: 0.2, // Chance of unread (weighted towards present)
  recipient: "user@example.com", // Fixed recipient for all messages
  plugins: [new StandardEmailPlugin()],
  pluginWeights: { standard: 1.0 },
});

// Stream messages one at a time
for await (const message of generator.stream()) {
  console.log(message.messageId);
}

// Or get all at once
const messages = await generator.generateAll();
```

### MaildirWriter

Writes messages to Maildir format with atomic operations.

```typescript
import { MaildirWriter } from "@kattebak/mailfuzz";

const writer = new MaildirWriter("./maildir");

// Write from generator
const result = await writer.writeFromGenerator(generator.stream(), (count) =>
  console.log(`Progress: ${count}`),
);

// Or write a batch
const messages = await generator.generateAll();
const result = await writer.writeMessages(messages);

console.log({
  total: result.totalWritten,
  unread: result.newMessages, // in new/
  read: result.curMessages, // in cur/
  errors: result.errors,
});
```

### Validation

Validate generated emails and maildir structure.

```typescript
import { validateMaildir, validateMessage } from "@kattebak/mailfuzz";

// Validate entire maildir
const result = await validateMaildir("./maildir", true);
console.log(result.valid, result.messageCount, result.errors);

// Validate single message
const msgResult = await validateMessage(messageBuffer);
console.log(msgResult.valid, msgResult.errors, msgResult.warnings);
```

## Plugin System

Mailfuzz uses a plugin architecture for content generation. Plugins declare their capabilities and the engine selects appropriate plugins based on context.

### Built-in Plugins

| Plugin                    | ID            | Description                                                          |
| ------------------------- | ------------- | -------------------------------------------------------------------- |
| **StandardEmailPlugin**   | `standard`    | Personal/business correspondence with replies and forwards           |
| **MarketingEmailPlugin**  | `marketing`   | Promotional emails, product announcements, and loyalty campaigns     |
| **NewsletterEmailPlugin** | `newsletter`  | Subscription-based content emails and curated publications           |
| **SpamEmailPlugin**       | `spam`        | Phishing, scam, and unsolicited email for spam filter testing        |
| **FileUploadEmailPlugin** | `file-upload` | File export notifications, document sharing, and large file delivery |

Use `mailfuzz plugins` to see full details including capabilities and default weights.

### Creating Custom Plugins

```typescript
import type {
  EmailPlugin,
  PluginCapabilities,
  GenerationContext,
  EmailContent,
} from "@kattebak/mailfuzz";

class MarketingPlugin implements EmailPlugin {
  readonly id = "marketing";
  readonly name = "Marketing Newsletter";

  readonly capabilities: PluginCapabilities = {
    canBeReply: false, // Marketing emails are never replies
    canBeForward: false, // Or forwards
    canBeOriginal: true,
    supportsHtml: true,
    supportsAttachments: false,
    supportsMultipleRecipients: false,
  };

  generate(context: GenerationContext): EmailContent {
    const { faker } = context;

    return {
      subject: `🎉 ${faker.number.int({ min: 10, max: 50 })}% off everything!`,
      text: `Shop now at ${faker.internet.url()}`,
      html: `<h1>Big Sale!</h1><p>Shop now!</p>`,
    };
  }
}

// Use custom plugin
const generator = new MailfuzzGenerator({
  plugins: [new StandardEmailPlugin(), new MarketingPlugin()],
  pluginWeights: { standard: 0.7, marketing: 0.3 },
});
```

### Plugin Capabilities

| Capability                   | Description                                     |
| ---------------------------- | ----------------------------------------------- |
| `canBeReply`                 | Can generate reply content                      |
| `canBeForward`               | Can generate forward content                    |
| `canBeOriginal`              | Can generate new conversations (default: true)  |
| `supportsHtml`               | Can generate HTML content                       |
| `supportsAttachments`        | Can include attachments                         |
| `supportsMultipleRecipients` | Can address multiple recipients (default: true) |

## Maildir Format

Generated maildirs follow the standard specification:

```
maildir/
├── tmp/          # Temporary files during write (empty after generation)
├── new/          # Unread messages
└── cur/          # Read messages with flags
```

### Filename Format

```
<timestamp>.M<microseconds>P<pid>Q<delivery>.<hostname>,S=<size>[:2,<flags>]
```

Example: `1705594200.M654321P12345Q1.localhost,S=4096:2,RS`

### Message Flags

| Flag | Meaning            |
| ---- | ------------------ |
| D    | Draft              |
| F    | Flagged            |
| P    | Passed (forwarded) |
| R    | Replied            |
| S    | Seen               |
| T    | Trashed            |

## Deterministic Generation

The same seed and configuration produces byte-identical email content:

```typescript
// These produce identical subjects, bodies, participants
const gen1 = new MailfuzzGenerator({ seed: 42, messageCount: 10 });
const gen2 = new MailfuzzGenerator({ seed: 42, messageCount: 10 });

const msgs1 = await gen1.generateAll();
const msgs2 = await gen2.generateAll();

msgs1[0].subject === msgs2[0].subject; // true
```

Note: Maildir filenames differ between runs (they include timestamps and PIDs) but email content is deterministic.

## GitHub Actions

Mailfuzz provides composite GitHub Actions for setting up a complete mail testing environment in CI.

### Setup Mailfuzz Action (`.github/actions/setup-mailfuzz`)

Sets up a complete mail testing environment on GitHub Actions runners with Dovecot IMAP + Postfix. Installs system packages, creates a test user, generates emails with mailfuzz, and starts the mail services.

**Inputs:**

| Input | Description | Required | Default |
| --- | --- | --- | --- |
| `config` | Path to a mailfuzz config file | No | `""` |
| `test-user` | Username for the IMAP test account | No | `testuser` |
| `test-password` | Password for the IMAP test account | No | `testpass` |
| `message-count` | Number of messages to generate | No | `50` |
| `seed` | Seed for deterministic generation | No | `1984` |
| `install-mailfuzz` | Whether to install mailfuzz from npm (set to `false` if already installed in workspace) | No | `true` |

**Outputs:**

| Output | Description |
| --- | --- |
| `imap-host` | IMAP server hostname (`localhost`) |
| `imap-port` | IMAP server port (`143`) |
| `maildir-path` | Path to the generated Maildir |
| `message-count` | Actual number of messages generated |

**Usage from an external repo:**

```yaml
- uses: kattebak/mailfuzz/.github/actions/setup-mailfuzz@main
  with:
    message-count: "100"
    seed: "42"
```

**Usage from the mailfuzz repo:**

```yaml
- uses: ./.github/actions/setup-mailfuzz
```

### Verify IMAP Action (`.github/actions/verify-imap`)

Verifies a local IMAP server is running and serving emails correctly. Connects via IMAP, authenticates, and checks the message count in the inbox.

**Inputs:**

| Input | Description | Required | Default |
| --- | --- | --- | --- |
| `imap-host` | IMAP server hostname | No | `localhost` |
| `imap-port` | IMAP server port | No | `143` |
| `username` | IMAP authentication username | No | `testuser` |
| `password` | IMAP authentication password | No | `testpass` |
| `expected-messages` | Minimum number of messages expected (0 = just check connection) | No | `0` |

**Outputs:**

| Output | Description |
| --- | --- |
| `message-count` | Actual number of messages found in INBOX |
| `success` | Whether the verification succeeded |

**Usage:**

```yaml
- uses: kattebak/mailfuzz/.github/actions/verify-imap@main
  with:
    expected-messages: "50"
```

### Complete Workflow Example

```yaml
name: E2E Mail Tests
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - uses: kattebak/mailfuzz/.github/actions/setup-mailfuzz@main
        id: mailserver
        with:
          message-count: "100"
          seed: "42"

      - uses: kattebak/mailfuzz/.github/actions/verify-imap@main
        with:
          expected-messages: "100"

      - name: Run tests against IMAP server
        env:
          IMAP_HOST: ${{ steps.mailserver.outputs.imap-host }}
          IMAP_PORT: ${{ steps.mailserver.outputs.imap-port }}
        run: npm test
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

## QA Testing with Dovecot

Test generated emails in a real IMAP client:

```bash
# Generate test emails
npm run dev -- generate -o ./maildir -n 100 --seed 12345

# Start local IMAP server (requires Docker/Podman)
npm run qa:start

# Connect any IMAP client to localhost:1143
# Username: testuser, Password: testpass

# View server logs
npm run qa:logs

# Stop server
npm run qa:stop
```

See [qa/README.md](qa/README.md) for detailed setup instructions.

## License

ISC
