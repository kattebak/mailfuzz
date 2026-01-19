# RFC-002: Mailfuzz Plugin Architecture

> **Status**: Draft  
> **Created**: 2026-01-18  
> **Author**: Mailfuzz Team  
> **Depends On**: RFC-001

---

## Abstract

This RFC defines the plugin architecture for Mailfuzz, focusing on how plugins declare their capabilities and how the core engine uses these declarations to make intelligent content generation decisions. The capability system enables plugins to specify what types of email contexts they can handle (replies, forwards, attachments, HTML) while allowing the core engine to respect these constraints during generation.

---

## 1. Motivation

### 1.1 The Problem

Different types of emails have different characteristics:

| Email Type              | Can Be Reply? | Can Be Forward? | Example               |
| ----------------------- | ------------- | --------------- | --------------------- |
| Personal correspondence | ✅ Yes        | ✅ Yes          | "Thanks for dinner!"  |
| Marketing newsletter    | ❌ No         | ❌ No           | "50% off sale today!" |
| System notification     | ❌ No         | ✅ Yes          | "Your order shipped"  |
| Calendar invitation     | ❌ No         | ✅ Yes          | "Meeting invite"      |

A marketing email appearing as a reply to a personal conversation would be unrealistic:

```
From: jane@example.com
Subject: Re: Dinner plans for Saturday

Hey, just wanted to confirm we're still on for 7pm!

---
From: newsletter@store.com
Subject: Re: Re: Dinner plans for Saturday

🎉 MEGA SALE! 50% OFF EVERYTHING! 🎉
```

This is clearly wrong. The plugin must be able to declare "I cannot generate reply content."

### 1.2 Design Goals

1. **Declarative Capabilities**: Plugins declare what they can do, not how the engine should use them
2. **Engine-Controlled Selection**: The core engine decides which plugin to use based on context
3. **Graceful Constraints**: When a plugin can't fulfill a request, the engine selects an alternative
4. **Extensibility**: New capabilities can be added without breaking existing plugins

---

## 2. Plugin Interface

### 2.1 Core Interface

```typescript
/**
 * Base interface for all Mailfuzz email generation plugins.
 */
interface EmailPlugin {
  /**
   * Unique identifier for this plugin.
   * Used for configuration, weighting, and logging.
   * Must be lowercase alphanumeric with hyphens.
   * @example "standard", "marketing", "calendar-invite"
   */
  readonly id: string;

  /**
   * Human-readable display name.
   * @example "Standard Email", "Marketing Newsletter"
   */
  readonly name: string;

  /**
   * Declares what this plugin can and cannot do.
   * The engine uses these to filter plugins for each generation context.
   */
  readonly capabilities: PluginCapabilities;

  /**
   * Optional plugin-specific configuration schema.
   * Validated at registration time.
   */
  readonly configSchema?: ZodSchema;

  /**
   * Generate email content for the given context.
   * Called only when capabilities match the context requirements.
   */
  generate(context: GenerationContext): EmailContent | Promise<EmailContent>;
}
```

### 2.2 Capability Declaration

```typescript
/**
 * Declares what types of email content a plugin can generate.
 * All capabilities default to `false` if not specified.
 */
interface PluginCapabilities {
  /**
   * Can this plugin generate content for a reply email?
   *
   * When `true`: Plugin will receive `isReply: true` contexts and must
   * generate appropriate reply content (e.g., "Thanks for your message...")
   *
   * When `false`: Plugin will never be selected for reply contexts.
   *
   * @example Marketing plugins should set this to `false`
   */
  canBeReply: boolean;

  /**
   * Can this plugin generate content for a forwarded email?
   *
   * When `true`: Plugin will receive `isForward: true` contexts and must
   * generate appropriate forwarding content (e.g., "FYI, see below...")
   *
   * When `false`: Plugin will never be selected for forward contexts.
   */
  canBeForward: boolean;

  /**
   * Can this plugin generate HTML content?
   *
   * When `true`: The `generate()` return value MAY include an `html` field.
   * When `false`: The engine will not request HTML from this plugin.
   *
   * Note: Plugins with `supportsHtml: true` MUST still provide `text` content
   * as a fallback for plain-text email clients.
   */
  supportsHtml: boolean;

  /**
   * Can this plugin generate emails with attachments?
   *
   * When `true`: The `generate()` return value MAY include `attachments`.
   * When `false`: The engine will not expect attachments from this plugin.
   */
  supportsAttachments: boolean;

  /**
   * Can this plugin generate a new/original email (not reply or forward)?
   *
   * When `true`: Plugin can generate original conversation starters.
   * When `false`: Plugin can only generate replies or forwards.
   *
   * @default true (most plugins can generate original emails)
   */
  canBeOriginal?: boolean;

  /**
   * Can this plugin generate content for multi-recipient emails?
   *
   * When `true`: Plugin may be used for emails with multiple To/Cc recipients.
   * When `false`: Plugin only generates 1:1 correspondence.
   *
   * @default true
   */
  supportsMultipleRecipients?: boolean;
}
```

