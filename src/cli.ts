#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
	type GenerateCliValues,
	type GenerateConfig,
	type ImageMode,
	type ValidateCliValues,
	buildParseArgsOptions,
	generateCliOptions,
	getDefaults,
	mergeGenerateConfig,
	mergeValidateConfig,
	resolveConfig,
	validateCliOptions,
} from "./config/index.js";
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
  mailfuzz init [path]
  mailfuzz plugins
  mailfuzz locales
  mailfuzz --help

COMMANDS:
  generate    Generate emails and write to a maildir
  validate    Validate an existing maildir
  init        Create a starter mailfuzz.json config file
  plugins     List available plugins with descriptions
  locales     List available locale codes

GENERATE OPTIONS:
  -o, --output <path>       Output maildir path (default: ./maildir)
  -n, --count <number>      Number of messages to generate (default: 100)
  -s, --seed <number>       Random seed for deterministic generation
  -p, --participants <n>    Max participants in pool (default: 20)
  --conversations <n>       Max conversation threads (default: 30)
  --to <email>              Fixed recipient (all messages addressed to this)
  --start-date <date>       Oldest message date (default: 30 days ago)
  --end-date <date>         Newest message date (default: now)
  --html-probability <n>    Probability of HTML content 0-1 (default: 0.7)
  --reply-probability <n>   Probability of reply vs new (default: 0.4)
  --forward-probability <n> Probability of forward (default: 0.1)
  -w, --weight <plugin=n>   Override plugin weight (can be repeated)
  --plugin-opt <opt=val>    Set plugin option (can be repeated)
  --images <mode>           Image source: local (default) or kittens
  -q, --quiet               Suppress progress output
  -c, --config <path>       Path to config file (default: auto-detect)

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

CONFIGURATION:
  mailfuzz looks for configuration files in the current directory and parent
  directories. Supported filenames: mailfuzz.json, mailfuzz.jsonc, .mailfuzzrc.json

  CLI options override config file values.
  Use 'mailfuzz init' to create a starter configuration file.

EXAMPLES:
  mailfuzz generate -o ./test-maildir -n 500
  mailfuzz generate --seed 12345 -n 1000 --all-plugins
  mailfuzz generate --plugins standard,marketing,newsletter
  mailfuzz generate --plugin standard --plugin spam
  mailfuzz generate --locale de
  mailfuzz generate --locale en --locale de --locale fr
  mailfuzz generate --locale-weight en=0.7 --locale-weight de=0.2 --locale-weight fr=0.1
  mailfuzz generate --plugin-opt file-uploadMinSizeKb=100 --plugin-opt file-uploadMaxSizeKb=1000
  mailfuzz generate --all-plugins --images kittens
  mailfuzz generate --config ./custom-config.json
  mailfuzz init
  mailfuzz plugins
  mailfuzz locales
  mailfuzz validate ./test-maildir
`;

interface ResolvedGenerateOptions {
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
	recipient?: string;
	images: ImageMode;
}

const parseDate = (value: string): Date => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid date: ${value}`);
	}
	return date;
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
 * Validate all locale codes in the config.
 */
const validateLocales = (locales: Record<string, number>): void => {
	for (const locale of Object.keys(locales)) {
		validateLocaleCode(locale);
	}
};

/**
 * Validate plugin weight values.
 */
const validatePluginWeights = (
	weights: Record<string, number> | undefined,
): void => {
	if (!weights) return;
	for (const [pluginId, weight] of Object.entries(weights)) {
		if (weight < 0) {
			throw new Error(
				`Plugin weight must be non-negative: ${pluginId}=${weight}`,
			);
		}
	}
};

/**
 * Validate that plugin selection is mutually exclusive.
 */
const validatePluginSelection = (cliValues: GenerateCliValues): void => {
	const optionsUsed = [
		cliValues.plugins !== undefined,
		cliValues["all-plugins"] === true,
		cliValues.plugin !== undefined && cliValues.plugin.length > 0,
	].filter(Boolean).length;

	if (optionsUsed > 1) {
		throw new Error(
			"Cannot combine --plugins, --all-plugins, and --plugin options. Choose one.",
		);
	}
};

