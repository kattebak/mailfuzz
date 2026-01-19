# RFC-003: Email Type Plugins - Spam, Marketing, and Newsletter

> **Status**: Draft
> **Created**: 2026-01-18
> **Author**: Mailfuzz Team
> **Depends On**: RFC-001, RFC-002

---

## Abstract

This RFC defines the specifications for three email type plugins: **Spam**, **Marketing**, and **Newsletter**. Each plugin generates distinct categories of email content with realistic characteristics, appropriate capabilities, and recommended weight distributions. These plugins extend the core plugin architecture defined in RFC-002 to provide comprehensive mailbox simulation covering both legitimate and unwanted email patterns.

---

## 1. Plugin Overview

### 1.1 Email Type Taxonomy

| Plugin       | Purpose                                    | Legitimacy  | Sender Pattern        |
| ------------ | ------------------------------------------ | ----------- | --------------------- |
| `spam`       | Unsolicited, deceptive, or malicious email | Illegitimate| Random/spoofed domains|
| `marketing`  | Promotional content from businesses        | Legitimate  | Brand domains         |
| `newsletter` | Subscription-based periodic content        | Legitimate  | Publication domains   |

### 1.2 Capability Summary

| Capability                   | Spam   | Marketing | Newsletter |
| ---------------------------- | ------ | --------- | ---------- |
| `canBeReply`                 | false  | false     | false      |
| `canBeForward`               | false  | false     | true       |
| `canBeOriginal`              | true   | true      | true       |
| `supportsHtml`               | true   | true      | true       |
| `supportsAttachments`        | true   | false     | false      |
| `supportsMultipleRecipients` | false  | false     | false      |

### 1.3 Default Weight Distribution

Per Addendum A of RFC-002:

| Plugin       | Default Weight | Expected Distribution | Rationale                          |
| ------------ | -------------- | --------------------- | ---------------------------------- |
| `spam`       | 0.3            | ~15-20%               | Common in unfiltered mailboxes     |
| `marketing`  | 0.5            | ~25-30%               | Frequent promotional emails        |
| `newsletter` | 0.25           | ~12-15%               | Regular but less frequent than ads |

---

## 2. Spam Plugin

### 2.1 Purpose

The Spam plugin generates realistic unsolicited email content for testing spam filters, email parsing robustness, and user interface handling of suspicious messages. Generated content mimics common spam patterns without containing actual malicious payloads.

### 2.2 Plugin Definition

```typescript
import type {
  EmailPlugin,
  PluginCapabilities,
  GenerationContext,
  EmailContent,
} from "mailfuzz";
import { z } from "zod";

export class SpamEmailPlugin implements EmailPlugin {
  readonly id = "spam";
  readonly name = "Spam Email";
  readonly defaultWeight = 0.3;

  readonly capabilities: PluginCapabilities = {
    canBeReply: false,       // Spam never replies to real conversations
    canBeForward: false,     // Spam is not forwarded content
    canBeOriginal: true,     // Always unsolicited original messages
    supportsHtml: true,      // Often uses HTML for formatting tricks
    supportsAttachments: true, // May include suspicious attachments
    supportsMultipleRecipients: false, // Appears personalized to single recipient
  };

  readonly configSchema = z.object({
    /** Include fake attachment references */
    includeAttachments: z.boolean().default(false),
    /** Spam category distribution weights */
    categoryWeights: z.object({
      phishing: z.number().default(0.3),
      scam: z.number().default(0.25),
      pharmaceutical: z.number().default(0.15),
      lottery: z.number().default(0.1),
      adult: z.number().default(0.1),
      malware: z.number().default(0.1),
    }).optional(),
  });

  // ... implementation
}
```

### 2.3 Spam Categories

The plugin generates content across multiple spam archetypes:

#### 2.3.1 Phishing (30%)

Attempts to impersonate legitimate services to harvest credentials.

**Characteristics**:
- Sender appears to be from banks, tech companies, or payment services
- Urgency language: "Your account will be suspended", "Verify immediately"
- Fake login links with suspicious URLs
- Mismatched display names and email addresses

**Example Subject Lines**:
```
"[URGENT] Unusual sign-in activity on your account"
"Your payment could not be processed"
"Action Required: Verify your identity"
"Your account has been compromised"
```

