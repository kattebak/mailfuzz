# RFC-005: Locale Support for Internationalized Email Generation

> **Status**: Draft  
> **Created**: 2026-01-19  
> **Author**: Mailfuzz Team  
> **Depends On**: RFC-001, RFC-002, RFC-003

---

## Abstract

This RFC proposes adding locale support to Mailfuzz, enabling generation of emails with content in multiple languages. The feature supports weighted distribution of locales, allowing realistic simulation of multilingual email environments (e.g., 70% English, 20% German, 10% French).

---

## 1. Motivation

### 1.1 Use Cases

1. **International Email Clients**: Testing email clients that must handle multiple character sets, text directions, and language-specific formatting.
2. **Multilingual Organizations**: Simulating corporate mailboxes where employees communicate in different languages.
3. **ML Training Data**: Generating diverse training data for language-aware email classification systems.
4. **Locale-Specific Testing**: Validating that email rendering works correctly for German umlauts, French accents, Asian characters, etc.

### 1.2 Goals

1. Support multiple @faker-js/faker locales with weighted distribution
2. Expose locale configuration through both CLI and library API
3. Enable plugins to generate locale-aware content
4. Maintain deterministic generation when locales are specified
5. Preserve backward compatibility (English default)

### 1.3 Non-Goals

- Translation of email content between languages
- Automatic locale detection from recipient domains
- Right-to-left (RTL) layout generation (future RFC)

---

## 2. Faker.js Locale Support

### 2.1 Available Locales

@faker-js/faker provides 60+ locales including:

| Code    | Language          | Region      |
|---------|-------------------|-------------|
| `en`    | English           | Generic     |
| `en_US` | English           | USA         |
| `en_GB` | English           | UK          |
| `de`    | German            | Germany     |
| `de_AT` | German            | Austria     |
| `de_CH` | German            | Switzerland |
| `fr`    | French            | France      |
| `fr_CH` | French            | Switzerland |
| `es`    | Spanish           | Generic     |
| `nl`    | Dutch             | Netherlands |
| `it`    | Italian           | Italy       |
| `pt_BR` | Portuguese        | Brazil      |
| `ja`    | Japanese          | Japan       |
| `zh_CN` | Chinese           | China       |
| `ko`    | Korean            | Korea       |

### 2.2 Faker.js Locale Usage

```typescript
import { fakerDE, fakerFR, Faker, de, fr, en, base } from '@faker-js/faker';

// Pre-built instances
fakerDE.person.firstName(); // 'Friedrich'
fakerFR.location.city();    // 'Paris'

// Custom instance with fallback chain
const customFaker = new Faker({
  locale: [de, en, base]  // German → English → base fallback
});
```

---

## 3. Design

### 3.1 Core Concepts

#### Locale Weight
A decimal (0-1) representing the probability of selecting a locale during generation. Weights are normalized so they sum to 1.0.

#### Locale Fallback
When a locale lacks data for a specific field (e.g., middle names in some cultures), Faker falls back to the next locale in the chain. Our default chain: `[selectedLocale, en, base]`.

#### Per-Message Locale Selection
Each message is generated with a single locale, selected weighted-randomly at generation time. This ensures consistent content within a single email.

### 3.2 Configuration Schema

```typescript
/**
 * Locale weight configuration.
 * Keys are Faker.js locale codes, values are relative weights.
 */
export interface LocaleWeights {
  [localeCode: string]: number;
}

/**
 * Locale configuration for email generation.
 */
export interface LocaleConfig {
  /**
   * Locale weights for distribution.
   * If empty or undefined, defaults to { en: 1.0 }
   * @example { en: 0.7, de: 0.2, fr: 0.1 }
   */
  weights: LocaleWeights;
  
  /**
   * Fallback locale when primary locale lacks data.
   * @default 'en'
   */
  fallbackLocale?: string;
}
```

### 3.3 Updated MailfuzzConfig