/**
 * Convert GenerateConfig to ResolvedGenerateOptions with date parsing.
 */
const resolveGenerateOptions = (
	config: GenerateConfig,
): ResolvedGenerateOptions => {
	const now = new Date();
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	// Validate locales
	validateLocales(config.locales);

	// Validate fallback locale
	validateLocaleCode(config.fallbackLocale);

	// Validate plugin weights
	validatePluginWeights(config.pluginWeights);

	// Resolve plugins
	const pluginIds = config.allPlugins
		? ALL_PLUGINS.map((p) => p.id)
		: config.plugins;

	return {
		output: config.output,
		count: config.count,
		seed: config.seed,
		participants: config.participants,
		conversations: config.conversations,
		startDate: config.startDate ? parseDate(config.startDate) : thirtyDaysAgo,
		endDate: config.endDate ? parseDate(config.endDate) : now,
		htmlProbability: config.htmlProbability,
		replyProbability: config.replyProbability,
		forwardProbability: config.forwardProbability,
		pluginWeights: config.pluginWeights ?? {},
		pluginIds,
		pluginOptions: config.pluginOptions ?? {},
		locales: config.locales,
		fallbackLocale: config.fallbackLocale,
		quiet: config.quiet,
		recipient: config.recipient,
		images: config.images,
	};
};

const parseGenerateArgs = (
	args: string[],
): { cliValues: GenerateCliValues; configPath?: string } => {
	const { values } = parseArgs({
		args,
		options: buildParseArgsOptions(generateCliOptions),
		allowPositionals: true,
	});

	return {
		cliValues: values as GenerateCliValues,
		configPath: values["config"] as string | undefined,
	};
};

const parseValidateArgs = (
	args: string[],
): { cliValues: ValidateCliValues; path: string; configPath?: string } => {
	const { values, positionals } = parseArgs({
		args,
		options: buildParseArgsOptions(validateCliOptions),
		allowPositionals: true,
	});

	const maildirPath = positionals[0];
	if (!maildirPath) {
		throw new Error("Missing maildir path argument");
	}

	return {
		cliValues: values as ValidateCliValues,
		path: maildirPath,
		configPath: values["config"] as string | undefined,
	};
};

const runGenerate = async (args: string[]): Promise<void> => {
	const { cliValues, configPath } = parseGenerateArgs(args);

	// Validate mutually exclusive plugin options
	validatePluginSelection(cliValues);

	// Load and merge configuration
	const { config, configPath: foundConfigPath } = resolveConfig(configPath);
	const mergedConfig = mergeGenerateConfig(config, cliValues);
	const options = resolveGenerateOptions(mergedConfig);

	// Resolve plugins from IDs
	const plugins = getPluginsByIds(options.pluginIds);

	const log = (msg: string) => {
		if (!options.quiet) {
			process.stderr.write(msg);
		}
	};

	if (foundConfigPath && !options.quiet) {
		log(`Using config: ${foundConfigPath}\n`);
	}

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
		recipient: options.recipient,
		images: options.images,
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
	const { cliValues, path, configPath } = parseValidateArgs(args);

	// Load and merge configuration
	const { config } = resolveConfig(configPath);
	const mergedConfig = mergeValidateConfig(config, cliValues);

	console.error(`Validating maildir: ${path}`);
	console.error(
		`Content validation: ${mergedConfig.skipContent ? "disabled" : "enabled"}`,
	);
	console.error();

	const result = await validateMaildir(path, !mergedConfig.skipContent);

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

const runInit = (args: string[]): void => {
	const targetPath = args[0] ?? "mailfuzz.json";
	const fullPath = resolve(targetPath);

	const defaults = getDefaults();
	const configContent = {
		$schema: "https://mailfuzz.dev/schemas/1.0.0/schema.json",
		...defaults,
	};

	writeFileSync(fullPath, JSON.stringify(configContent, null, "\t"));
	console.log(`Created config file: ${fullPath}`);
	console.log("\nYou can now customize this file and run 'mailfuzz generate'");
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
		case "init":
			runInit(commandArgs);
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