---

## 3. Capability Semantics

### 3.1 Capability Matrix

| Capability                   | When `true`                           | When `false`                       |
| ---------------------------- | ------------------------------------- | ---------------------------------- |
| `canBeReply`                 | Engine may select for reply context   | Never selected for replies         |
| `canBeForward`               | Engine may select for forward context | Never selected for forwards        |
| `canBeOriginal`              | Engine may select for new threads     | Only used for replies/forwards     |
| `supportsHtml`               | May return `html` in content          | Engine ignores any `html` returned |
| `supportsAttachments`        | May return `attachments`              | Engine ignores any `attachments`   |
| `supportsMultipleRecipients` | Used for group emails                 | Only 1:1 emails                    |

### 3.2 Capability Combinations

Common plugin archetypes:

```typescript
// Personal/Business correspondence - can do everything
const standardCapabilities: PluginCapabilities = {
  canBeReply: true,
  canBeForward: true,
  canBeOriginal: true,
  supportsHtml: true,
  supportsAttachments: true,
  supportsMultipleRecipients: true,
};

// Marketing newsletter - never a reply, always original
const marketingCapabilities: PluginCapabilities = {
  canBeReply: false,
  canBeForward: false,
  canBeOriginal: true,
  supportsHtml: true,
  supportsAttachments: false,
  supportsMultipleRecipients: false, // Always looks 1:1
};

// System notification - never a reply, can be forwarded
const notificationCapabilities: PluginCapabilities = {
  canBeReply: false,
  canBeForward: true, // User might forward "Your package shipped"
  canBeOriginal: true,
  supportsHtml: true,
  supportsAttachments: false,
  supportsMultipleRecipients: false,
};

// Reply-only plugin (e.g., auto-responder simulator)
const autoResponderCapabilities: PluginCapabilities = {
  canBeReply: true,
  canBeForward: false,
  canBeOriginal: false, // Only generates replies
  supportsHtml: false,
  supportsAttachments: false,
  supportsMultipleRecipients: false,
};
```

### 3.3 Invalid Capability Combinations

The engine validates capability declarations at plugin registration:

```typescript
// ERROR: Plugin must be able to generate at least one email type
const invalidCapabilities: PluginCapabilities = {
  canBeReply: false,
  canBeForward: false,
  canBeOriginal: false, // ❌ Nothing this plugin can do!
  // ...
};
```

---

## 4. Generation Context

### 4.1 Context Interface

When the engine calls a plugin's `generate()` method, it provides full context:

```typescript
interface GenerationContext {
  /**
   * Seeded Faker instance for deterministic generation.
   * All random values MUST come from this instance.
   */
  faker: Faker;

  /**
   * Is the engine requesting reply content?
   * Only `true` if plugin declared `canBeReply: true`.
   */
  isReply: boolean;

  /**
   * Is the engine requesting forward content?
   * Only `true` if plugin declared `canBeForward: true`.
   */
  isForward: boolean;

  /**
   * Should the plugin generate HTML content?
   * Only `true` if plugin declared `supportsHtml: true`.
   */
  requestHtml: boolean;

  /**
   * The parent message when `isReply` or `isForward` is true.
   * Contains subject, sender, date, and body excerpt for context.
   */
  parentMessage?: ParentMessageContext;

  /**
   * Participants available for this email.
   * Plugin should use these for realistic addressing.
   */
  participants: Participant[];

  /**
   * The selected sender for this email.
   */
  sender: Participant;

  /**
   * The selected recipients for this email.
   */
  recipients: Participant[];

  /**
   * Plugin-specific configuration from user config.
   */
  pluginConfig?: Record<string, unknown>;
}

interface ParentMessageContext {
  /** Original message subject */
  subject: string;

  /** Original message sender */
  from: Participant;

  /** Original message date */
  date: Date;

  /** Body excerpt for quoting (first ~500 chars) */
  bodyExcerpt: string;

  /** Message-ID for threading headers */
  messageId: string;
}
```

