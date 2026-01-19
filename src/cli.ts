#!/usr/bin/env node

import { parseArgs } from "node:util";
import { AVAILABLE_LOCALES } from "./generator/locale-manager.js";
import { MailfuzzGenerator } from "./generator/mailfuzz-generator.js";
import { MaildirWriter } from "./maildir/maildir-writer.js";
import { ALL_PLUGINS, getPluginsByIds } from "./plugins/index.js";
import type { LocaleWeights } from "./types.js";
import { validateMaildir } from "./validation/maildir-validator.js";

const HELP_TEXT = `
mailfuzz - Generate RFC-compliant synthetic emails

USAGE:
  mailfuzz generate [options]
  mailfuzz validate <maildir-path>
  mailfuzz plugins
  mailfuzz locales
  mailfuzz --help

COMMANDS:
  generate    Generate emails and write to a maildir
  validate    Validate an existing maildir
  plugins     List available plugins with descriptions
  locales     List available locale codes

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
  -w, --weight <plugin=n>   Override plugin weight (can be repeated)
  --plugin-opt <opt=val>    Set plugin option (can be repeated)
  -q, --quiet               Suppress progress output

PLUGIN SELECTION (choose one):
  --plugins <list>          Comma-separated list of plugin IDs
  --all-plugins             Use all available plugins
  --plugin <name>           Add a plugin (can be repeated)

  If no plugin option is specified, only the "standard" plugin is used.

LOCALE OPTIONS:
  --locale <code>           Add a locale with weight 1.0 (can be repeated)
  --locale-weight <code=n>  Set locale with specific weight (can be repeated)
  --fallback-locale <code>  Fallback locale for missing data (default: en)

  If no locale option is specified, English (en) is used.
  Run 'mailfuzz locales' to see available locale codes.

PLUGIN OPTIONS:
  Format: --plugin-opt pluginIdOptionName=value
  Plugin options are specified by concatenating the plugin ID and option name.
  Use 'mailfuzz plugins' to see available options for each plugin.

VALIDATE OPTIONS:
  --skip-content            Skip validating message content (faster)

EXAMPLES:
  mailfuzz generate -o ./test-maildir -n 500
  mailfuzz generate --seed 12345 -n 1000 --all-plugins
  mailfuzz generate --plugins standard,marketing,newsletter
  mailfuzz generate --plugin standard --plugin spam
  mailfuzz generate --locale de
  mailfuzz generate --locale en --locale de --locale fr
  mailfuzz generate --locale-weight en=0.7 --locale-weight de=0.2 --locale-weight fr=0.1
  mailfuzz generate --plugin-opt file-uploadMinSizeKb=100 --plugin-opt file-uploadMaxSizeKb=1000
  mailfuzz plugins
  mailfuzz locales
  mailfuzz validate ./test-maildir
`;

interface GenerateOptions {
	output: string;
	count: number;
	seed?: number;
	participants: number;
	conversations: number;
	startDate: Date;
	endDate: Date;
	htmlProbability: number;
	replyProbability: number;
	forwardProbability: number;
	pluginWeights: Record<string, number>;
	pluginIds: string[];
	pluginOptions: Record<string, Record<string, unknown>>;
	locales: LocaleWeights;
	fallbackLocale: string;
	quiet: boolean;
}

interface ValidateOptions {
	path: string;
	skipContent: boolean;
}

