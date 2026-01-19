import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	GenerateConfigSchema,
	MailfuzzConfigSchema,
	ValidateConfigSchema,
} from "./schema.js";

describe("GenerateConfigSchema", () => {
	it("validates a complete config", () => {
		const config = {
			output: "./test-maildir",
			count: 500,
			seed: 12345,
			participants: 30,
			conversations: 50,
			startDate: "2025-01-01",
			endDate: "2025-12-31",
			htmlProbability: 0.8,
			replyProbability: 0.5,
			forwardProbability: 0.2,
			quiet: true,
			plugins: ["standard", "marketing"],
			allPlugins: false,
			pluginWeights: { marketing: 2.0 },
			pluginOptions: { marketing: { tone: "professional" } },
			locales: { en: 0.7, de: 0.3 },
			fallbackLocale: "en",
		};

		const result = GenerateConfigSchema.safeParse(config);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.output).toBe("./test-maildir");
			expect(result.data.count).toBe(500);
		}
	});

	it("rejects negative count", () => {
		const config = {
			output: "./maildir",
			count: -1,
			participants: 20,
			conversations: 30,
			htmlProbability: 0.7,
			replyProbability: 0.4,
			forwardProbability: 0.1,
			quiet: false,
			plugins: ["standard"],
			allPlugins: false,
			locales: { en: 1.0 },
			fallbackLocale: "en",
		};

		const result = GenerateConfigSchema.safeParse(config);
		expect(result.success).toBe(false);
	});

	it("rejects htmlProbability > 1", () => {
		const config = {
			output: "./maildir",
			count: 100,
			participants: 20,
			conversations: 30,
			htmlProbability: 1.5,
			replyProbability: 0.4,
			forwardProbability: 0.1,
			quiet: false,
			plugins: ["standard"],
			allPlugins: false,
			locales: { en: 1.0 },
			fallbackLocale: "en",
		};

		const result = GenerateConfigSchema.safeParse(config);
		expect(result.success).toBe(false);
	});

	it("rejects negative plugin weight", () => {
		const config = {
			output: "./maildir",
			count: 100,
			participants: 20,
			conversations: 30,
			htmlProbability: 0.7,
			replyProbability: 0.4,
			forwardProbability: 0.1,
			quiet: false,
			plugins: ["standard"],
			allPlugins: false,
			pluginWeights: { marketing: -1 },
			locales: { en: 1.0 },
			fallbackLocale: "en",
		};

		const result = GenerateConfigSchema.safeParse(config);
		expect(result.success).toBe(false);
	});
});

describe("ValidateConfigSchema", () => {
	it("validates a complete config", () => {
		const config = {
			skipContent: true,
		};

		const result = ValidateConfigSchema.safeParse(config);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.skipContent).toBe(true);
		}
	});
});

describe("MailfuzzConfigSchema", () => {
	it("validates a complete root config", () => {
		const config = {
			$schema: "https://mailfuzz.dev/schemas/1.0.0/schema.json",
			generate: {
				output: "./test-maildir",
				count: 100,
			},
			validate: {
				skipContent: false,
			},
		};

		const result = MailfuzzConfigSchema.safeParse(config);
		expect(result.success).toBe(true);
	});

	it("accepts partial generate config", () => {
		const config = {
			generate: {
				count: 500,
			},
		};

		const result = MailfuzzConfigSchema.safeParse(config);
		expect(result.success).toBe(true);
	});

	it("accepts empty config", () => {
		const config = {};

		const result = MailfuzzConfigSchema.safeParse(config);
		expect(result.success).toBe(true);
	});

	it("accepts config with only $schema", () => {
		const config = {
			$schema: "https://mailfuzz.dev/schemas/1.0.0/schema.json",
		};

		const result = MailfuzzConfigSchema.safeParse(config);
		expect(result.success).toBe(true);
	});
});