**Example Sender Patterns**:
```
"PayPal Security" <security-alert@paypa1-verify.com>
"Apple Support" <noreply@apple.account-verify.net>
"Amazon" <amazon-orders@amaz0n-delivery.com>
```

#### 2.3.2 Advance Fee Scam (25%)

Classic "Nigerian prince" style scams requesting upfront payments.

**Characteristics**:
- Promises of large monetary rewards
- Requests for personal information or small "processing fees"
- Poor grammar and spelling (intentional, filters out sophisticated victims)
- Elaborate backstories involving inheritance, lottery, or business opportunities

**Example Subject Lines**:
```
"URGENT BUSINESS PROPOSAL"
"You Have Won $5,000,000.00 USD"
"CONFIDENTIAL: Inheritance Notification"
"From the desk of Barrister Mohammed"
```

#### 2.3.3 Pharmaceutical (15%)

Promotes counterfeit medications and supplements.

**Characteristics**:
- Promotes prescription drugs without prescriptions
- Uses misspellings to evade filters: "V1AGRA", "C1ALIS"
- Promises dramatic health improvements
- Links to dubious online pharmacies

**Example Subject Lines**:
```
"Save 80% on your prescriptions"
"The secret doctors don't want you to know"
"Lose 30 pounds in 30 days GUARANTEED"
```

#### 2.3.4 Lottery/Prize (10%)

False claims of lottery winnings or prizes.

**Characteristics**:
- Claims recipient has won despite never entering
- Requests personal information to "claim" prize
- Uses official-sounding organization names
- Includes fake reference numbers

**Example Subject Lines**:
```
"CONGRATULATIONS! You've been selected!"
"Claim your $1,000 Amazon Gift Card"
"You are our lucky winner - Ref: UK/9420X2/68"
```

#### 2.3.5 Adult Content (10%)

Unsolicited adult-themed content.

**Characteristics**:
- Suggestive but not explicit subject lines (for filter testing)
- Claims of local singles or dating matches
- Links to external sites
- Often includes tracking pixels

**Example Subject Lines**:
```
"Someone wants to meet you"
"3 new matches in your area"
"You have unread messages"
```

#### 2.3.6 Malware Delivery (10%)

Emails designed to deliver malicious attachments.

**Characteristics**:
- Claims to contain invoices, shipping notices, or documents
- Attachment references (plugin generates fake attachment metadata, not actual files)
- Urgency to open immediately
- Generic sender names

**Example Subject Lines**:
```
"Invoice #INV-2026-0184 attached"
"Your package could not be delivered"
"SCAN_20260118.pdf"
"RE: Updated contract"
```

### 2.4 Content Generation

#### 2.4.1 Sender Address Generation

Spam senders use domain patterns that mimic legitimate services:

```typescript
interface SpamSenderPatterns {
  /** Typosquatting: paypa1.com, amaz0n.com */
  typosquat: (legitimateDomain: string) => string;

  /** Subdomain abuse: paypal.security-verify.com */
  subdomainAbuse: (brand: string) => string;

  /** Random domains: 8x7k2m.info, verify-account-now.net */
  randomDomain: () => string;

  /** Display name spoofing: "PayPal" <random@sketchy.com> */
  displaySpoof: (brand: string) => { name: string; email: string };
}
```

#### 2.4.2 HTML Tricks

Spam HTML content may include common obfuscation techniques:

```typescript
interface SpamHtmlFeatures {
  /** Invisible text for keyword stuffing */
  hiddenText: boolean;

  /** Tracking pixels */
  trackingPixel: boolean;

  /** Misleading link display text */
  linkMismatch: boolean;

  /** Excessive use of images instead of text */
  imageHeavy: boolean;

  /** Unicode character substitution in visible text */
  unicodeTricks: boolean;
}
```

#### 2.4.3 Attachment Generation

When `includeAttachments` is enabled, the plugin generates attachment metadata:

```typescript
const spamAttachments = [
  { filename: "invoice.pdf.exe", contentType: "application/octet-stream" },
  { filename: "document.docm", contentType: "application/vnd.ms-word.document.macroEnabled.12" },
  { filename: "IMG_2026.jpg.scr", contentType: "application/octet-stream" },
  { filename: "payment_receipt.zip", contentType: "application/zip" },
];
```

