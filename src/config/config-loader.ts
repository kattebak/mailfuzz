import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import bundledDefaults from "./defaults.json" with { type: "json" };
import { type MailfuzzConfig, MailfuzzConfigSchema } from "./schema.js";

const CONFIG_FILENAMES = [
	"mailfuzz.json",
	"mailfuzz.jsonc",
	".mailfuzzrc.json",
];

/**
 * Find the nearest config file by walking up from the start directory.
 * Returns null if no config file is found.
 */
export const findConfigFile = (
	startDir: string = process.cwd(),
): string | null => {
	let currentDir = resolve(startDir);

	// Walk up to filesystem root
	while (true) {
		for (const filename of CONFIG_FILENAMES) {
			const configPath = join(currentDir, filename);
			if (existsSync(configPath)) {
				return configPath;
			}
		}
		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) {
			// Reached filesystem root
			break;
		}
		currentDir = parentDir;
	}

	return null;
};

/**
 * Load and validate a config file.
 * Throws if the file doesn't exist or fails validation.
 */
export const loadConfigFile = (configPath: string): MailfuzzConfig => {
	if (!existsSync(configPath)) {
		throw new Error(`Config file not found: ${configPath}`);
	}

	const content = readFileSync(configPath, "utf-8");

	// Strip comments for JSONC support (simple single-line comments only)
	const jsonContent = content
		.split("\n")
		.map((line) => {
			const commentIndex = line.indexOf("//");
			if (commentIndex === -1) return line;
			// Don't strip if inside a string (naive check)
			const beforeComment = line.slice(0, commentIndex);
			const quoteCount = (beforeComment.match(/"/g) ?? []).length;
			if (quoteCount % 2 === 0) {
				return beforeComment;
			}
			return line;
		})
		.join("\n");

	const parsed: unknown = JSON.parse(jsonContent);
	const result = MailfuzzConfigSchema.safeParse(parsed);

	if (!result.success) {
		const errors = result.error.errors
			.map((e) => `  ${e.path.join(".")}: ${e.message}`)
			.join("\n");
		throw new Error(`Invalid config file ${configPath}:\n${errors}`);
	}

	return result.data;
};

/**
 * Get the bundled default configuration.
 */
export const getDefaults = (): MailfuzzConfig => {
	return bundledDefaults as MailfuzzConfig;
};

/**
 * Result of resolving configuration.
 */
export interface ResolvedConfig {
	config: MailfuzzConfig;
	configPath: string | null;
}

/**
 * Resolve configuration by:
 * 1. Using explicit config path if provided
 * 2. Finding config file in directory tree
 * 3. Using bundled defaults
 */
export const resolveConfig = (explicitPath?: string): ResolvedConfig => {
	const defaults = getDefaults();

	if (explicitPath) {
		const userConfig = loadConfigFile(explicitPath);
		return {
			config: mergeConfigs(defaults, userConfig),
			configPath: explicitPath,
		};
	}

	const foundPath = findConfigFile();
	if (foundPath) {
		const userConfig = loadConfigFile(foundPath);
		return {
			config: mergeConfigs(defaults, userConfig),
			configPath: foundPath,
		};
	}

	return {
		config: defaults,
		configPath: null,
	};
};

/**
 * Deep merge two config objects.
 * Values from override take precedence over base.
 */
export const mergeConfigs = (
	base: MailfuzzConfig,
	override: MailfuzzConfig,
): MailfuzzConfig => {
	return {
		$schema: override.$schema ?? base.$schema,
		generate: mergeObjects(base.generate, override.generate),
		validate: mergeObjects(base.validate, override.validate),
	};
};

/**
 * Merge two objects, with override values taking precedence.
 * Handles nested objects and undefined values.
 */
const mergeObjects = <T extends Record<string, unknown> | undefined>(
	base: T,
	override: T,
): T => {
	if (override === undefined) return base;
	if (base === undefined) return override;

	const result: Record<string, unknown> = { ...base };

	for (const [key, value] of Object.entries(override)) {
		if (value === undefined) continue;

		const baseValue = result[key];

		// Deep merge nested objects (but not arrays)
		if (
			typeof value === "object" &&
			value !== null &&
			!Array.isArray(value) &&
			typeof baseValue === "object" &&
			baseValue !== null &&
			!Array.isArray(baseValue)
		) {
			result[key] = mergeObjects(
				baseValue as Record<string, unknown>,
				value as Record<string, unknown>,
			);
		} else {
			result[key] = value;
		}
	}

	return result as T;
};
