# RFC-001: Mailfuzz - Email Generation Utility

> **Status**: Draft  
> **Created**: 2026-01-18  
> **Author**: Mailfuzz Team

---

## Abstract

Mailfuzz is a Node.js npm package that provides both a **command-line interface (CLI)** and a **programmatic library API** for generating RFC-compliant synthetic emails. Generated emails are output to an RFC Maildir-compliant directory structure. The utility supports deterministic generation via seeding, pluggable content generation via a theming/plugin system, and produces realistic email patterns including threads, replies, and forwards.

**Dual Interface Design:**

- **CLI**: For shell scripting, CI pipelines, and quick generation tasks
- **Library**: For integration into test suites, build tools, and other Node.js applications

---

## 1. Introduction

### 1.1 Purpose

Mailfuzz addresses the need for generating large volumes of realistic test emails for:

- Email client development and testing
- Email parsing library validation
- Email search and indexing system testing
- Machine learning training data generation
- Email migration tool testing

### 1.2 Goals

1. **RFC Compliance**: Generate emails that strictly adhere to RFC 2822 (Internet Message Format)
2. **Maildir Compliance**: Output emails to RFC-compliant Maildir directory structure
3. **Deterministic Generation**: Reproducible output given the same seed and configuration
4. **Extensibility**: Plugin-based architecture for content generation
5. **Developer Experience**: Fast iteration with modern TypeScript tooling

### 1.3 Non-Goals

- Sending emails via SMTP
- Email server implementation
- Email client implementation

---

## 2. Technical Architecture

### 2.1 Technology Stack

| Component         | Technology           | Rationale                           |
| ----------------- | -------------------- | ----------------------------------- |
| **Language**      | TypeScript           | Type safety, developer experience   |
| **Runtime**       | Node.js (ES Modules) | Native platform support             |
| **Linting**       | Biome.js             | Fast, unified linter/formatter      |
| **Type Checking** | TSGO                 | Faster than native tsc              |
| **Execution**     | TSX                  | No compilation step, fast iteration |
| **Testing**       | Vitest               | Fast, TypeScript-native testing     |
| **CI/CD**         | GitHub Actions       | Standard automation platform        |

### 2.2 Core Dependencies

#### 2.2.1 @faker-js/faker

**Purpose**: Deterministic fake data generation

**Key Features**:

- Seeded random number generation via `faker.seed()`
- Comprehensive data modules (person, internet, date, lorem, etc.)
- Locale support for internationalized content

**Usage Pattern**:

```typescript
import { faker } from "@faker-js/faker";

faker.seed(12345); // Deterministic output

const user = {
  name: faker.person.fullName(),
  email: faker.internet.email(),
};
```

**Seeding Behavior**:

- Same seed produces identical sequence of values
- Seed can be number or array of numbers
- Calling `faker.seed()` without arguments randomizes

#### 2.2.2 nodemailer/MailComposer

**Purpose**: RFC 2822-compliant email composition

**Key Features**:

- Full MIME multipart support
- Attachment handling (inline and regular)
- Proper header encoding (RFC 2047)
- Stream-based output for efficiency

**Installation**:

```bash
npm install nodemailer
```

**Usage Pattern**:

```typescript
import MailComposer from "nodemailer/lib/mail-composer";

const mail = new MailComposer({
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Hello World",
  text: "Plain text content",
  html: "<p>HTML content</p>",
  headers: {
    "Message-ID": "<unique-id@example.com>",
    Date: new Date().toUTCString(),
  },
});

// Get raw RFC 822 message as stream
const stream = mail.compile().createReadStream();

// Or as buffer
mail.compile().build((err, message) => {
  // message is Buffer containing raw email
});
```

**Supported Message Fields**:

- `from`, `to`, `cc`, `bcc`, `replyTo`
- `subject`, `text`, `html`
- `inReplyTo`, `references` (for threading)
- `messageId`, `date`
- `attachments`, `alternatives`
- `headers` (custom headers)

#### 2.2.3 mailparser

**Purpose**: Email parsing for validation

**Key Features**:

- Stream-based parsing for large messages
- Full MIME decoding
- Attachment extraction
- Header parsing with encoding support

**Usage Pattern**:

```typescript
import { simpleParser } from "mailparser";

const parsed = await simpleParser(emailBuffer);
// Validate parsed.from, parsed.to, parsed.subject, etc.
```

---

## 3. Functional Requirements

### 3.1 Core Email Generation

#### 3.1.1 Message Types