**Note**: Actual attachment content is randomly generated bytes, not functional malware.

### 2.5 Example Implementation

```typescript
generate(context: GenerationContext): EmailContent {
  const { faker, requestHtml } = context;

  // Select spam category based on weights
  const category = this.selectCategory(faker);

  switch (category) {
    case "phishing":
      return this.generatePhishing(context);
    case "scam":
      return this.generateScam(context);
    case "pharmaceutical":
      return this.generatePharmaceutical(context);
    case "lottery":
      return this.generateLottery(context);
    case "adult":
      return this.generateAdult(context);
    case "malware":
      return this.generateMalware(context);
  }
}

private generatePhishing(context: GenerationContext): EmailContent {
  const { faker } = context;

  const brand = faker.helpers.arrayElement([
    "PayPal", "Amazon", "Apple", "Netflix", "Microsoft", "Google",
  ]);

  const urgency = faker.helpers.arrayElement([
    "URGENT", "ACTION REQUIRED", "IMPORTANT", "ALERT",
  ]);

  const subject = faker.helpers.arrayElement([
    `[${urgency}] Your ${brand} account has been limited`,
    `${brand}: Unusual sign-in activity detected`,
    `Verify your ${brand} account immediately`,
    `${brand} Security Alert - Action Required`,
  ]);

  const fakeUrl = `https://${brand.toLowerCase()}-verify.${faker.helpers.arrayElement(["net", "info", "co", "click"])}`;

  const text = `
Dear Valued Customer,

We have detected unusual activity on your ${brand} account. To ensure your security, we require you to verify your identity immediately.

Click here to verify: ${fakeUrl}

If you do not verify within 24 hours, your account will be permanently suspended.

${brand} Security Team
  `.trim();

  const result: EmailContent = { subject, text };

  if (context.requestHtml) {
    result.html = this.generatePhishingHtml(brand, fakeUrl, faker);
  }

  return result;
}
```

---

## 3. Marketing Plugin

### 3.1 Purpose

The Marketing plugin generates legitimate promotional email content from fictional brands. Unlike spam, marketing emails represent opted-in commercial communications with proper branding, unsubscribe mechanisms, and professional formatting.

### 3.2 Plugin Definition

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
  readonly name = "Marketing Email";
  readonly defaultWeight = 0.5;

  readonly capabilities: PluginCapabilities = {
    canBeReply: false,       // Marketing is never a reply
    canBeForward: false,     // Rarely forwarded in original form
    canBeOriginal: true,     // Always original promotional content
    supportsHtml: true,      // Heavily relies on HTML formatting
    supportsAttachments: false, // No attachments (links instead)
    supportsMultipleRecipients: false, // Personalized to single recipient
  };

  readonly configSchema = z.object({
    /** Custom brand name for consistency */
    brandName: z.string().optional(),
    /** Industry vertical for content theming */
    industry: z.enum([
      "retail",
      "saas",
      "travel",
      "food",
      "fashion",
      "electronics",
      "fitness",
    ]).optional(),
    /** Include personalization tokens */
    personalized: z.boolean().default(true),
    /** Unsubscribe URL template */
    unsubscribeUrl: z.string().url().optional(),
  });

  // ... implementation
}
```

### 3.3 Marketing Categories

#### 3.3.1 Promotional Sale (35%)

Discount and sale announcements.

**Characteristics**:
- Clear discount percentages or dollar amounts
- Time-limited urgency ("Ends Sunday!", "24 hours only")
- Product imagery placeholders
- Call-to-action buttons

**Example Subject Lines**:
```
"🎉 50% off everything - Today only!"
"Your exclusive 30% discount expires tonight"
"Flash Sale: Up to 70% off select items"
"Black Friday came early - Shop now"
```

#### 3.3.2 Product Announcement (25%)

New product or feature launches.

**Characteristics**:
- Feature highlights and benefits
- Product images or hero shots
- "Learn more" and "Shop now" CTAs
- Social proof elements

