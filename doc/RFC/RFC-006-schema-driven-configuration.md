# RFC-006: Schema-Driven Configuration

> **Status**: Draft  
> **Created**: 2026-01-19  
> **Author**: Mailfuzz Team

---

## Abstract

This RFC proposes refactoring the mailfuzz CLI to use a schema-driven configuration approach. All CLI options will be defined in a single Zod schema that serves as the source of truth for:

1. **JSON configuration files** (`mailfuzz.json`) with JSON Schema support for IDE autocompletion
2. **CLI argument parsing** via automatic generation from the schema
3. **TypeScript types** inferred directly from the schema
4. **Validation** at runtime using Zod

This approach follows the pattern established by modern tools like Biome, ESLint, and TypeScript, providing a seamless developer experience with `$schema` support for IDE integration.

---

## 1. Motivation

### 1.1 Current State

The current CLI implementation manually defines:

- CLI options in `parseArgs()` calls with hardcoded defaults
- Help text with option descriptions
- TypeScript interfaces for option types
- Validation logic scattered across parsing functions
- Default configuration values embedded directly in code

This leads to several issues:

- **Duplication**: Options are defined in multiple places (help text, parseArgs, types)
- **Inconsistency risk**: Changes to options require updates in multiple locations
- **No config file support**: Users must pass all options via CLI arguments
- **Limited validation**: No centralized schema for validating user input
- **Hidden defaults**: Default values are buried in code rather than being transparent and discoverable

> **Note**: Rather than relying on Zod schema defaults alone, we will ship a **bundled default configuration file** (`default.mailfuzz.json`) with the package. This makes defaults explicit, discoverable, and serves as documentation. The configuration resolution order becomes: CLI args > User config file > Bundled default config.

### 1.2 Use Cases

**Configuration Files:**

```json
{
  "$schema": "https://mailfuzz.dev/schemas/1.0.0/schema.json",
  "generate": {
    "output": "./test-maildir",
    "count": 1000,
    "seed": 12345,
    "plugins": ["standard", "marketing"],
    "locales": {
      "en": 0.7,
      "de": 0.2,
      "fr": 0.1
    }
  }
}
```

**CLI Override:**

```bash
# Use config file
mailfuzz generate

# Override specific options
mailfuzz generate --count 500 --seed 99999

# Specify custom config file
mailfuzz generate --config ./custom-config.json
```

---

## 2. Technical Approach

### 2.1 Technology Stack

| Component              | Library                 | Purpose                                  |
| ---------------------- | ----------------------- | ---------------------------------------- |
| Schema Definition      | **Zod**                 | Define all options with validation rules |
| JSON Schema Generation | **zod-to-json-schema**  | Generate JSON Schema for IDE support     |
| CLI Parsing            | **Node.js `parseArgs`** | Built-in, zero-dependency CLI parsing    |
| Config File Loading    | **Custom**              | Lightweight JSON/JSONC loader            |

### 2.2 Why Zod?

Zod is already a project dependency and provides:

- **Type inference**: `z.infer<typeof schema>` gives TypeScript types automatically
- **Validation**: Runtime validation with detailed error messages
- **Transformation**: Coerce string CLI values to numbers, booleans, etc.
- **Descriptions**: `.describe()` for generating help text

### 2.3 Why zod-to-json-schema?

This library converts Zod schemas to JSON Schema draft-07, enabling:

- IDE autocompletion in JSON config files via `$schema`
- Integration with VS Code, JetBrains IDEs, and other editors
- Standardized schema format for documentation

### 2.4 Why Node.js `parseArgs`?

The built-in `node:util` `parseArgs` function:

- Zero external dependencies
- Ships with Node.js 18.3.0+
- Supports all needed features (types, multiple values, short flags, defaults)
- Already used in the current implementation

---

## 3. Schema Design

### 3.1 Option Definition Schema

Each option is defined with metadata that drives both CLI and config file behavior:

```typescript
import { z } from "zod";

/**
 * Metadata for generating CLI arguments and help text.
 */
const OptionMeta = z.object({
  /** Short flag for CLI (e.g., "o" for -o) */
  short: z.string().length(1).optional(),
  /** CLI argument name override (defaults to kebab-case of key) */
  cliName: z.string().optional(),
  /** Whether this option can be repeated (--plugin a --plugin b) */
  multiple: z.boolean().optional(),
  /** Group for organizing help text */
  group: z
    .enum(["general", "generation", "plugins", "locales", "validation"])
    .optional(),
  /** Environment variable override */
  env: z.string().optional(),
});
```

