import { describe, expect, it } from "vitest";
import {
	type GenerateCliValues,
	type ValidateCliValues,
	mergeGenerateConfig,
	mergeValidateConfig,
} from "./config-merger.js";
import type { MailfuzzConfig } from "./schema.js";

describe("mergeGenerateConfig", () => {
	const baseConfig: MailfuzzConfig = {
		generate: {
			output: "./config-output",
			count: 100,
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
		},
		validate: {
			skipContent: false,
		},
	};

	it("CLI values override config values", () => {
		const cliValues: GenerateCliValues = {
			output: "./cli-output",
			count: "500",
		};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.output).toBe("./cli-output");
		expect(result.count).toBe(500);
	});

	it("config values used when CLI values missing", () => {
		const cliValues: GenerateCliValues = {};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.output).toBe("./config-output");
		expect(result.count).toBe(100);
	});

	it("parses seed from CLI", () => {
		const cliValues: GenerateCliValues = {
			seed: "12345",
		};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.seed).toBe(12345);
	});

	it("parses plugin weights from CLI", () => {
		const cliValues: GenerateCliValues = {
			weight: ["marketing=2.0", "spam=0.5"],
		};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.pluginWeights).toEqual({
			marketing: 2.0,
			spam: 0.5,
		});
	});

	it("parses plugin options from CLI", () => {
		const cliValues: GenerateCliValues = {
			"plugin-opt": ["file-uploadMinSizeKb=100", "file-uploadMaxSizeKb=1000"],
		};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.pluginOptions?.["file-upload"]).toEqual({
			minSizeKb: 100,
			maxSizeKb: 1000,
		});
	});

	it("parses locales from --locale flag", () => {
		const cliValues: GenerateCliValues = {
			locale: ["de", "fr"],
		};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.locales).toEqual({
			de: 1.0,
			fr: 1.0,
		});
	});

	it("parses locales from --locale-weight flag", () => {
		const cliValues: GenerateCliValues = {
			"locale-weight": ["en=0.7", "de=0.3"],
		};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.locales).toEqual({
			en: 0.7,
			de: 0.3,
		});
	});

	it("locale-weight overrides locale for same locale", () => {
		const cliValues: GenerateCliValues = {
			locale: ["en"],
			"locale-weight": ["en=0.5"],
		};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.locales).toEqual({
			en: 0.5,
		});
	});

	it("parses plugins from --plugins flag", () => {
		const cliValues: GenerateCliValues = {
			plugins: "standard,marketing,spam",
		};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.plugins).toEqual(["standard", "marketing", "spam"]);
	});

	it("parses plugins from --plugin flag", () => {
		const cliValues: GenerateCliValues = {
			plugin: ["standard", "marketing"],
		};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.plugins).toEqual(["standard", "marketing"]);
	});

	it("uses config plugins when no CLI plugin option", () => {
		const config: MailfuzzConfig = {
			generate: {
				...baseConfig.generate,
				plugins: ["marketing", "newsletter"],
			},
		};

		const cliValues: GenerateCliValues = {};

		const result = mergeGenerateConfig(config, cliValues);
		expect(result.plugins).toEqual(["marketing", "newsletter"]);
	});

	it("merges CLI plugin weights with config plugin weights", () => {
		const config: MailfuzzConfig = {
			generate: {
				...baseConfig.generate,
				pluginWeights: { standard: 1.5 },
			},
		};

		const cliValues: GenerateCliValues = {
			weight: ["marketing=2.0"],
		};

		const result = mergeGenerateConfig(config, cliValues);
		expect(result.pluginWeights).toEqual({
			standard: 1.5,
			marketing: 2.0,
		});
	});

	it("handles boolean plugin options", () => {
		const cliValues: GenerateCliValues = {
			"plugin-opt": ["marketingPromotional=true", "spamEnabled=false"],
		};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.pluginOptions?.["marketing"]).toEqual({ promotional: true });
		expect(result.pluginOptions?.["spam"]).toEqual({ enabled: false });
	});

	it("handles string plugin options", () => {
		const cliValues: GenerateCliValues = {
			"plugin-opt": ["marketingTone=professional"],
		};

		const result = mergeGenerateConfig(baseConfig, cliValues);
		expect(result.pluginOptions?.["marketing"]).toEqual({
			tone: "professional",
		});
	});

	it("uses default values when config is empty", () => {
		const emptyConfig: MailfuzzConfig = {};
		const cliValues: GenerateCliValues = {};

		const result = mergeGenerateConfig(emptyConfig, cliValues);
		expect(result.output).toBe("./maildir");
		expect(result.count).toBe(100);
		expect(result.participants).toBe(20);
		expect(result.conversations).toBe(30);
		expect(result.htmlProbability).toBe(0.7);
		expect(result.replyProbability).toBe(0.4);
		expect(result.forwardProbability).toBe(0.1);
		expect(result.quiet).toBe(false);
		expect(result.plugins).toEqual(["standard"]);
		expect(result.locales).toEqual({ en: 1.0 });
		expect(result.fallbackLocale).toBe("en");
	});
});

describe("mergeValidateConfig", () => {
	const baseConfig: MailfuzzConfig = {
		validate: {
			skipContent: false,
		},
	};

	it("CLI values override config values", () => {
		const cliValues: ValidateCliValues = {
			"skip-content": true,
		};

		const result = mergeValidateConfig(baseConfig, cliValues);
		expect(result.skipContent).toBe(true);
	});

	it("config values used when CLI values missing", () => {
		const config: MailfuzzConfig = {
			validate: {
				skipContent: true,
			},
		};
		const cliValues: ValidateCliValues = {};

		const result = mergeValidateConfig(config, cliValues);
		expect(result.skipContent).toBe(true);
	});

	it("uses default values when config is empty", () => {
		const emptyConfig: MailfuzzConfig = {};
		const cliValues: ValidateCliValues = {};

		const result = mergeValidateConfig(emptyConfig, cliValues);
		expect(result.skipContent).toBe(false);
	});
});