const parseDate = (value: string): Date => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid date: ${value}`);
	}
	return date;
};

const parseWeight = (
	weightArg: string,
): { pluginId: string; weight: number } => {
	const [pluginId, weightStr] = weightArg.split("=");
	if (!pluginId || !weightStr) {
		throw new Error(`Invalid weight format: ${weightArg}. Use: plugin=number`);
	}
	const weight = Number.parseFloat(weightStr);
	if (Number.isNaN(weight)) {
		throw new Error(`Invalid weight value: ${weightStr}`);
	}
	if (weight < 0) {
		throw new Error(`Weight must be non-negative: ${weight}`);
	}
	return { pluginId, weight };
};

/**
 * Parse a plugin option from CLI format: pluginIdOptionName=value
 * The plugin ID uses hyphens, option names use camelCase.
 * Example: file-uploadMinSizeKb=100 -> { pluginId: "file-upload", optionName: "minSizeKb", value: "100" }
 */
const parsePluginOption = (
	optArg: string,
): { pluginId: string; optionName: string; value: string } => {
	const eqIndex = optArg.indexOf("=");
	if (eqIndex === -1) {
		throw new Error(
			`Invalid plugin option format: ${optArg}. Use: pluginIdOptionName=value`,
		);
	}

	const key = optArg.slice(0, eqIndex);
	const value = optArg.slice(eqIndex + 1);

	// Find the split point: look for first uppercase letter that follows a lowercase
	// This handles: file-uploadMinSizeKb -> file-upload + minSizeKb
	const match = /^([a-z][a-z0-9-]*)([A-Z].*)$/.exec(key);
	if (!match) {
		throw new Error(
			`Invalid plugin option key: ${key}. Format: pluginIdOptionName (e.g., file-uploadMinSizeKb)`,
		);
	}

	const pluginId = match[1] ?? "";
	const optionNameRaw = match[2] ?? "";
	// Convert first char to lowercase for option name
	const optionName =
		optionNameRaw.charAt(0).toLowerCase() + optionNameRaw.slice(1);

	return { pluginId, optionName, value };
};

/**
 * Parse plugin options array into structured object.
 */
const parsePluginOptions = (
	opts: string[] | undefined,
): Record<string, Record<string, unknown>> => {
	const result: Record<string, Record<string, unknown>> = {};

	for (const opt of opts ?? []) {
		const { pluginId, optionName, value } = parsePluginOption(opt);

		if (!result[pluginId]) {
			result[pluginId] = {};
		}

		// Try to parse as number or boolean
		const numValue = Number.parseFloat(value);
		if (!Number.isNaN(numValue)) {
			result[pluginId][optionName] = numValue;
		} else if (value === "true") {
			result[pluginId][optionName] = true;
		} else if (value === "false") {
			result[pluginId][optionName] = false;
		} else {
			result[pluginId][optionName] = value;
		}
	}

	return result;
};

/**
 * Parse locale weight from CLI format: code=weight
 */
const parseLocaleWeight = (
	weightArg: string,
): { locale: string; weight: number } => {
	const [locale, weightStr] = weightArg.split("=");
	if (!locale || !weightStr) {
		throw new Error(
			`Invalid locale weight format: ${weightArg}. Use: locale=number (e.g., en=0.7)`,
		);
	}
	const weight = Number.parseFloat(weightStr);
	if (Number.isNaN(weight)) {
		throw new Error(`Invalid weight value: ${weightStr}`);
	}
	if (weight < 0) {
		throw new Error(`Weight must be non-negative: ${weight}`);
	}
	return { locale, weight };
};

/**
 * Validate a locale code and throw a helpful error if invalid.
 */
const validateLocaleCode = (locale: string): void => {
	if (!AVAILABLE_LOCALES.includes(locale)) {
		const suggestions = AVAILABLE_LOCALES.filter((l) =>
			l.toLowerCase().startsWith(locale.toLowerCase().slice(0, 2)),
		).slice(0, 5);
		const suggestionText =
			suggestions.length > 0 ? ` Did you mean: ${suggestions.join(", ")}?` : "";
		throw new Error(
			`Invalid locale code: '${locale}'.${suggestionText} Run 'mailfuzz locales' to see all available locale codes.`,
		);
	}
};

/**
 * Parse locale configuration from CLI options.
 * Supports: --locale code (weight 1.0) | --locale-weight code=weight
 * Returns default { en: 1.0 } if no locale options provided.
 */
const parseLocaleConfig = (
	locales: string[] | undefined,
	localeWeights: string[] | undefined,
	fallbackLocale: string | undefined,
): { locales: LocaleWeights; fallbackLocale: string } => {
	const result: LocaleWeights = {};

	// Add locales with default weight 1.0
	for (const locale of locales ?? []) {
		validateLocaleCode(locale);
		result[locale] = 1.0;
	}

	// Add/override with weighted locales
	for (const weightArg of localeWeights ?? []) {
		const { locale, weight } = parseLocaleWeight(weightArg);
		validateLocaleCode(locale);
		result[locale] = weight;
	}

	// Validate fallback locale if provided
	const fallback = fallbackLocale ?? "en";
	if (fallbackLocale) {
		validateLocaleCode(fallbackLocale);
	}

	// Default to { en: 1.0 } if no locales specified
	if (Object.keys(result).length === 0) {
		result["en"] = 1.0;
	}

	return { locales: result, fallbackLocale: fallback };
};

/**
 * Parse plugin selection from CLI options.
 * Supports: --plugins a,b,c | --all-plugins | --plugin a --plugin b
 * Defaults to ["standard"] if no plugin option is provided.
 */
const parsePluginSelection = (
	plugins: string | undefined,
	allPlugins: boolean,
	plugin: string[] | undefined,
): string[] => {
	const optionsUsed = [
		plugins !== undefined,
		allPlugins,
		plugin !== undefined && plugin.length > 0,
	].filter(Boolean).length;

	if (optionsUsed > 1) {
		throw new Error(
			"Cannot combine --plugins, --all-plugins, and --plugin options. Choose one.",
		);
	}

	if (allPlugins) {
		return ALL_PLUGINS.map((p) => p.id);
	}

	if (plugins) {
		return plugins.split(",").map((s) => s.trim());
	}

	if (plugin && plugin.length > 0) {
		return plugin;
	}

	// Default to standard plugin
	return ["standard"];
};

const parseGenerateArgs = (args: string[]): GenerateOptions => {
	const { values } = parseArgs({
		args,
		options: {
			output: { type: "string", short: "o", default: "./maildir" },
			count: { type: "string", short: "n", default: "100" },
			seed: { type: "string", short: "s" },
			participants: { type: "string", short: "p", default: "20" },
			conversations: { type: "string", default: "30" },
			"start-date": { type: "string" },
			"end-date": { type: "string" },
			"html-probability": { type: "string", default: "0.7" },
			"reply-probability": { type: "string", default: "0.4" },
			"forward-probability": { type: "string", default: "0.1" },
			weight: { type: "string", short: "w", multiple: true },
			quiet: { type: "boolean", short: "q", default: false },
			plugins: { type: "string" },
			"all-plugins": { type: "boolean", default: false },
			plugin: { type: "string", multiple: true },
			"plugin-opt": { type: "string", multiple: true },
			locale: { type: "string", multiple: true },
			"locale-weight": { type: "string", multiple: true },
			"fallback-locale": { type: "string" },
		},
		allowPositionals: true,
	});

	const now = new Date();
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	// Parse weight overrides
	const pluginWeights: Record<string, number> = {};
	for (const w of values.weight ?? []) {
		const { pluginId, weight } = parseWeight(w);
		pluginWeights[pluginId] = weight;
	}

	// Parse plugin selection
	const pluginIds = parsePluginSelection(
		values.plugins,
		values["all-plugins"] ?? false,
		values.plugin,
	);

	// Parse plugin options
	const pluginOptions = parsePluginOptions(values["plugin-opt"]);

	// Parse locale configuration
	const { locales, fallbackLocale } = parseLocaleConfig(
		values.locale,
		values["locale-weight"],
		values["fallback-locale"],
	);

	return {
		output: values.output ?? "./maildir",
		count: Number.parseInt(values.count ?? "100", 10),
		seed: values.seed ? Number.parseInt(values.seed, 10) : undefined,
		participants: Number.parseInt(values.participants ?? "20", 10),
		conversations: Number.parseInt(values.conversations ?? "30", 10),
		startDate: values["start-date"]
			? parseDate(values["start-date"])
			: thirtyDaysAgo,
		endDate: values["end-date"] ? parseDate(values["end-date"]) : now,
		htmlProbability: Number.parseFloat(values["html-probability"] ?? "0.7"),
		replyProbability: Number.parseFloat(values["reply-probability"] ?? "0.4"),
		forwardProbability: Number.parseFloat(
			values["forward-probability"] ?? "0.1",
		),
		pluginWeights,
		pluginIds,
		pluginOptions,
		locales,
		fallbackLocale,
		quiet: values.quiet ?? false,
	};
};

const parseValidateArgs = (args: string[]): ValidateOptions => {
	const { values, positionals } = parseArgs({
		args,
		options: {
			"skip-content": { type: "boolean", default: false },
		},
		allowPositionals: true,
	});

	const maildirPath = positionals[0];
	if (!maildirPath) {
		throw new Error("Missing maildir path argument");
	}

	return {
		path: maildirPath,
		skipContent: values["skip-content"] ?? false,
	};
};

const runGenerate = async (args: string[]): Promise<void> => {
	const options = parseGenerateArgs(args);

	// Resolve plugins from IDs
	const plugins = getPluginsByIds(options.pluginIds);

	const log = (msg: string) => {
		if (!options.quiet) {
			process.stderr.write(msg);
		}
	};

	log(`Generating ${options.count} emails...\n`);
	log(`Output: ${options.output}\n`);
	log(`Plugins: ${plugins.map((p) => p.id).join(", ")}\n`);
	const localeList = Object.keys(options.locales).join(", ");
	log(`Locales: ${localeList}\n`);
	if (options.seed !== undefined) {
		log(`Seed: ${options.seed}\n`);
	}
	log("\n");

	const generator = new MailfuzzGenerator({
		seed: options.seed,
		messageCount: options.count,
		maxParticipants: options.participants,
		maxConversations: options.conversations,
		startDate: options.startDate,
		endDate: options.endDate,
		plugins,
		pluginWeights: options.pluginWeights,
		pluginOptions: options.pluginOptions,
		locales: options.locales,
		fallbackLocale: options.fallbackLocale,
		htmlProbability: options.htmlProbability,
		replyProbability: options.replyProbability,
		forwardProbability: options.forwardProbability,
	});

	const writer = new MaildirWriter(options.output);

	const startTime = Date.now();

	const result = await writer.writeFromGenerator(
		generator.stream(),
		(written) => {
			if (!options.quiet && written % 10 === 0) {
				process.stderr.write(`\rGenerated ${written}/${options.count}...`);
			}
		},
	);

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

	log("\r");
	log(`\nGeneration complete in ${elapsed}s\n`);
	log(`  Total written: ${result.totalWritten}\n`);
	log(`  New (unread):  ${result.newMessages}\n`);
	log(`  Cur (read):    ${result.curMessages}\n`);

	if (result.errors.length > 0) {
		log("\nErrors:\n");
		for (const error of result.errors) {
			log(`  ${error.messageId}: ${error.error}\n`);
		}
		process.exit(1);
	}
};

const runValidate = async (args: string[]): Promise<void> => {
	const options = parseValidateArgs(args);

	console.error(`Validating maildir: ${options.path}`);
	console.error(
		`Content validation: ${options.skipContent ? "disabled" : "enabled"}`,
	);
	console.error();

	const result = await validateMaildir(options.path, !options.skipContent);

	console.log(`Valid: ${result.valid ? "yes" : "no"}`);
	console.log(`Messages: ${result.messageCount}`);

	if (result.errors.length > 0) {
		console.log(`\nErrors (${result.errors.length}):`);
		for (const error of result.errors) {
			console.log(`  - ${error}`);
		}
	}

	if (result.warnings.length > 0) {
		console.log(`\nWarnings (${result.warnings.length}):`);
		for (const warning of result.warnings) {
			console.log(`  - ${warning}`);
		}
	}

	process.exit(result.valid ? 0 : 1);
};

const runListPlugins = (): void => {
	console.log("Available plugins:\n");

	for (const plugin of ALL_PLUGINS) {
		const capabilities: string[] = [];
		if (plugin.capabilities.canBeOriginal ?? true)
			capabilities.push("original");
		if (plugin.capabilities.canBeReply) capabilities.push("reply");
		if (plugin.capabilities.canBeForward) capabilities.push("forward");
		if (plugin.capabilities.supportsHtml) capabilities.push("html");
		if (plugin.capabilities.supportsAttachments)
			capabilities.push("attachments");

		console.log(`  ${plugin.id}`);
		console.log(`    Name: ${plugin.name}`);
		console.log(`    Description: ${plugin.description}`);
		console.log(`    Weight: ${plugin.defaultWeight ?? 1.0}`);
		console.log(`    Capabilities: ${capabilities.join(", ")}`);

		if (plugin.options && Object.keys(plugin.options).length > 0) {
			console.log("    Options:");
			for (const [optName, optSchema] of Object.entries(plugin.options)) {
				const defaultStr =
					optSchema.default !== undefined
						? ` (default: ${optSchema.default})`
						: "";
				console.log(
					`      --plugin-opt ${plugin.id}${optName.charAt(0).toUpperCase()}${optName.slice(1)}=<${optSchema.type}>${defaultStr}`,
				);
				console.log(`        ${optSchema.description}`);
			}
		}
		console.log();
	}
};

const runListLocales = (): void => {
	console.log("Available locale codes:\n");

	// Group locales by language prefix
	const grouped: Record<string, string[]> = {};
	for (const locale of AVAILABLE_LOCALES) {
		const prefix = locale.split("_")[0] ?? locale;
		if (!grouped[prefix]) {
			grouped[prefix] = [];
		}
		grouped[prefix].push(locale);
	}

	// Sort by prefix and display
	const sortedPrefixes = Object.keys(grouped).sort();
	for (const prefix of sortedPrefixes) {
		const locales = grouped[prefix] ?? [];
		console.log(`  ${locales.join(", ")}`);
	}

	console.log(`\nTotal: ${AVAILABLE_LOCALES.length} locales\n`);
	console.log("Usage examples:");
	console.log("  mailfuzz generate --locale de");
	console.log(
		"  mailfuzz generate --locale-weight en=0.7 --locale-weight de=0.3",
	);
};

const main = async (): Promise<void> => {
	const args = process.argv.slice(2);

	if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
		console.log(HELP_TEXT);
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
		default:
			console.error(`Unknown command: ${command}`);
			console.error("Run 'mailfuzz --help' for usage");
			process.exit(1);
	}
};

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