### 3.2 Generate Command Schema

```typescript
import { z } from "zod";

export const GenerateConfigSchema = z.object({
  output: z.string().default("./maildir").describe("Output maildir path"),

  count: z
    .number()
    .int()
    .positive()
    .default(100)
    .describe("Number of messages to generate"),

  seed: z
    .number()
    .int()
    .optional()
    .describe("Random seed for deterministic generation"),

  participants: z
    .number()
    .int()
    .positive()
    .default(20)
    .describe("Max participants in pool"),

  conversations: z
    .number()
    .int()
    .positive()
    .default(30)
    .describe("Max conversation threads"),

  startDate: z.coerce
    .date()
    .optional()
    .describe("Oldest message date (default: 30 days ago)"),

  endDate: z.coerce
    .date()
    .optional()
    .describe("Newest message date (default: now)"),

  htmlProbability: z
    .number()
    .min(0)
    .max(1)
    .default(0.7)
    .describe("Probability of HTML content (0-1)"),

  replyProbability: z
    .number()
    .min(0)
    .max(1)
    .default(0.4)
    .describe("Probability of reply vs new message (0-1)"),

  forwardProbability: z
    .number()
    .min(0)
    .max(1)
    .default(0.1)
    .describe("Probability of forward (0-1)"),

  quiet: z.boolean().default(false).describe("Suppress progress output"),

  // Plugin configuration
  plugins: z.array(z.string()).optional().describe("Plugin IDs to use"),

  allPlugins: z.boolean().default(false).describe("Use all available plugins"),

  pluginWeights: z
    .record(z.string(), z.number().nonnegative())
    .optional()
    .describe("Override plugin weights"),

  pluginOptions: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional()
    .describe("Plugin-specific options"),

  // Locale configuration
  locales: z
    .record(z.string(), z.number().positive())
    .optional()
    .describe("Locale weights (e.g., { en: 0.7, de: 0.3 })"),

  fallbackLocale: z
    .string()
    .default("en")
    .describe("Fallback locale for missing data"),
});

export type GenerateConfig = z.infer<typeof GenerateConfigSchema>;
```

### 3.3 Root Configuration Schema

```typescript
export const MailfuzzConfigSchema = z.object({
  $schema: z.string().optional(),

  generate: GenerateConfigSchema.optional(),

  validate: z
    .object({
      skipContent: z
        .boolean()
        .default(false)
        .describe("Skip validating message content"),
    })
    .optional(),
});

export type MailfuzzConfig = z.infer<typeof MailfuzzConfigSchema>;
```

---

## 4. Implementation Architecture

### 4.1 Module Structure

```
src/
├── config/
│   ├── index.ts              # Public API exports
│   ├── schema.ts             # Zod schema definitions
│   ├── cli-options.ts        # CLI option metadata & mapping
│   ├── config-loader.ts      # Config file discovery & loading
│   ├── config-merger.ts      # Merge config file + CLI + defaults
│   ├── json-schema.ts        # JSON Schema generation
│   └── defaults.json         # Bundled default configuration
├── cli.ts                    # CLI entry point (simplified)
└── ...
```

### 4.2 Bundled Default Configuration

Instead of hardcoding defaults in code, we ship a `defaults.json` file with the package:

```json
// src/config/defaults.json
{
  "$schema": "./schema.json",
  "generate": {
    "output": "./maildir",
    "count": 100,
    "participants": 20,
    "conversations": 30,
    "htmlProbability": 0.7,
    "replyProbability": 0.4,
    "forwardProbability": 0.1,
    "plugins": ["standard"],
    "fallbackLocale": "en",
    "locales": {
      "en": 1.0
    },
    "quiet": false
  },
  "validate": {
    "skipContent": false
  }
}
```

This approach provides:

- **Transparency**: Users can inspect the bundled defaults
- **Documentation**: The default config serves as a complete example
- **Override-ability**: Users can copy and modify for their own config
- **Single source of truth**: No defaults scattered across code

### 4.3 CLI Option Metadata

