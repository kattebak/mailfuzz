#!/usr/bin/env node

import { parseArgs } from "node:util";
import { MailfuzzGenerator } from "./generator/mailfuzz-generator.js";
import { MaildirWriter } from "./maildir/maildir-writer.js";
import { ALL_PLUGINS, getPluginsByIds } from "./plugins/index.js";
import { validateMaildir } from "./validation/maildir-validator.js";

const HELP_TEXT = `
mailfuzz - Generate RFC-compliant synthetic emails

USAGE:
  mailfuzz generate [options]
  mailfuzz validate <maildir-path>
  mailfuzz plugins
  mailfuzz --help

COMMANDS:
  generate    Generate emails and write to a maildir
  validate    Validate an existing maildir
  plugins     List available plugins with descriptions

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
  -q, --quiet               Suppress progress output

PLUGIN SELECTION (choose one):
  --plugins <list>          Comma-separated list of plugin IDs
  --all-plugins             Use all available plugins
  --plugin <name>           Add a plugin (can be repeated)

  If no plugin option is specified, only the "standard" plugin is used.

VALIDATE OPTIONS:
  --skip-content            Skip validating message content (faster)

EXAMPLES:
  mailfuzz generate -o ./test-maildir -n 500
  mailfuzz generate --seed 12345 -n 1000 --all-plugins
  mailfuzz generate --plugins standard,marketing,newsletter
  mailfuzz generate --plugin standard --plugin spam
  mailfuzz plugins
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
		console.log();
	}
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
