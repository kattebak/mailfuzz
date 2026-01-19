import { z } from "zod";

/**
 * Schema for the generate command configuration.
 * Each field uses .describe() to provide help text for CLI and documentation.
 */
export const GenerateConfigSchema = z.object({
	output: z.string().describe("Output maildir path"),

	count: z.number().int().positive().describe("Number of messages to generate"),

	seed: z
		.number()
		.int()
		.optional()
		.describe("Random seed for deterministic generation"),

	participants: z
		.number()
		.int()
		.positive()
		.describe("Max participants in pool"),

	conversations: z
		.number()
		.int()
		.positive()
		.describe("Max conversation threads"),

	startDate: z
		.string()
		.optional()
		.describe("Oldest message date (ISO format, default: 30 days ago)"),

	endDate: z
		.string()
		.optional()
		.describe("Newest message date (ISO format, default: now)"),

	htmlProbability: z
		.number()
		.min(0)
		.max(1)
		.describe("Probability of HTML content (0-1)"),

	replyProbability: z
		.number()
		.min(0)
		.max(1)
		.describe("Probability of reply vs new message (0-1)"),

	forwardProbability: z
		.number()
		.min(0)
		.max(1)
		.describe("Probability of forward (0-1)"),

	quiet: z.boolean().describe("Suppress progress output"),

	plugins: z.array(z.string()).describe("Plugin IDs to use"),

	allPlugins: z.boolean().describe("Use all available plugins"),

	pluginWeights: z
		.record(z.string(), z.number().nonnegative())
		.optional()
		.describe("Override plugin weights"),

	pluginOptions: z
		.record(z.string(), z.record(z.string(), z.unknown()))
		.optional()
		.describe("Plugin-specific options"),

	locales: z
		.record(z.string(), z.number().positive())
		.describe("Locale weights (e.g., { en: 0.7, de: 0.3 })"),

	fallbackLocale: z.string().describe("Fallback locale for missing data"),
});

export type GenerateConfig = z.infer<typeof GenerateConfigSchema>;

/**
 * Schema for the validate command configuration.
 */
export const ValidateConfigSchema = z.object({
	skipContent: z.boolean().describe("Skip validating message content (faster)"),
});

export type ValidateConfig = z.infer<typeof ValidateConfigSchema>;

/**
 * Root mailfuzz configuration schema.
 * This is the shape of mailfuzz.json configuration files.
 */
export const MailfuzzConfigSchema = z.object({
	$schema: z.string().optional().describe("JSON Schema URL for IDE support"),

	generate: GenerateConfigSchema.partial()
		.optional()
		.describe("Generate command configuration"),

	validate: ValidateConfigSchema.partial()
		.optional()
		.describe("Validate command configuration"),
});

export type MailfuzzConfig = z.infer<typeof MailfuzzConfigSchema>;

/**
 * Partial generate config for merging with defaults.
 */
export const PartialGenerateConfigSchema = GenerateConfigSchema.partial();
export type PartialGenerateConfig = z.infer<typeof PartialGenerateConfigSchema>;

/**
 * Partial validate config for merging with defaults.
 */
export const PartialValidateConfigSchema = ValidateConfigSchema.partial();
export type PartialValidateConfig = z.infer<typeof PartialValidateConfigSchema>;