To bridge Zod schemas with `parseArgs`, we define metadata separately:

```typescript
// src/config/cli-options.ts
import type { ParseArgsConfig } from "node:util";

export interface CliOptionMeta {
  /** Schema path (dot notation) for the corresponding Zod field */
  schemaPath: string;
  /** Short flag */
  short?: string;
  /** CLI type (parseArgs only supports "string" | "boolean") */
  type: "string" | "boolean";
  /** Can be repeated */
  multiple?: boolean;
  /** Default value for CLI (string representation) */
  default?: string | boolean;
}

export const generateCliOptions: Record<string, CliOptionMeta> = {
  output: {
    schemaPath: "generate.output",
    short: "o",
    type: "string",
    default: "./maildir",
  },
  count: {
    schemaPath: "generate.count",
    short: "n",
    type: "string",
    default: "100",
  },
  seed: {
    schemaPath: "generate.seed",
    short: "s",
    type: "string",
  },
  participants: {
    schemaPath: "generate.participants",
    short: "p",
    type: "string",
    default: "20",
  },
  conversations: {
    schemaPath: "generate.conversations",
    type: "string",
    default: "30",
  },
  "start-date": {
    schemaPath: "generate.startDate",
    type: "string",
  },
  "end-date": {
    schemaPath: "generate.endDate",
    type: "string",
  },
  "html-probability": {
    schemaPath: "generate.htmlProbability",
    type: "string",
    default: "0.7",
  },
  "reply-probability": {
    schemaPath: "generate.replyProbability",
    type: "string",
    default: "0.4",
  },
  "forward-probability": {
    schemaPath: "generate.forwardProbability",
    type: "string",
    default: "0.1",
  },
  quiet: {
    schemaPath: "generate.quiet",
    short: "q",
    type: "boolean",
    default: false,
  },
  plugins: {
    schemaPath: "generate.plugins",
    type: "string",
  },
  "all-plugins": {
    schemaPath: "generate.allPlugins",
    type: "boolean",
    default: false,
  },
  plugin: {
    schemaPath: "generate.plugins",
    type: "string",
    multiple: true,
  },
  weight: {
    schemaPath: "generate.pluginWeights",
    short: "w",
    type: "string",
    multiple: true,
  },
  "plugin-opt": {
    schemaPath: "generate.pluginOptions",
    type: "string",
    multiple: true,
  },
  locale: {
    schemaPath: "generate.locales",
    type: "string",
    multiple: true,
  },
  "locale-weight": {
    schemaPath: "generate.locales",
    type: "string",
    multiple: true,
  },
  "fallback-locale": {
    schemaPath: "generate.fallbackLocale",
    type: "string",
    default: "en",
  },
};

/**
 * Generate parseArgs options from CLI metadata.
 */
export const buildParseArgsOptions = (
  meta: Record<string, CliOptionMeta>,
): ParseArgsConfig["options"] => {
  const options: ParseArgsConfig["options"] = {};

  for (const [name, opt] of Object.entries(meta)) {
    options[name] = {
      type: opt.type,
      short: opt.short,
      multiple: opt.multiple,
      default: opt.default,
    };
  }

  return options;
};
```

### 4.3 Config File Discovery

Following Biome's approach, config files are discovered by walking up the directory tree:

```typescript
// src/config/config-loader.ts
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { MailfuzzConfigSchema } from "./schema.js";

const CONFIG_FILENAMES = [
  "mailfuzz.json",
  "mailfuzz.jsonc",
  ".mailfuzzrc.json",
];

/**
 * Find the nearest config file by walking up from the current directory.
 */
export const findConfigFile = (
  startDir: string = process.cwd(),
): string | null => {
  let currentDir = resolve(startDir);
  const root = dirname(currentDir);

  while (currentDir !== root) {
    for (const filename of CONFIG_FILENAMES) {
      const configPath = join(currentDir, filename);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = dirname(currentDir);
  }

  return null;
};

/**
 * Load and validate a config file.
 */
export const loadConfigFile = (configPath: string): MailfuzzConfig => {
  const content = readFileSync(configPath, "utf-8");

  // Strip comments for .jsonc files
  const jsonContent = configPath.endsWith(".jsonc")
    ? stripJsonComments(content)
    : content;

  const parsed = JSON.parse(jsonContent);

  // Validate with Zod schema
  return MailfuzzConfigSchema.parse(parsed);
};

/**
 * Simple JSONC comment stripper.
 */
const stripJsonComments = (content: string): string => {
  return content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
};
```