```typescript
export interface MailfuzzConfig {
  output: OutputConfig;
  generation: GenerationConfig;
  time: TimeConfig;
  plugins: PluginsConfig;
  content: ContentConfig;
  locale?: LocaleConfig;  // NEW
}
```

### 3.4 Updated GenerationContext

```typescript
export interface GenerationContext {
  /**
   * Seeded Faker instance for deterministic generation.
   * Configured with the selected locale for this message.
   */
  faker: Faker;

  /**
   * The locale code selected for this message.
   * Plugins can use this for locale-aware content decisions.
   * @example 'de', 'fr', 'en_US'
   */
  locale: string;  // NEW

  // ... existing fields
}
```

### 3.5 Generator Options Update

```typescript
export interface MailfuzzGeneratorOptions {
  // ... existing options
  
  /**
   * Locale configuration with weights.
   * @example { locales: { en: 0.7, de: 0.2, fr: 0.1 } }
   */
  locales?: LocaleWeights;
  
  /**
   * Fallback locale for missing data.
   * @default 'en'
   */
  fallbackLocale?: string;
}
```

---

## 4. CLI Interface

### 4.1 New Options

```
LOCALE OPTIONS:
  --locale <code>              Add a locale with weight 1.0 (can be repeated)
  --locale-weight <code=n>     Set locale with specific weight (can be repeated)
  --fallback-locale <code>     Fallback locale for missing data (default: en)
```

### 4.2 CLI Examples

```bash
# Single locale (German only)
mailfuzz generate --locale de

# Multiple locales with equal weight
mailfuzz generate --locale en --locale de --locale fr

# Weighted distribution
mailfuzz generate --locale-weight en=0.7 --locale-weight de=0.2 --locale-weight fr=0.1

# Mixed syntax (locale defaults to weight 1.0)
mailfuzz generate --locale en --locale-weight de=0.5

# With explicit fallback
mailfuzz generate --locale-weight de=1.0 --fallback-locale en_US
```

### 4.3 Validation

- Locale codes must be valid Faker.js locale codes
- Weights must be positive numbers
- At least one locale must be specified when using locale options
- Invalid locale codes produce a clear error listing available locales

---

## 5. Library API

### 5.1 Basic Usage

```typescript
import { MailfuzzGenerator } from 'mailfuzz';

// Single locale
const generator = new MailfuzzGenerator({
  locales: { de: 1.0 }
});

// Weighted distribution
const generator = new MailfuzzGenerator({
  locales: { en: 0.7, de: 0.2, fr: 0.1 },
  fallbackLocale: 'en'
});
```

### 5.2 Locale Selection Algorithm

```typescript
function selectLocale(faker: Faker, weights: LocaleWeights): string {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [_, w]) => sum + w, 0);
  
  const random = faker.number.float({ min: 0, max: totalWeight });
  
  let cumulative = 0;
  for (const [locale, weight] of entries) {
    cumulative += weight;
    if (random <= cumulative) {
      return locale;
    }
  }
  
  return entries[0][0]; // Fallback to first
}
```

---

## 6. Plugin Integration

### 6.1 Locale in GenerationContext

Plugins receive the selected locale via `context.locale`:

```typescript
class StandardEmailPlugin implements EmailPlugin {
  generate(context: GenerationContext): EmailContent {
    const { faker, locale } = context;
    
    // Faker is already configured with the locale
    const greeting = faker.person.firstName(); // Locale-aware
    
    // Plugin can make locale-specific decisions
    if (locale.startsWith('de')) {
      // German-specific formatting
    }
    
    return { subject, text };
  }
}
```

### 6.2 Plugin Locale Capabilities (Future)

For a future RFC, plugins may declare locale support:

```typescript
export interface PluginCapabilities {
  // ... existing
  
  /**
   * Locales this plugin fully supports.
   * If undefined, plugin works with any locale via Faker.
   * If specified, plugin is only selected when locale matches.
   */
  supportedLocales?: string[];
}
```

---

## 7. Implementation Plan

