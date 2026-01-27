import type { ParseArgsConfig } from "node:util";

/**
 * Metadata for a CLI option that maps to a schema field.
 */
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

/**
 * CLI option metadata for the generate command.
 * Maps CLI option names to their schema paths and parseArgs configuration.
 */
export const generateCliOptions: Record<string, CliOptionMeta> = {
	output: {
		schemaPath: "generate.output",
		short: "o",
		type: "string",
	},
	count: {
		schemaPath: "generate.count",
		short: "n",
		type: "string",
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
	},
	conversations: {
		schemaPath: "generate.conversations",
		type: "string",
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
	},
	"reply-probability": {
		schemaPath: "generate.replyProbability",
		type: "string",
	},
	"forward-probability": {
		schemaPath: "generate.forwardProbability",
		type: "string",
	},
	"unread-probability": {
		schemaPath: "generate.unreadProbability",
		type: "string",
	},
	to: {
		schemaPath: "generate.recipient",
		type: "string",
	},
	quiet: {
		schemaPath: "generate.quiet",
		short: "q",
		type: "boolean",
	},
	plugins: {
		schemaPath: "generate.plugins",
		type: "string",
	},
	"all-plugins": {
		schemaPath: "generate.allPlugins",
		type: "boolean",
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
	},
	config: {
		schemaPath: "",
		short: "c",
		type: "string",
	},
};

/**
 * CLI option metadata for the validate command.
 */
export const validateCliOptions: Record<string, CliOptionMeta> = {
	"skip-content": {
		schemaPath: "validate.skipContent",
		type: "boolean",
	},
	config: {
		schemaPath: "",
		short: "c",
		type: "string",
	},
};

/**
 * Build parseArgs options from CLI metadata.
 * Converts CliOptionMeta to the format expected by Node.js parseArgs.
 */
export const buildParseArgsOptions = (
	meta: Record<string, CliOptionMeta>,
): NonNullable<ParseArgsConfig["options"]> => {
	const options: NonNullable<ParseArgsConfig["options"]> = {};

	for (const [name, opt] of Object.entries(meta)) {
		const option: {
			type: "string" | "boolean";
			short?: string;
			multiple?: boolean;
		} = {
			type: opt.type,
		};
		if (opt.short) {
			option.short = opt.short;
		}
		if (opt.multiple) {
			option.multiple = opt.multiple;
		}
		options[name] = option;
	}

	return options;
};