### 4.4 Configuration Merging

Configuration sources are merged with the following precedence (highest to lowest):

1. **CLI arguments** - Explicit command-line flags
2. **User config file** - Project's `mailfuzz.json`
3. **Bundled defaults** - Shipped `defaults.json`

```typescript
// src/config/config-merger.ts
import { GenerateConfigSchema, type GenerateConfig } from "./schema.js";
import bundledDefaults from "./defaults.json" with { type: "json" };

/**
 * Merge configuration sources with precedence:
 * CLI args > User config file > Bundled defaults
 */
export const mergeGenerateConfig = (
  userConfig: Partial<GenerateConfig> | undefined,
  cliValues: Record<string, unknown>,
): GenerateConfig => {
  // Start with bundled defaults
  const merged = { ...bundledDefaults.generate };

  // Layer user config file values
  if (userConfig) {
    Object.assign(merged, userConfig);
  }

  // Override with CLI values (only if explicitly provided)
  for (const [key, value] of Object.entries(cliValues)) {
    if (value !== undefined) {
      merged[key as keyof GenerateConfig] = value;
    }
  }

  // Validate final merged config
  return GenerateConfigSchema.parse(merged);
};
```

### 4.5 JSON Schema Generation

```typescript
// src/config/json-schema.ts
import { zodToJsonSchema } from "zod-to-json-schema";
import { MailfuzzConfigSchema } from "./schema.js";

export const generateJsonSchema = () => {
  return zodToJsonSchema(MailfuzzConfigSchema, {
    name: "MailfuzzConfig",
    $refStrategy: "none",
    target: "jsonSchema7",
  });
};

// Build script to output schema file
export const writeSchemaFile = (outputPath: string) => {
  const schema = generateJsonSchema();
  schema.$schema = "http://json-schema.org/draft-07/schema#";

  writeFileSync(outputPath, JSON.stringify(schema, null, 2));
};
```

### 4.6 Help Text Generation

Generate help text from schema descriptions:

```typescript
// src/config/help-generator.ts
import { generateCliOptions } from "./cli-options.js";
import { GenerateConfigSchema } from "./schema.js";

/**
 * Generate help text from schema and CLI metadata.
 */
export const generateHelpText = (): string => {
  const lines: string[] = [
    "mailfuzz - Generate RFC-compliant synthetic emails",
    "",
    "USAGE:",
    "  mailfuzz generate [options]",
    "  mailfuzz validate <maildir-path>",
    "  mailfuzz plugins",
    "  mailfuzz locales",
    "  mailfuzz init",
    "  mailfuzz --help",
    "",
    "COMMANDS:",
    "  generate    Generate emails and write to a maildir",
    "  validate    Validate an existing maildir",
    "  plugins     List available plugins with descriptions",
    "  locales     List available locale codes",
    "  init        Create a mailfuzz.json config file",
    "",
    "GENERATE OPTIONS:",
  ];

  // Generate option documentation from schema
  for (const [name, meta] of Object.entries(generateCliOptions)) {
    const shortFlag = meta.short ? `-${meta.short}, ` : "    ";
    const defaultStr =
      meta.default !== undefined ? ` (default: ${meta.default})` : "";

    // Get description from schema
    const description = getSchemaDescription(meta.schemaPath) ?? "";

    lines.push(`  ${shortFlag}--${name}${defaultStr}`);
    if (description) {
      lines.push(`        ${description}`);
    }
  }

  return lines.join("\n");
};
```

---

## 5. CLI Refactoring

### 5.1 Simplified Entry Point