### 4.2 Context Guarantees

The engine provides these guarantees:

| If Plugin Declared     | Engine Guarantees                              |
| ---------------------- | ---------------------------------------------- |
| `canBeReply: false`    | `context.isReply` will never be `true`         |
| `canBeForward: false`  | `context.isForward` will never be `true`       |
| `canBeOriginal: false` | Either `isReply` or `isForward` will be `true` |
| `supportsHtml: false`  | `context.requestHtml` will be `false`          |

---

## 5. Plugin Output

### 5.1 Email Content Interface

```typescript
interface EmailContent {
  /**
   * Email subject line.
   * For replies, should typically start with "Re: "
   * For forwards, should typically start with "Fwd: "
   */
  subject: string;

  /**
   * Plain text body content.
   * REQUIRED - always provide text version.
   */
  text: string;

  /**
   * HTML body content.
   * Only returned if `supportsHtml: true` and `context.requestHtml: true`.
   */
  html?: string;

  /**
   * Email attachments.
   * Only returned if `supportsAttachments: true`.
   */
  attachments?: Attachment[];

  /**
   * Optional custom headers.
   * Merged with engine-generated headers (engine headers take precedence).
   */
  headers?: Record<string, string>;
}

interface Attachment {
  /** Filename shown to recipient */
  filename: string;

  /** MIME content type */
  contentType: string;

  /** Raw content as Buffer */
  content: Buffer;

  /** Content-ID for inline images (cid:) */
  cid?: string;
}
```

### 5.2 Reply Content Guidelines

When `isReply: true`, plugins should:

1. Generate contextual response to `parentMessage.bodyExcerpt`
2. Use "Re: " prefix on subject (or continue existing Re: chain)
3. Optionally include quoted text

```typescript
function generateReply(context: GenerationContext): EmailContent {
  const { parentMessage, faker } = context;

  const greeting = faker.helpers.arrayElement([
    `Thanks for your email, ${parentMessage.from.firstName}.`,
    `Good point about that.`,
    `I see what you mean.`,
  ]);

  return {
    subject: parentMessage.subject.startsWith("Re:")
      ? parentMessage.subject
      : `Re: ${parentMessage.subject}`,
    text: `${greeting}\n\n${faker.lorem.paragraph()}\n\nBest,\n${context.sender.firstName}`,
  };
}
```

### 5.3 Forward Content Guidelines

When `isForward: true`, plugins should:

1. Generate brief introduction
2. Use "Fwd: " prefix on subject
3. Include forwarded content marker

```typescript
function generateForward(context: GenerationContext): EmailContent {
  const { parentMessage, faker } = context;

  const intro = faker.helpers.arrayElement([
    "FYI",
    "Thought you might find this interesting.",
    "Forwarding this along.",
  ]);

  return {
    subject: `Fwd: ${parentMessage.subject.replace(/^Fwd:\s*/i, "")}`,
    text: `${intro}\n\n---------- Forwarded message ----------\nFrom: ${parentMessage.from.email}\nDate: ${parentMessage.date.toISOString()}\nSubject: ${parentMessage.subject}\n\n${parentMessage.bodyExcerpt}`,
  };
}
```

---

## 6. Plugin Selection Algorithm

### 6.1 Selection Flow