**Example Subject Lines**:
```
"Introducing our newest collection"
"Meet the all-new [Product Name]"
"You asked, we listened - New features inside"
"First look: Spring 2026 arrivals"
```

#### 3.3.3 Abandoned Cart (15%)

Reminders about incomplete purchases.

**Characteristics**:
- References specific "items" left in cart
- Often includes discount incentive
- Urgency about limited stock
- Personalized with recipient name

**Example Subject Lines**:
```
"Did you forget something?"
"Your cart is waiting for you"
"Complete your order - 10% off inside"
"Still thinking about it? Here's free shipping"
```

#### 3.3.4 Loyalty/Rewards (15%)

Points updates and member benefits.

**Characteristics**:
- Points balance updates
- Tier status notifications
- Exclusive member offers
- Birthday and anniversary messages

**Example Subject Lines**:
```
"You've earned 500 bonus points!"
"Congrats! You've reached Gold status"
"Happy Birthday! Here's a gift from us"
"Your rewards are about to expire"
```

#### 3.3.5 Re-engagement (10%)

Win-back campaigns for inactive customers.

**Characteristics**:
- "We miss you" messaging
- Special comeback offer
- Highlights of what's new
- Easy return path

**Example Subject Lines**:
```
"We miss you! Come back for 25% off"
"It's been a while - See what's new"
"Is this goodbye? One last offer inside"
"A lot has changed since you left"
```

### 3.4 Content Generation

#### 3.4.1 Brand Generation

When no brand is configured, the plugin generates consistent fictional brands:

```typescript
interface GeneratedBrand {
  name: string;           // "Luxe & Co.", "TechVibe", "FreshStart"
  tagline: string;        // "Elevate Your Everyday"
  domain: string;         // "luxeandco.com"
  industry: Industry;     // "fashion"
  primaryColor: string;   // "#1a365d"
  logoPlaceholder: string; // "[LOGO]"
}

function generateBrand(faker: Faker): GeneratedBrand {
  const industry = faker.helpers.arrayElement([
    "retail", "saas", "travel", "food", "fashion", "electronics", "fitness"
  ]);

  const namePatterns = {
    retail: () => `${faker.word.adjective()} ${faker.word.noun()}`,
    fashion: () => `${faker.person.lastName()} & Co.`,
    saas: () => `${faker.hacker.verb()}${faker.hacker.noun()}`.replace(/\s/g, ""),
    // ... other patterns
  };

  const name = namePatterns[industry]();

  return {
    name,
    tagline: faker.company.catchPhrase(),
    domain: `${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
    industry,
    primaryColor: faker.color.rgb(),
    logoPlaceholder: `[${name.toUpperCase()} LOGO]`,
  };
}
```

#### 3.4.2 HTML Structure

Marketing emails follow a consistent professional structure:

```html
<!-- Preheader text (preview text in email clients) -->
<span style="display:none;">Preview text goes here...</span>

<table width="600" align="center">
  <!-- Header with logo -->
  <tr>
    <td style="text-align:center;padding:20px;">
      [BRAND LOGO]
    </td>
  </tr>

  <!-- Hero section -->
  <tr>
    <td style="background:#f0f0f0;padding:40px;text-align:center;">
      <h1>Headline Here</h1>
      <p>Supporting copy</p>
      <a href="#" style="display:inline-block;padding:12px 24px;background:#007bff;color:white;">
        Shop Now
      </a>
    </td>
  </tr>

  <!-- Content section -->
  <tr>
    <td style="padding:20px;">
      <!-- Product grid or content -->
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#333;color:#fff;padding:20px;font-size:12px;">
      <p>© 2026 Brand Name. All rights reserved.</p>
      <p><a href="#">Unsubscribe</a> | <a href="#">Preferences</a></p>
      <p>123 Business St, City, ST 12345</p>
    </td>
  </tr>
</table>
```

#### 3.4.3 Personalization Tokens

When `personalized: true`, content includes recipient-specific elements:

```typescript
interface PersonalizationTokens {
  firstName: string;      // "Hi Sarah,"
  lastName: string;       // "Dear Ms. Johnson,"
  loyaltyPoints: number;  // "You have 2,450 points"
  memberSince: Date;      // "Member since 2023"
  lastPurchase: string;   // "Based on your recent purchase of..."
  recommendedItems: string[]; // Product recommendations
}
```

### 3.5 Compliance Elements

All marketing emails include required compliance elements:

```typescript
interface ComplianceElements {
  /** CAN-SPAM compliant physical address */
  physicalAddress: string;

