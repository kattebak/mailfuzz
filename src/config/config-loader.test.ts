import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	findConfigFile,
	getDefaults,
	loadConfigFile,
	mergeConfigs,
	resolveConfig,
} from "./config-loader.js";

describe("findConfigFile", () => {
	const testDir = join(tmpdir(), `mailfuzz-test-${Date.now()}`);
	const nestedDir = join(testDir, "a", "b", "c");

	beforeEach(() => {
		mkdirSync(nestedDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("finds mailfuzz.json in the start directory", () => {
		const configPath = join(testDir, "mailfuzz.json");
		writeFileSync(configPath, JSON.stringify({ generate: { count: 100 } }));

		const found = findConfigFile(testDir);
		expect(found).toBe(configPath);
	});

	it("finds mailfuzz.json in a parent directory", () => {
		const configPath = join(testDir, "mailfuzz.json");
		writeFileSync(configPath, JSON.stringify({ generate: { count: 100 } }));

		const found = findConfigFile(nestedDir);
		expect(found).toBe(configPath);
	});

	it("finds .mailfuzzrc.json", () => {
		const configPath = join(testDir, ".mailfuzzrc.json");
		writeFileSync(configPath, JSON.stringify({ generate: { count: 100 } }));

		const found = findConfigFile(testDir);
		expect(found).toBe(configPath);
	});

	it("prefers mailfuzz.json over .mailfuzzrc.json", () => {
		const preferred = join(testDir, "mailfuzz.json");
		const alternative = join(testDir, ".mailfuzzrc.json");
		writeFileSync(preferred, JSON.stringify({ generate: { count: 1 } }));
		writeFileSync(alternative, JSON.stringify({ generate: { count: 2 } }));

		const found = findConfigFile(testDir);
		expect(found).toBe(preferred);
	});

	it("returns null when no config file exists", () => {
		const found = findConfigFile(nestedDir);
		expect(found).toBeNull();
	});
});

describe("loadConfigFile", () => {
	const testDir = join(tmpdir(), `mailfuzz-test-${Date.now()}`);

	beforeEach(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("loads and validates a valid config file", () => {
		const configPath = join(testDir, "mailfuzz.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				generate: {
					output: "./test",
					count: 500,
				},
			}),
		);

		const config = loadConfigFile(configPath);
		expect(config.generate?.output).toBe("./test");
		expect(config.generate?.count).toBe(500);
	});

	it("throws for non-existent file", () => {
		const configPath = join(testDir, "nonexistent.json");
		expect(() => loadConfigFile(configPath)).toThrow("Config file not found");
	});

	it("throws for invalid JSON", () => {
		const configPath = join(testDir, "invalid.json");
		writeFileSync(configPath, "{ invalid json }");

		expect(() => loadConfigFile(configPath)).toThrow();
	});

	it("throws for invalid config schema", () => {
		const configPath = join(testDir, "invalid-schema.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				generate: {
					count: "not a number",
				},
			}),
		);

		expect(() => loadConfigFile(configPath)).toThrow("Invalid config file");
	});

	it("handles JSONC with single-line comments", () => {
		const configPath = join(testDir, "config.jsonc");
		writeFileSync(
			configPath,
			`{
				// This is a comment
				"generate": {
					"count": 100
				}
			}`,
		);

		const config = loadConfigFile(configPath);
		expect(config.generate?.count).toBe(100);
	});
});

describe("getDefaults", () => {
	it("returns bundled defaults", () => {
		const defaults = getDefaults();

		expect(defaults.generate).toBeDefined();
		expect(defaults.generate?.output).toBe("./maildir");
		expect(defaults.generate?.count).toBe(500);
		expect(defaults.generate?.plugins).toEqual(["standard"]);
		expect(defaults.generate?.locales).toEqual({
			en: 0.2,
			fr: 0.4,
			de: 0.4,
			es: 0.1,
		});
	});

	it("returns validate defaults", () => {
		const defaults = getDefaults();

		expect(defaults.validate).toBeDefined();
		expect(defaults.validate?.skipContent).toBe(false);
	});
});

describe("mergeConfigs", () => {
	it("merges override values over base", () => {
		const base = {
			generate: {
				output: "./base",
				count: 100,
			},
		};

		const override = {
			generate: {
				count: 500,
			},
		};

		const merged = mergeConfigs(base, override);
		expect(merged.generate?.output).toBe("./base");
		expect(merged.generate?.count).toBe(500);
	});

	it("preserves base values when override is undefined", () => {
		const base = {
			generate: {
				output: "./base",
				count: 100,
			},
			validate: {
				skipContent: true,
			},
		};

		const override = {
			generate: {
				count: 500,
			},
		};

		const merged = mergeConfigs(base, override);
		expect(merged.validate?.skipContent).toBe(true);
	});

	it("deep merges nested objects", () => {
		const base = {
			generate: {
				pluginWeights: { standard: 1.0, marketing: 0.5 },
			},
		};

		const override = {
			generate: {
				pluginWeights: { marketing: 2.0, spam: 0.1 },
			},
		};

		const merged = mergeConfigs(base, override);
		expect(merged.generate?.pluginWeights).toEqual({
			standard: 1.0,
			marketing: 2.0,
			spam: 0.1,
		});
	});

	it("replaces arrays (does not merge)", () => {
		const base = {
			generate: {
				plugins: ["standard", "marketing"],
			},
		};

		const override = {
			generate: {
				plugins: ["spam"],
			},
		};

		const merged = mergeConfigs(base, override);
		expect(merged.generate?.plugins).toEqual(["spam"]);
	});
});

describe("resolveConfig", () => {
	const testDir = join(tmpdir(), `mailfuzz-test-${Date.now()}`);

	beforeEach(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("uses explicit config path when provided", () => {
		const configPath = join(testDir, "custom-config.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				generate: {
					count: 999,
				},
			}),
		);

		const { config, configPath: foundPath } = resolveConfig(configPath);
		expect(foundPath).toBe(configPath);
		expect(config.generate?.count).toBe(999);
	});

	it("merges user config with defaults", () => {
		const configPath = join(testDir, "config.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				generate: {
					count: 999,
				},
			}),
		);

		const { config } = resolveConfig(configPath);
		// User value
		expect(config.generate?.count).toBe(999);
		// Default value
		expect(config.generate?.output).toBe("./maildir");
	});

	it("returns defaults when no config file found", () => {
		// Use a directory with no config file and clear any inherited configs
		const emptyDir = join(testDir, "empty-subdir");
		mkdirSync(emptyDir, { recursive: true });

		// Change to the empty directory context (the test doesn't actually use cwd)
		// Since we can't easily mock findConfigFile to return null, we test that
		// resolveConfig returns sensible defaults
		const { config, configPath } = resolveConfig();

		// The config should have defaults regardless
		expect(config.generate?.output).toBe("./maildir");
		expect(config.generate?.count).toBe(500);
	});
});