```typescript
// src/cli.ts
import { parseArgs } from "node:util";
import { findConfigFile, loadConfigFile } from "./config/config-loader.js";
import { mergeGenerateConfig } from "./config/config-merger.js";
import {
  buildParseArgsOptions,
  generateCliOptions,
} from "./config/cli-options.js";
import { generateHelpText } from "./config/help-generator.js";
import { transformCliValues } from "./config/cli-transform.js";

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);

  // Handle --help
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(generateHelpText());
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  switch (command) {
    case "generate":
      await runGenerate(commandArgs);
      break;
    case "validate":
      await runValidate(commandArgs);
      break;
    case "plugins":
      runListPlugins();
      break;
    case "locales":
      runListLocales();
      break;
    case "init":
      runInit();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
};

const runGenerate = async (args: string[]): Promise<void> => {
  // Parse CLI arguments
  const { values } = parseArgs({
    args,
    options: {
      ...buildParseArgsOptions(generateCliOptions),
      config: { type: "string", short: "c" },
    },
    allowPositionals: true,
  });

  // Load config file (explicit or discovered)
  const configPath = values.config ?? findConfigFile();
  const fileConfig = configPath ? loadConfigFile(configPath) : undefined;

  // Transform CLI string values to proper types
  const cliConfig = transformCliValues(values, generateCliOptions);

  // Merge: CLI > Config file > Defaults
  const config = mergeGenerateConfig(fileConfig?.generate, cliConfig);

  // Run generation with merged config
  await executeGenerate(config);
};
```

### 5.2 Init Command

```typescript
const runInit = (): void => {
  const configPath = "mailfuzz.json";

  if (existsSync(configPath)) {
    console.error(`Config file already exists: ${configPath}`);
    process.exit(1);
  }

  const defaultConfig = {
    $schema: "https://mailfuzz.dev/schemas/1.0.0/schema.json",
    generate: {
      output: "./maildir",
      count: 100,
      plugins: ["standard"],
    },
  };

  writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  console.log(`Created ${configPath}`);
};
```

---

## 6. JSON Schema Distribution

### 6.1 Schema Versioning

Schemas are versioned and published at predictable URLs:

```
https://mailfuzz.dev/schemas/1.0.0/schema.json
https://mailfuzz.dev/schemas/latest/schema.json
```

### 6.2 Local Schema Reference

For offline use, the schema can be bundled with the package:

```json
{
  "$schema": "./node_modules/@kattebak/mailfuzz/schemas/schema.json",
  "generate": {
    "count": 100
  }
}
```

### 6.3 Build-time Schema Generation

Add a build script to generate the schema:

```json
{
  "scripts": {
    "build:schema": "tsx scripts/generate-schema.ts",
    "build": "npm run build:schema && tsc"
  }
}
```

---

## 7. Migration Strategy

### 7.1 Phase 1: Schema Foundation (Non-breaking)

1. Create `src/config/` module with Zod schemas
2. Add `zod-to-json-schema` dependency
3. Generate JSON Schema file
4. Add `mailfuzz init` command
5. Support loading config files
6. CLI continues to work exactly as before

### 7.2 Phase 2: CLI Refactoring (Non-breaking)

1. Refactor CLI to use schema-driven option generation
2. Generate help text from schema descriptions
3. Add `--config` flag for explicit config file path
4. CLI behavior remains identical

### 7.3 Phase 3: Enhanced Features (Optional)

1. Support `.mailfuzzrc` in home directory for global defaults
2. Add `mailfuzz config` command for inspecting merged configuration
3. Support environment variable overrides (e.g., `MAILFUZZ_COUNT=500`)

---

## 8. Testing Strategy

### 8.1 Schema Tests

```typescript
import { describe, it, expect } from "vitest";
import { GenerateConfigSchema } from "./schema.js";

describe("GenerateConfigSchema", () => {
  it("applies defaults", () => {
    const result = GenerateConfigSchema.parse({});
    expect(result.count).toBe(100);
    expect(result.output).toBe("./maildir");
  });

  it("validates probability ranges", () => {
    expect(() =>
      GenerateConfigSchema.parse({ htmlProbability: 1.5 }),
    ).toThrow();
  });

  it("coerces date strings", () => {
    const result = GenerateConfigSchema.parse({
      startDate: "2026-01-01",
    });
    expect(result.startDate).toBeInstanceOf(Date);
  });
});
```

### 8.2 Config Loading Tests

```typescript
describe("config loading", () => {
  it("discovers config file in parent directory", () => {
    // ... test config discovery
  });

  it("merges CLI over config file", () => {
    const fileConfig = { count: 100 };
    const cliValues = { count: 500 };
    const result = mergeGenerateConfig(fileConfig, cliValues);
    expect(result.count).toBe(500);
  });
});
```