| Type           | Description                                      |
| -------------- | ------------------------------------------------ |
| **Plain Text** | Simple text/plain messages                       |
| **HTML**       | Multipart messages with text/html content        |
| **Multipart**  | Messages with attachments                        |
| **Reply**      | Messages with In-Reply-To and References headers |
| **Forward**    | Messages containing forwarded content            |

#### 3.1.2 Required Headers (per RFC 2822)

| Header       | Requirement    | Generation Strategy                    |
| ------------ | -------------- | -------------------------------------- |
| `Date`       | Required       | Generated within configured time range |
| `From`       | Required       | Selected from participant pool         |
| `To`         | Recommended    | Selected from participant pool         |
| `Subject`    | Recommended    | Plugin-generated content               |
| `Message-ID` | Should include | Generated unique ID per message        |

#### 3.1.3 Threading Headers

| Header        | Purpose                        |
| ------------- | ------------------------------ |
| `In-Reply-To` | Parent message's Message-ID    |
| `References`  | Chain of Message-IDs in thread |

### 3.2 Maildir Output

#### 3.2.1 Directory Structure

```
output/
├── tmp/          # Temporary files during write
├── new/          # Unread messages
├── cur/          # Read messages
└── .Folder/      # Subfolders (Maildir++ extension)
    ├── tmp/
    ├── new/
    ├── cur/
    └── maildirfolder
```

#### 3.2.2 Filename Format

```
<timestamp>.<delivery-id>.<hostname>[,S=<size>][:2,<flags>]
```

**Example**: `1705594200.M654321P12345.localhost,S=4096:2,S`

#### 3.2.3 Message Flags

| Flag | Meaning | Usage                       |
| ---- | ------- | --------------------------- |
| `S`  | Seen    | Message has been read       |
| `R`  | Replied | Message has been replied to |
| `F`  | Flagged | User-marked important       |
| `T`  | Trashed | Marked for deletion         |
| `D`  | Draft   | Work in progress            |
| `P`  | Passed  | Forwarded/resent            |

### 3.3 Deterministic Generation

#### 3.3.1 Seed Behavior

```typescript
interface GenerationConfig {
  seed: number; // Master seed for determinism
  // ... other options
}
```

- Same seed + same config = identical output
- Seed propagates through Faker.js
- All random decisions derived from seeded RNG

#### 3.3.2 Reproducibility Requirements

1. Message content must be deterministic
2. Participant selection must be deterministic
3. Date distribution must be deterministic
4. Read/unread status must be deterministic
5. Threading decisions must be deterministic

### 3.4 Time-Based Behavior

#### 3.4.1 Date Range Configuration

```typescript
interface TimeConfig {
  startDate: Date; // Oldest message date (default: 30 days ago)
  endDate: Date; // Newest message date (default: now)
}
```

#### 3.4.2 Read/Unread Probability

Messages are marked as read based on age:

- Newer messages: Higher probability of being unread
- Older messages: Lower probability of being unread

```typescript
// Probability function (example)
function isUnread(messageAge: number, maxAge: number): boolean {
  const ageRatio = messageAge / maxAge;
  const readProbability = ageRatio * 0.95; // 95% read at max age
  return faker.number.float() > readProbability;
}
```

---

## 4. Plugin Architecture

### 4.1 Plugin Interface

```typescript
interface EmailPlugin {
  /** Unique plugin identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Plugin capabilities */
  capabilities: {
    canBeReply: boolean; // Can generate reply content
    canBeForward: boolean; // Can generate forward content
    supportsHtml: boolean; // Generates HTML content
    supportsAttachments: boolean;
  };

  /** Generate email content */
  generate(context: GenerationContext): EmailContent;
}

interface GenerationContext {
  faker: Faker; // Seeded Faker instance
  isReply: boolean; // Is this a reply?
  isForward: boolean; // Is this a forward?
  parentMessage?: Message; // Parent message if reply/forward
  participants: Participant[];
}

interface EmailContent {
  subject: string;
  text: string;
  html?: string;
  attachments?: Attachment[];
}
```

### 4.2 Built-in Plugins

#### 4.2.1 Standard Email Plugin

Generates typical personal/business correspondence:

- Casual greetings and sign-offs
- Lorem-ipsum-style body content
- Realistic subject lines

**Capabilities**:

- ✅ Can be reply
- ✅ Can be forward
- ✅ Supports HTML
- ❌ Attachments (initial version)

#### 4.2.2 Future Plugins (Out of Scope for v1)

- Marketing emails (no replies)
- Newsletter subscriptions
- Notification emails
- Calendar invitations

### 4.3 Plugin Registration