```
┌─────────────────────────────────────────────────────┐
│                   Generate Email                    │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  Determine email type (original/reply/forward)      │
│  based on conversation state and probabilities      │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  Filter plugins by required capability:             │
│  - isReply=true  → filter by canBeReply             │
│  - isForward=true → filter by canBeForward          │
│  - else          → filter by canBeOriginal          │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  Apply additional filters if needed:                │
│  - Multi-recipient → supportsMultipleRecipients     │
│  - HTML requested  → supportsHtml (soft filter)     │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  Select plugin from filtered set using:             │
│  - Configured weights (normalized for filtered set) │
│  - Seeded random selection                          │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  Call plugin.generate(context)                      │
└─────────────────────────────────────────────────────┘
```

### 6.2 Weight Normalization

When plugins are filtered by capability, weights are renormalized:

```typescript
// Configuration
plugins: {
  enabled: ['standard', 'marketing', 'notification'],
  weights: {
    standard: 0.6,
    marketing: 0.3,
    notification: 0.1,
  }
}

// For a REPLY email, marketing and notification are filtered out
// Only 'standard' remains, so it gets 100% selection probability

// For an ORIGINAL email, all three are available
// Weights: standard=60%, marketing=30%, notification=10%
```

### 6.3 Fallback Behavior

If no plugins match the required capabilities:

```typescript
// Scenario: Engine wants a reply, but only marketing plugin is registered
// marketing.capabilities.canBeReply = false

// Fallback strategy:
// 1. Convert reply request to original email
// 2. Log warning about capability mismatch
// 3. Continue generation with available plugin
```

---

## 7. Plugin Registration

### 7.1 Registration API

```typescript
const generator = new MailfuzzGenerator({
  plugins: [
    new StandardEmailPlugin(),
    new MarketingEmailPlugin({ brandName: "Acme Corp" }),
  ],
  pluginWeights: {
    standard: 0.7,
    marketing: 0.3,
  },
});

// Or register after construction
generator.registerPlugin(new NotificationPlugin());
generator.setPluginWeight("notification", 0.1);
```

### 7.2 Validation at Registration

```typescript
class MailfuzzGenerator {
  registerPlugin(plugin: EmailPlugin): void {
    // Validate plugin ID format
    if (!/^[a-z][a-z0-9-]*$/.test(plugin.id)) {
      throw new Error(`Invalid plugin ID: ${plugin.id}`);
    }

    // Validate capability sanity
    const caps = plugin.capabilities;
    if (!caps.canBeReply && !caps.canBeForward && !caps.canBeOriginal) {
      throw new Error(`Plugin ${plugin.id} has no usable capabilities`);
    }

    // Validate no duplicate IDs
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }

    this.plugins.set(plugin.id, plugin);
  }
}
```

---

## 8. Example Plugin Implementation

### 8.1 Complete Standard Plugin

```typescript
import type {
  EmailPlugin,
  PluginCapabilities,
  GenerationContext,
  EmailContent,
} from "mailfuzz";

export class StandardEmailPlugin implements EmailPlugin {
  readonly id = "standard";
  readonly name = "Standard Email";

  readonly capabilities: PluginCapabilities = {
    canBeReply: true,
    canBeForward: true,
    canBeOriginal: true,
    supportsHtml: true,
    supportsAttachments: false,
    supportsMultipleRecipients: true,
  };

  generate(context: GenerationContext): EmailContent {
    const { faker, isReply, isForward, parentMessage, sender } = context;

    if (isReply && parentMessage) {
      return this.generateReply(context);
    }

    if (isForward && parentMessage) {
      return this.generateForward(context);
    }

    return this.generateOriginal(context);
  }

  private generateOriginal(context: GenerationContext): EmailContent {
    const { faker, sender, recipients, requestHtml } = context;

    const subject = faker.helpers.arrayElement([
      `Quick question about ${faker.company.buzzNoun()}`,
      `Following up on our ${faker.word.noun()}`,
      `${faker.company.catchPhrase()}`,
      `Meeting ${faker.date.weekday()}?`,
    ]);

    const greeting = `Hi ${recipients[0].firstName},`;
    const body = faker.lorem.paragraphs({ min: 1, max: 3 });
    const signoff = faker.helpers.arrayElement([
      "Best",
      "Thanks",
      "Cheers",
      "Regards",
    ]);

    const text = `${greeting}\n\n${body}\n\n${signoff},\n${sender.firstName}`;

    const result: EmailContent = { subject, text };

    if (requestHtml) {
      result.html = `
        <p>${greeting}</p>
        ${body
          .split("\n\n")
          .map((p) => `<p>${p}</p>`)
          .join("\n")}
        <p>${signoff},<br>${sender.firstName}</p>
      `;
    }

    return result;
  }

  private generateReply(context: GenerationContext): EmailContent {
    const { faker, sender, parentMessage } = context;

    const response = faker.helpers.arrayElement([
      `Thanks for reaching out.`,
      `Good point.`,
      `I'll look into that.`,
      `Sounds good to me.`,
    ]);

    const text = `${response}\n\n${faker.lorem.paragraph()}\n\nBest,\n${sender.firstName}`;

    return {
      subject: parentMessage!.subject.startsWith("Re:")
        ? parentMessage!.subject
        : `Re: ${parentMessage!.subject}`,
      text,
    };
  }

  private generateForward(context: GenerationContext): EmailContent {
    const { faker, parentMessage } = context;

    const intro = faker.helpers.arrayElement([
      "FYI",
      "Thought you should see this.",
      "Forwarding along.",
    ]);

    return {
      subject: `Fwd: ${parentMessage!.subject.replace(/^Fwd:\s*/i, "")}`,
      text: `${intro}\n\n---------- Forwarded message ----------\n${parentMessage!.bodyExcerpt}`,
    };
  }
}
```

### 8.2 Complete Marketing Plugin

```typescript
import type {
  EmailPlugin,
  PluginCapabilities,
  GenerationContext,
  EmailContent,
} from "mailfuzz";
import { z } from "zod";