  /** Functional unsubscribe link */
  unsubscribeLink: string;

  /** Sender identification */
  senderIdentification: string;

  /** Opt-out instructions */
  optOutText: string;
}

function generateCompliance(faker: Faker, brand: GeneratedBrand): ComplianceElements {
  return {
    physicalAddress: `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state()} ${faker.location.zipCode()}`,
    unsubscribeLink: `https://${brand.domain}/unsubscribe?token=${faker.string.alphanumeric(32)}`,
    senderIdentification: `This email was sent by ${brand.name}`,
    optOutText: "To stop receiving these emails, click the unsubscribe link below.",
  };
}
```

---

## 4. Newsletter Plugin

### 4.1 Purpose

The Newsletter plugin generates subscription-based content emails that deliver curated information, articles, or updates on a regular cadence. Unlike marketing emails focused on sales, newsletters provide value through content.

### 4.2 Plugin Definition

```typescript
import type {
  EmailPlugin,
  PluginCapabilities,
  GenerationContext,
  EmailContent,
} from "mailfuzz";
import { z } from "zod";

export class NewsletterEmailPlugin implements EmailPlugin {
  readonly id = "newsletter";
  readonly name = "Newsletter Email";
  readonly defaultWeight = 0.25;

  readonly capabilities: PluginCapabilities = {
    canBeReply: false,       // Newsletters don't reply
    canBeForward: true,      // Users often forward interesting newsletters
    canBeOriginal: true,     // Original publication content
    supportsHtml: true,      // Rich content formatting
    supportsAttachments: false, // Links to content, no attachments
    supportsMultipleRecipients: false, // Individual subscriptions
  };

  readonly configSchema = z.object({
    /** Newsletter publication name */
    publicationName: z.string().optional(),
    /** Content category */
    category: z.enum([
      "tech",
      "business",
      "lifestyle",
      "news",
      "science",
      "creative",
      "finance",
    ]).optional(),
    /** Issue numbering format */
    issueFormat: z.enum(["number", "date", "both"]).default("both"),
    /** Include table of contents */
    includeToc: z.boolean().default(true),
  });

  // ... implementation
}
```

### 4.3 Newsletter Categories

#### 4.3.1 Tech/Developer (25%)

Technology news, tutorials, and industry updates.

**Characteristics**:
- Code snippets and technical content
- Tool and library announcements
- Industry analysis and opinions
- Job postings and community events

**Example Publications**:
```
"The Weekly Stack" - Web development news
"DevOps Digest" - Infrastructure and deployment
"AI Insider" - Machine learning and AI developments
"Security Brief" - Cybersecurity updates
```

**Example Subject Lines**:
```
"The Weekly Stack #147: React 20 is here"
"DevOps Digest: Issue 89 - Kubernetes best practices"
"[AI Insider] GPT-5 announced, plus 3 papers you should read"
```

#### 4.3.2 Business/Startup (20%)

Entrepreneurship, markets, and business strategy.

**Characteristics**:
- Funding announcements and market analysis
- Startup stories and founder interviews
- Industry trends and forecasts
- Business tools and productivity tips

**Example Publications**:
```
"The Hustle Daily" - Business news with personality
"Startup Roundup" - Weekly funding and launches
"Market Pulse" - Financial market analysis
```

#### 4.3.3 Curated Links (20%)

Collections of interesting content from around the web.

**Characteristics**:
- 5-10 curated links with brief descriptions
- Editor commentary and recommendations
- Categories or themes per issue
- Reader submissions

**Example Publications**:
```
"The Sunday Reader" - Weekly best articles
"Links Worth Your Time" - Daily curation
"The Overflow" - Fascinating finds
```

#### 4.3.4 Industry/Niche (20%)

Specialized content for specific industries or interests.

**Characteristics**:
- Deep expertise in narrow domain
- Industry-specific news and analysis
- Event and conference coverage
- Expert interviews and case studies

**Example Publications**:
```
"Healthcare Weekly" - Medical industry news
"Sustainability Now" - Environmental business news
"Remote Work Report" - Distributed team insights
```

#### 4.3.5 Personal/Creator (15%)

Individual creator newsletters with essays and personal content.

**Characteristics**:
- Personal voice and perspective
- Long-form essays or short updates
- Behind-the-scenes content
- Direct reader engagement

**Example Subject Lines**:
```
"Some thoughts on quitting my job"
"What I learned this month"
"Issue #52: The art of saying no"
"Quick update + an announcement"
```

### 4.4 Content Generation

#### 4.4.1 Publication Generation

When no publication is configured, the plugin generates consistent fictional newsletters:

```typescript
interface GeneratedPublication {
  name: string;           // "The Morning Byte"
  tagline: string;        // "Your daily dose of tech news"
  category: Category;     // "tech"
  frequency: Frequency;   // "daily" | "weekly" | "monthly"
  authorName: string;     // "Sarah Chen"
  authorTitle: string;    // "Editor-in-Chief"
  domain: string;         // "morningbyte.io"
  issueNumber: number;    // 147
}
```

#### 4.4.2 Section Structure

Newsletters follow a consistent section-based structure:

```typescript
interface NewsletterSection {
  /** Section heading */
  title: string;