```typescript
const generator = new EmailGenerator({
  plugins: [new StandardEmailPlugin(), new MarketingEmailPlugin()],
  pluginWeights: {
    standard: 0.8,
    marketing: 0.2,
  },
});
```

---

## 5. Configuration

### 5.1 Complete Configuration Schema

```typescript
interface MailfuzzConfig {
  // Output configuration
  output: {
    path: string; // Maildir output path
    format: "maildir"; // Currently only maildir supported
  };

  // Generation parameters
  generation: {
    seed: number; // Master random seed
    messageCount: number; // Total messages to generate
    maxParticipants: number; // Size of participant pool
    maxConversations: number; // Maximum thread count
  };

  // Time configuration
  time: {
    startDate: Date | string;
    endDate: Date | string;
  };

  // Plugin configuration
  plugins: {
    enabled: string[]; // Plugin IDs to use
    weights?: Record<string, number>;
    options?: Record<string, unknown>;
  };

  // Content options
  content: {
    htmlProbability: number; // 0-1, chance of HTML content
    replyProbability: number; // 0-1, chance of reply vs new
    forwardProbability: number; // 0-1, chance of forward
  };
}
```

### 5.2 Default Configuration

```typescript
const defaults: MailfuzzConfig = {
  output: {
    path: "./maildir",
    format: "maildir",
  },
  generation: {
    seed: Date.now(),
    messageCount: 100,
    maxParticipants: 20,
    maxConversations: 30,
  },
  time: {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  },
  plugins: {
    enabled: ["standard"],
  },
  content: {
    htmlProbability: 0.7,
    replyProbability: 0.4,
    forwardProbability: 0.1,
  },
};
```

---

## 6. CLI Interface

### 6.1 Command Structure

```bash
mailfuzz generate [options]
mailfuzz validate <maildir-path>
```

### 6.2 Generate Command Options

| Option            | Short | Description         | Default                |
| ----------------- | ----- | ------------------- | ---------------------- |
| `--output`        | `-o`  | Output directory    | `./maildir`            |
| `--count`         | `-n`  | Number of messages  | `100`                  |
| `--seed`          | `-s`  | Random seed         | Current timestamp      |
| `--config`        | `-c`  | Config file path    | `./mailfuzz.config.js` |
| `--participants`  | `-p`  | Max participants    | `20`                   |
| `--conversations` |       | Max conversations   | `30`                   |
| `--start-date`    |       | Oldest message date | 30 days ago            |
| `--end-date`      |       | Newest message date | Now                    |

### 6.3 Usage Examples

```bash
# Basic usage
mailfuzz generate -o ./test-maildir -n 500

# Reproducible generation
mailfuzz generate --seed 12345 -n 1000

# With config file
mailfuzz generate -c ./my-config.js

# Validate generated maildir
mailfuzz validate ./test-maildir
```

---

## 7. Library API

### 7.1 Programmatic Usage

```typescript
import { MailfuzzGenerator, StandardEmailPlugin } from "mailfuzz";

const generator = new MailfuzzGenerator({
  seed: 12345,
  messageCount: 100,
  plugins: [new StandardEmailPlugin()],
});

// Generate to maildir
await generator.generate("./output-maildir");

// Generate single message (for testing)
const message = generator.generateMessage();

// Stream messages
for await (const message of generator.stream()) {
  console.log(message.messageId);
}
```

### 7.2 Validation API

```typescript
import { validateMaildir, validateMessage } from "mailfuzz";

// Validate entire maildir
const results = await validateMaildir("./maildir");
console.log(`Valid: ${results.valid}, Errors: ${results.errors.length}`);

// Validate single message
const isValid = await validateMessage(messageBuffer);
```

---

## 8. Validation Strategy

### 8.1 Email Validation

All generated emails are validated using `mailparser`:

1. Parse generated RFC 822 content
2. Verify required headers present (Date, From)
3. Verify header encoding correctness
4. Verify MIME structure integrity
5. Verify threading headers consistency

### 8.2 Maildir Validation

1. Directory structure compliance
2. Filename format correctness
3. Flag ordering (alphabetical per spec)
4. No files in tmp/ after generation complete

### 8.3 Test Strategy

| Test Type         | Tool       | Scope                    |
| ----------------- | ---------- | ------------------------ |
| Unit Tests        | Vitest     | Plugin logic, utilities  |
| Integration Tests | Vitest     | Full generation pipeline |
| Validation Tests  | mailparser | RFC compliance           |
| Snapshot Tests    | Vitest     | Deterministic output     |