export class MarketingEmailPlugin implements EmailPlugin {
  readonly id = "marketing";
  readonly name = "Marketing Newsletter";

  // Marketing emails are NEVER replies or forwards
  readonly capabilities: PluginCapabilities = {
    canBeReply: false, // ← Key constraint
    canBeForward: false, // ← Key constraint
    canBeOriginal: true,
    supportsHtml: true,
    supportsAttachments: false,
    supportsMultipleRecipients: false,
  };

  readonly configSchema = z.object({
    brandName: z.string().optional(),
    unsubscribeUrl: z.string().url().optional(),
  });

  private config: z.infer<typeof this.configSchema>;

  constructor(config: z.infer<typeof this.configSchema> = {}) {
    this.config = this.configSchema.parse(config);
  }

  generate(context: GenerationContext): EmailContent {
    const { faker, requestHtml } = context;

    const brandName = this.config.brandName ?? faker.company.name();
    const discount = faker.helpers.arrayElement(["15%", "20%", "25%", "50%"]);

    const subject = faker.helpers.arrayElement([
      `🎉 ${discount} off everything at ${brandName}!`,
      `Don't miss out! ${discount} off ends soon`,
      `Exclusive offer just for you`,
      `${brandName} Weekly Newsletter`,
    ]);

    const text = `
${brandName} Newsletter

Get ${discount} off your next order!

Shop now at ${faker.internet.url()}

---
To unsubscribe, click here: ${this.config.unsubscribeUrl ?? faker.internet.url()}
    `.trim();

    const result: EmailContent = { subject, text };

    if (requestHtml) {
      result.html = `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h1 style="color: #333;">${brandName}</h1>
          <p style="font-size: 24px; color: #e74c3c;">🎉 ${discount} OFF!</p>
          <p>${faker.lorem.paragraph()}</p>
          <a href="${faker.internet.url()}" style="display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 4px;">Shop Now</a>
          <hr>
          <p style="font-size: 12px; color: #999;">
            <a href="${this.config.unsubscribeUrl ?? faker.internet.url()}">Unsubscribe</a>
          </p>
        </div>
      `;
    }

    return result;
  }
}
```

---

## 9. Testing Plugins

### 9.1 Capability Verification

```typescript
import { describe, it, expect } from "vitest";
import { MarketingEmailPlugin } from "./MarketingEmailPlugin";