  /** Section content type */
  type: "intro" | "article" | "links" | "sponsor" | "outro";

  /** Section content */
  content: string | ArticleContent | LinkItem[];
}

interface ArticleContent {
  headline: string;
  summary: string;
  body: string;
  readMoreUrl: string;
}

interface LinkItem {
  title: string;
  description: string;
  url: string;
  source?: string;
}
```

**Example Structure**:
```typescript
const sections: NewsletterSection[] = [
  {
    title: "Welcome",
    type: "intro",
    content: "Happy Friday! Here's your weekly roundup of the most interesting things happening in tech...",
  },
  {
    title: "Top Story",
    type: "article",
    content: {
      headline: "Major Framework Announces v5.0",
      summary: "The popular framework just dropped a major update...",
      body: "Lorem ipsum...",
      readMoreUrl: "https://example.com/article",
    },
  },
  {
    title: "Worth Your Time",
    type: "links",
    content: [
      { title: "How to Build Better APIs", description: "A comprehensive guide...", url: "..." },
      { title: "The Future of Remote Work", description: "New research shows...", url: "..." },
    ],
  },
  {
    title: "From Our Sponsor",
    type: "sponsor",
    content: "This week's newsletter is brought to you by...",
  },
  {
    title: "Until Next Time",
    type: "outro",
    content: "That's all for this week. Hit reply if you have thoughts...",
  },
];
```

#### 4.4.3 Table of Contents

When `includeToc: true`, newsletters include navigation:

```typescript
function generateToc(sections: NewsletterSection[]): string {
  const tocItems = sections
    .filter(s => s.type !== "intro" && s.type !== "outro")
    .map(s => `• ${s.title}`);

  return `IN THIS ISSUE:\n${tocItems.join("\n")}`;
}
```

### 4.5 Subject Line Patterns

Newsletters use consistent, recognizable subject formats:

```typescript
const subjectPatterns = {
  numbered: (name: string, issue: number, headline: string) =>
    `${name} #${issue}: ${headline}`,

  dated: (name: string, date: Date, headline: string) =>
    `[${name}] ${format(date, "MMM d")}: ${headline}`,

  bracketed: (name: string, headline: string) =>
    `[${name}] ${headline}`,

  personal: (headline: string) =>
    headline, // No prefix for personal newsletters

  emoji: (emoji: string, name: string, issue: number) =>
    `${emoji} ${name} Issue ${issue}`,
};
```

### 4.6 Forward Support

Unlike spam and marketing, newsletters support forwarding because users genuinely share interesting content:

```typescript
// When isForward: true is requested (rare but valid)
private generateForward(context: GenerationContext): EmailContent {
  const { faker, parentMessage } = context;

  const intro = faker.helpers.arrayElement([
    "Thought you might find this newsletter interesting.",
    "This article made me think of you.",
    "Great insights in this one - worth a read.",
    "FYI - relevant to what we discussed.",
  ]);

  return {
    subject: `Fwd: ${parentMessage!.subject}`,
    text: `${intro}\n\n---------- Forwarded Newsletter ----------\n${parentMessage!.bodyExcerpt}`,
  };
}
```

---

## 5. Weight Recommendations

### 5.1 Default Distribution

With all three plugins plus the standard email plugin from RFC-002:

| Plugin      | Default Weight | Resulting Probability |
| ----------- | -------------- | --------------------- |
| `standard`  | 1.0            | 48.8%                 |
| `marketing` | 0.5            | 24.4%                 |
| `spam`      | 0.3            | 14.6%                 |
| `newsletter`| 0.25           | 12.2%                 |
| **Total**   | **2.05**       | **100%**              |

### 5.2 Scenario-Based Overrides

#### Clean Inbox Testing
```typescript
// No spam, minimal marketing
const cleanInboxWeights = {
  standard: 1.0,
  marketing: 0.2,
  spam: 0,        // Disabled
  newsletter: 0.3,
};
```

#### Spam Filter Testing
```typescript
// Heavy spam for filter testing
const spamTestingWeights = {
  standard: 0.2,
  marketing: 0.1,
  spam: 2.0,      // Dominant
  newsletter: 0.1,
};
```

#### Business Inbox
```typescript
// More newsletters, less spam (filtered)
const businessInboxWeights = {
  standard: 1.0,
  marketing: 0.4,
  spam: 0.1,
  newsletter: 0.5,
};
```

---

## 6. Implementation Considerations

### 6.1 Shared Utilities

These plugins share common utilities:

```typescript
// Shared brand/company generation
import { generateFictionalBrand } from "../utils/brands";