### 8.3 CLI Compatibility Tests

```typescript
describe("CLI backwards compatibility", () => {
  it("parses legacy CLI arguments", () => {
    const args = ["-n", "500", "-o", "./test", "--seed", "12345"];
    // Verify same behavior as before
  });
});
```

---

## 9. Example Configuration Files

### 9.1 Minimal Config

```json
{
  "$schema": "https://mailfuzz.dev/schemas/1.0.0/schema.json",
  "generate": {
    "count": 1000
  }
}
```

### 9.2 Full Config

```json
{
  "$schema": "https://mailfuzz.dev/schemas/1.0.0/schema.json",
  "generate": {
    "output": "./test-emails",
    "count": 5000,
    "seed": 42,
    "participants": 50,
    "conversations": 100,
    "startDate": "2025-01-01",
    "endDate": "2026-01-01",
    "htmlProbability": 0.8,
    "replyProbability": 0.5,
    "forwardProbability": 0.15,
    "plugins": ["standard", "marketing", "newsletter"],
    "pluginWeights": {
      "standard": 2.0,
      "marketing": 0.5
    },
    "pluginOptions": {
      "file-upload": {
        "minSizeKb": 100,
        "maxSizeKb": 5000
      }
    },
    "locales": {
      "en": 0.6,
      "de": 0.25,
      "fr": 0.15
    },
    "fallbackLocale": "en"
  },
  "validate": {
    "skipContent": false
  }
}
```

### 9.3 JSONC Config (with comments)

```jsonc
{
  "$schema": "https://mailfuzz.dev/schemas/1.0.0/schema.json",
  "generate": {
    // Generate a large test set for performance testing
    "count": 10000,
    "seed": 12345, // Fixed seed for reproducibility

    // Use all available plugins for variety
    "plugins": ["standard", "marketing", "newsletter", "spam"],

    /* Locale distribution matching our user base:
       - 60% English
       - 30% German
       - 10% French
    */
    "locales": {
      "en": 0.6,
      "de": 0.3,
      "fr": 0.1,
    },
  },
}
```

---

## 10. Future Considerations

### 10.1 Extends Support

Like TypeScript's `extends` in tsconfig.json:

```json
{
  "extends": "./base-config.json",
  "generate": {
    "count": 500
  }
}
```

### 10.2 Project-Specific Overrides

Similar to Biome's approach for monorepos:

```
project/
├── mailfuzz.json           # Base config
├── packages/
│   ├── app-a/
│   │   └── mailfuzz.json   # Extends base, overrides count
│   └── app-b/
│       └── mailfuzz.json   # Different plugins
```

### 10.3 Environment Variable Support

```typescript
const EnvAwareSchema = GenerateConfigSchema.extend({
  count: z.coerce.number().default(process.env.MAILFUZZ_COUNT ?? 100),
});
```

---

## 11. Appendix: Dependency Analysis

### 11.1 New Dependencies

| Package            | Size  | Purpose                |
| ------------------ | ----- | ---------------------- |
| zod-to-json-schema | ~15KB | JSON Schema generation |

Note: `zod` is already a project dependency.

### 11.2 Alternative Approaches Considered

| Approach                     | Pros                              | Cons                                          |
| ---------------------------- | --------------------------------- | --------------------------------------------- |
| **JSON Schema + ajv**        | Industry standard                 | Separate schema definition, no type inference |
| **TypeBox**                  | JSON Schema native                | Different API, learning curve                 |
| **io-ts**                    | Functional approach               | Less ergonomic, smaller ecosystem             |
| **Zod + zod-to-json-schema** | Already using Zod, type inference | Extra build step for schema                   |

The Zod approach was chosen because:

1. Zod is already a project dependency
2. Type inference eliminates duplicate type definitions
3. The `.describe()` method enables help text generation
4. `zod-to-json-schema` is well-maintained and lightweight

---

## 12. References

- [Biome Configuration](https://biomejs.dev/guides/configure-biome/)
- [Node.js parseArgs](https://nodejs.org/api/util.html#utilparseargsconfig)
- [Zod Documentation](https://zod.dev)
- [zod-to-json-schema](https://github.com/stefanterdell/zod-to-json-schema)
- [JSON Schema Specification](https://json-schema.org/specification.html)
