#!/usr/bin/env node

import { parseArgs } from "node:util";
import { MailfuzzGenerator } from "./generator/MailfuzzGenerator.js";
import { MaildirWriter } from "./maildir/MaildirWriter.js";
import { StandardEmailPlugin } from "./plugins/StandardEmailPlugin.js";
import { validateMaildir } from "./validation/MaildirValidator.js";

const HELP_TEXT = `
mailfuzz - Generate RFC-compliant synthetic emails

USAGE:
  mailfuzz generate [options]
  mailfuzz validate <maildir-path>
  mailfuzz --help

COMMANDS:
  generate    Generate emails and write to a maildir
  validate    Validate an existing maildir

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
  -q, --quiet               Suppress progress output

VALIDATE OPTIONS:
  --skip-content            Skip validating message content (faster)

EXAMPLES:
  mailfuzz generate -o ./test-maildir -n 500
  mailfuzz generate --seed 12345 -n 1000
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
			quiet: { type: "boolean", short: "q", default: false },
		},
		allowPositionals: true,
	});

	const now = new Date();
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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

	const log = (msg: string) => {
		if (!options.quiet) {
			process.stderr.write(msg);
		}
	};

	log(`Generating ${options.count} emails...\n`);
	log(`Output: ${options.output}\n`);
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
		plugins: [new StandardEmailPlugin()],
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