---

## 9. Project Structure

```
mailfuzz/
├── src/
│   ├── index.ts              # Public API exports
│   ├── cli.ts                # CLI entry point
│   ├── generator/
│   │   ├── MailfuzzGenerator.ts
│   │   ├── MessageFactory.ts
│   │   └── ParticipantPool.ts
│   ├── maildir/
│   │   ├── MaildirWriter.ts
│   │   └── FilenameGenerator.ts
│   ├── plugins/
│   │   ├── PluginInterface.ts
│   │   └── StandardEmailPlugin.ts
│   ├── validation/
│   │   ├── MessageValidator.ts
│   │   └── MaildirValidator.ts
│   └── utils/
│       ├── dates.ts
│       └── threading.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── doc/
│   └── RFC/
├── package.json
├── tsconfig.json
├── biome.json
└── vitest.config.ts
```

---

## 10. Implementation Phases

### Phase 1: Core Foundation (Bootstrap)

**Deliverables**:

1. Project setup (TypeScript, Biome, Vitest, TSX)
2. GitHub Actions CI pipeline
3. MailComposer integration for email creation
4. mailparser integration for validation
5. Basic Maildir writer
6. Faker.js integration with seeding

**Validation**:

- Generate single valid email
- Parse with mailparser successfully
- Write to valid Maildir structure

### Phase 2: Generation Engine

**Deliverables**:

1. Participant pool management
2. Message factory with threading
3. Time-based distribution
4. Read/unread probability
5. Plugin interface definition

**Validation**:

- Deterministic output with same seed
- Valid threading chains
- Correct flag distribution

### Phase 3: Standard Plugin

**Deliverables**:

1. StandardEmailPlugin implementation
2. Subject line generation
3. Text body generation
4. HTML body generation
5. Reply/forward content handling

**Validation**:

- Realistic content generation
- Valid HTML structure
- Proper reply quoting

### Phase 4: CLI & Polish

**Deliverables**:

1. CLI implementation (Node.js built-in)
2. Configuration file support
3. Validation command
4. Progress reporting
5. README documentation

**Validation**:

- End-to-end CLI workflow
- Large-scale generation (10k+ messages)
- Performance benchmarks

---

## 11. Success Criteria

1. **Compliance**: 100% of generated emails parse successfully with mailparser
2. **Determinism**: Same seed produces byte-identical output
3. **Performance**: Generate 1000 messages in under 10 seconds
4. **Maildir Compliance**: Output readable by Dovecot/Courier
5. **Test Coverage**: >80% code coverage
6. **Documentation**: Complete README with examples

---

## 12. References

- [RFC 2822 - Internet Message Format](https://tools.ietf.org/html/rfc2822)
- [Maildir Specification](https://cr.yp.to/proto/maildir.html)
- [Maildir++ Extension](https://www.courier-mta.org/imap/README.maildirquota.html)
- [Faker.js Documentation](https://fakerjs.dev/)
- [Nodemailer MailComposer](https://nodemailer.com/extras/mailcomposer)
- [mailparser Documentation](https://nodemailer.com/extras/mailparser)

---

## Appendix A: Example Generated Email

```
From: John Smith <john.smith@example.com>
To: Jane Doe <jane.doe@example.net>
Subject: Re: Project update for Q1
Date: Sat, 18 Jan 2026 14:32:00 +0000
Message-ID: <1737210720.M123456P789.localhost@mailfuzz>
In-Reply-To: <1737124320.M654321P456.localhost@mailfuzz>
References: <1737124320.M654321P456.localhost@mailfuzz>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="----=_Part_0"

------=_Part_0
Content-Type: text/plain; charset=utf-8

Thanks for the update, Jane.

I'll review the documents and get back to you by Monday.

Best,
John

------=_Part_0
Content-Type: text/html; charset=utf-8

<html>
<body>
<p>Thanks for the update, Jane.</p>
<p>I'll review the documents and get back to you by Monday.</p>
<p>Best,<br>John</p>
</body>
</html>

------=_Part_0--
```

---

## Appendix B: Maildir Filename Examples

```
# New unread message
new/1737210720.M123456P789V801Ia1b2c3.localhost,S=2048

# Read message (Seen flag)
cur/1737124320.M654321P456V801Ib2c3d4.localhost,S=4096:2,S

# Replied and seen message
cur/1737037920.M111111P123V801Ic3d4e5.localhost,S=3072:2,RS

# Flagged, replied, and seen
cur/1736951520.M222222P456V801Id4e5f6.localhost,S=5120:2,FRS
```