### Phase 1: Core Infrastructure (This RFC)
1. Add `LocaleConfig` and `LocaleWeights` types to `types.ts`
2. Update `GenerationContext` with `locale` field
3. Update `MailfuzzGeneratorOptions` with locale options
4. Implement `LocaleManager` class for locale selection and Faker instantiation

### Phase 2: Generator Integration
1. Update `MailfuzzGenerator` to accept and store locale config
2. Implement per-message locale selection
3. Create locale-configured Faker instances with fallback chains
4. Pass locale to `GenerationContext`

### Phase 3: CLI Integration
1. Add `--locale` and `--locale-weight` parsing
2. Add `--fallback-locale` option
3. Validate locale codes against Faker.js available locales
4. Update help text

### Phase 4: Plugin Updates
1. **standard-email-plugin**: Already uses Faker, works automatically
2. **marketing-email-plugin**: Review for hardcoded English text
3. **newsletter-email-plugin**: Review for hardcoded English text
4. **spam-email-plugin**: Review for hardcoded English text
5. **file-upload-email-plugin**: Review for hardcoded English text

### Phase 5: Documentation & Testing
1. Add locale examples to README
2. Add integration tests for locale distribution
3. Test character encoding in generated emails
4. Validate Maildir output with non-ASCII content

---

## 8. Plugin-by-Plugin Locale Audit

### 8.1 standard-email-plugin
**Status**: Partially locale-ready  
**Issues**:
- Uses `faker.lorem` (locale-independent Latin text)
- Hardcoded English greetings: "Hi", "Hey", "Hello", "Dear"
- Hardcoded English sign-offs: "Best", "Thanks", "Cheers", "Regards"

**Changes Required**:
- Create locale-aware greeting/sign-off maps
- Consider using `faker.word` for some content

### 8.2 marketing-email-plugin
**Status**: Needs review  
**Likely Issues**:
- Hardcoded marketing phrases
- English call-to-action buttons

**Changes Required**:
- Locale-aware marketing templates
- Translatable CTA text

### 8.3 newsletter-email-plugin
**Status**: Needs review  
**Likely Issues**:
- Section headers
- Formatting conventions

**Changes Required**:
- Locale-aware section templates

### 8.4 spam-email-plugin
**Status**: Needs review  
**Likely Issues**:
- Spam phrases are often English-specific
- Subject line patterns

**Changes Required**:
- Locale-specific spam patterns (or keep English as "universal spam")

### 8.5 file-upload-email-plugin
**Status**: Needs review  
**Likely Issues**:
- File sharing notification text

**Changes Required**:
- Locale-aware notification templates

---

## 9. Backward Compatibility

- Default behavior unchanged: English locale with weight 1.0
- Existing configs without `locale` field work as before
- CLI without locale options uses English
- Plugins not updated for locale still work (Faker handles it)

---

## 10. Testing Strategy

### 10.1 Unit Tests
- Locale weight normalization
- Locale selection distribution (statistical test)
- Faker instance creation with fallback chain
- Invalid locale code rejection

### 10.2 Integration Tests
- Generate 1000 messages with 50/50 en/de split
- Verify approximate distribution (within statistical tolerance)
- Verify non-ASCII characters in output
- Verify Maildir files are valid UTF-8

### 10.3 Plugin Tests
- Each plugin generates valid content for each supported locale
- Greetings/sign-offs match locale when applicable

---

## 11. Open Questions

1. **Should locale affect participant names?**  
   Currently, participant pools are generated once. Should German-locale emails use German names? This RFC suggests yes, but implementation details TBD.

2. **How to handle locale-specific date formats?**  
   Faker handles this, but plugins generating date strings should be aware.

3. **Should we expose locale in email headers?**  
   `Content-Language` header could be set based on locale. Suggested: yes.

---

## 12. References

- [Faker.js Localization Guide](https://fakerjs.dev/guide/localization.html)
- [RFC 3282 - Content Language Headers](https://datatracker.ietf.org/doc/html/rfc3282)
- RFC-001: Mailfuzz core design
- RFC-002: Plugin architecture
- RFC-003: Email type plugins