describe("MarketingEmailPlugin", () => {
  describe("capabilities", () => {
    const plugin = new MarketingEmailPlugin();

    it("declares it cannot be a reply", () => {
      expect(plugin.capabilities.canBeReply).toBe(false);
    });

    it("declares it cannot be a forward", () => {
      expect(plugin.capabilities.canBeForward).toBe(false);
    });

    it("declares it can generate original emails", () => {
      expect(plugin.capabilities.canBeOriginal).toBe(true);
    });
  });

  describe("generate", () => {
    it("never receives isReply=true context", () => {
      // This is guaranteed by the engine, but we can verify
      // the plugin doesn't break if somehow called incorrectly
      const plugin = new MarketingEmailPlugin();
      const context = createMockContext({ isReply: true });

      // Should still generate something, not crash
      const content = plugin.generate(context);
      expect(content.subject).toBeDefined();
    });
  });
});
```

---

## 10. Future Capability Extensions

Reserved capability names for future expansion:

| Capability            | Purpose                           |
| --------------------- | --------------------------------- |
| `supportsIcal`        | Calendar invitation generation    |
| `supportsPgp`         | Encrypted content generation      |
| `supportsReadReceipt` | Disposition notification requests |
| `supportsThreading`   | Complex multi-message threads     |
| `localeLimited`       | Only works with specific locales  |

These are NOT implemented in v1 but reserved to prevent naming conflicts.

---

## Addendum A: Plugin Weight Distribution

### A.1 Motivation

Different email types occur with different frequencies in real mailboxes. Marketing emails might comprise 25% of a typical inbox, while calendar invitations are relatively rare. To generate realistic mailbox distributions, plugins must declare their expected statistical occurrence, and users must be able to override these defaults.

### A.2 Default Weight Declaration

Each plugin declares a default weight representing its expected frequency in a typical mailbox:

```typescript
interface EmailPlugin {
  // ... existing properties ...

  /**
   * Default weight for this plugin in the generation distribution.
   *
   * This represents the plugin's expected frequency relative to other plugins.
   * The actual probability is calculated by normalizing all active plugin weights.
   *
   * Guidelines:
   * - 1.0 = baseline frequency (standard correspondence)
   * - 0.25 = occurs ~25% as often as baseline
   * - 2.0 = occurs twice as often as baseline
   *
   * @default 1.0
   */
  readonly defaultWeight: number;
}
```

### A.3 Weight Semantics

Weights are relative values, not absolute percentages. The engine normalizes weights across all active plugins:

```typescript
// Plugin declarations
StandardEmailPlugin.defaultWeight = 1.0; // Baseline
MarketingEmailPlugin.defaultWeight = 0.5; // Half as common as standard
NotificationPlugin.defaultWeight = 0.2; // Less common
CalendarPlugin.defaultWeight = 0.1; // Rare

// Normalization calculation
// Total weight = 1.0 + 0.5 + 0.2 + 0.1 = 1.8
//
// Resulting probabilities:
// - standard:     1.0 / 1.8 = 55.6%
// - marketing:    0.5 / 1.8 = 27.8%
// - notification: 0.2 / 1.8 = 11.1%
// - calendar:     0.1 / 1.8 =  5.6%
```

### A.4 User Weight Overrides

Users can override plugin weights via configuration to customize the distribution:

```typescript
interface MailfuzzConfig {
  plugins: {
    /**
     * Override default weights for specific plugins.
     *
     * Values are relative weights, same semantics as defaultWeight.
     * Omitted plugins use their defaultWeight.
     * Set to 0 to disable a plugin without unregistering it.
     */
    weights?: Record<string, number>;
  };
}