// Shared HTML email templates
import { emailTemplate, button, footer } from "../utils/html-templates";

// Shared unsubscribe link generation
import { generateUnsubscribeLink } from "../utils/compliance";
```

### 6.2 Content Safety

All generated content is:
- Fictional and clearly synthetic
- Non-functional (links don't resolve to real sites)
- Non-malicious (no actual exploit code or payloads)
- Appropriate for testing environments

### 6.3 Internationalization

Future versions may support locale-specific content:
- Localized brand names and content
- Region-appropriate spam patterns
- Multi-language newsletter sections

---

## 7. Testing Requirements

### 7.1 Capability Tests

Each plugin must verify its capability declarations:

```typescript
describe("SpamEmailPlugin capabilities", () => {
  const plugin = new SpamEmailPlugin();

  it("cannot be a reply", () => {
    expect(plugin.capabilities.canBeReply).toBe(false);
  });

  it("cannot be a forward", () => {
    expect(plugin.capabilities.canBeForward).toBe(false);
  });

  it("can generate originals", () => {
    expect(plugin.capabilities.canBeOriginal).toBe(true);
  });
});
```

### 7.2 Content Validation

Generated content must be:
- Parseable by mailparser
- Valid HTML (when HTML content is generated)
- Deterministic with same seed
- Category-appropriate (spam looks like spam, not newsletters)

### 7.3 Weight Integration

Test that weights integrate correctly with the engine:

```typescript
describe("Plugin weight distribution", () => {
  it("respects configured weights", async () => {
    const generator = new MailfuzzGenerator({
      seed: 42,
      count: 1000,
      plugins: [spam, marketing, newsletter, standard],
      weights: { spam: 0.3, marketing: 0.5, newsletter: 0.25, standard: 1.0 },
    });

    const results = await generator.generate();
    const distribution = countByPlugin(results);

    // Allow 5% tolerance
    expect(distribution.spam).toBeCloseTo(146, 50);  // 14.6% of 1000
    expect(distribution.marketing).toBeCloseTo(244, 50);
    expect(distribution.newsletter).toBeCloseTo(122, 50);
    expect(distribution.standard).toBeCloseTo(488, 50);
  });
});
```

---

## 8. References

- [RFC-001: Mailfuzz Core](./RFC-001-mailfuzz.md)
- [RFC-002: Plugin Architecture](./RFC-002-plugin-architecture.md)
- [CAN-SPAM Act Compliance](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
- [Common Spam Patterns](https://en.wikipedia.org/wiki/Email_spam)