// Example: User wants lots of marketing spam
const config: MailfuzzConfig = {
  plugins: {
    weights: {
      marketing: 2.0, // Override: 4x the default (0.5 → 2.0)
      standard: 0.5, // Override: reduce standard emails
      // notification and calendar use defaults
    },
  },
};
```

### A.5 Weight Resolution

The engine resolves effective weights with this priority:

1. **User override** (from config) takes precedence
2. **Plugin default** (from `defaultWeight`) is used otherwise
3. **Fallback** to `1.0` if neither is specified

```typescript
function resolveWeight(
  pluginId: string,
  plugin: EmailPlugin,
  config: MailfuzzConfig,
): number {
  // User override takes precedence
  const userWeight = config.plugins?.weights?.[pluginId];
  if (userWeight !== undefined) {
    return userWeight;
  }

  // Plugin default
  if (plugin.defaultWeight !== undefined) {
    return plugin.defaultWeight;
  }

  // Fallback
  return 1.0;
}
```

### A.6 Recommended Default Weights

Guidelines for plugin authors:

| Plugin Type          | Recommended Weight | Rationale                              |
| -------------------- | ------------------ | -------------------------------------- |
| Standard/Personal    | 1.0                | Baseline for all other weights         |
| Marketing/Newsletter | 0.4 - 0.6          | Common but not dominant (~25% of mail) |
| System Notification  | 0.2 - 0.3          | Regular but less frequent              |
| Calendar Invitation  | 0.1 - 0.15         | Occasional                             |
| Shipping/Order       | 0.15 - 0.2         | Depends on e-commerce activity         |
| Social Notification  | 0.2 - 0.3          | Varies by user behavior                |
| Auto-responder       | 0.05 - 0.1         | Rare                                   |

### A.7 Weight Application with Capabilities

Weights are applied **after** capability filtering. When the engine needs a reply email, only plugins with `canBeReply: true` are considered, and weights are renormalized for that subset:

```typescript
// All plugins with weights
const allWeights = {
  standard: 1.0, // canBeReply: true
  marketing: 0.5, // canBeReply: false
  notification: 0.2, // canBeReply: false
};

// For a REPLY context, only 'standard' qualifies
// It receives 100% probability (1.0 / 1.0)

// For an ORIGINAL context, all plugins qualify
// Probabilities: standard=58.8%, marketing=29.4%, notification=11.8%
```

### A.8 Validation Rules

The engine enforces these constraints:

```typescript
function validateWeight(weight: number, pluginId: string): void {
  if (typeof weight !== "number" || !Number.isFinite(weight)) {
    throw new Error(
      `Invalid weight for plugin ${pluginId}: must be a finite number`,
    );
  }

  if (weight < 0) {
    throw new Error(
      `Invalid weight for plugin ${pluginId}: must be non-negative`,
    );
  }

  // Weight of 0 is allowed (disables plugin)
  // Very small weights are allowed (rare occurrences)
}

function validateActivePlugins(
  plugins: Map<string, EmailPlugin>,
  weights: Map<string, number>,
): void {
  const activeWeight = Array.from(plugins.keys()).reduce(
    (sum, id) => sum + (weights.get(id) ?? 1.0),
    0,
  );

  if (activeWeight === 0) {
    throw new Error("At least one plugin must have a non-zero weight");
  }
}
```

### A.9 CLI Weight Override

Users can override weights via CLI for quick testing:

```bash
# Double marketing weight for spam-heavy testing
mailfuzz generate --weight marketing=2.0 --weight standard=0.5

# Disable all but one plugin type
mailfuzz generate --weight standard=0 --weight marketing=0 --weight notification=1
```

### A.10 Example: Weight Configuration

Complete configuration example:

```typescript
import { MailfuzzGenerator } from "mailfuzz";

const generator = new MailfuzzGenerator({
  seed: 42,
  count: 1000,

  plugins: {
    // Register plugins (they declare their own defaultWeight)
    enabled: [
      new StandardEmailPlugin(), // defaultWeight: 1.0
      new MarketingEmailPlugin(), // defaultWeight: 0.5
      new NotificationPlugin(), // defaultWeight: 0.2
      new CalendarPlugin(), // defaultWeight: 0.1
    ],

    // User overrides
    weights: {
      marketing: 1.5, // More marketing spam than typical
      calendar: 0.3, // More calendar invites than typical
      // standard and notification use their defaults
    },
  },
});

// With these weights:
// Total = 1.0 + 1.5 + 0.2 + 0.3 = 3.0
//
// Distribution:
// - standard:     1.0 / 3.0 = 33.3%
// - marketing:    1.5 / 3.0 = 50.0%  (heavy spam!)
// - notification: 0.2 / 3.0 =  6.7%
// - calendar:     0.3 / 3.0 = 10.0%
```

---

## References

- [RFC-001: Mailfuzz Core](./RFC-001-mailfuzz.md)
- [Faker.js Helpers](https://fakerjs.dev/api/helpers.html)
