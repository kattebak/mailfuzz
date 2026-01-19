import type {
	GenerateConfig,
	MailfuzzConfig,
	ValidateConfig,
} from "./schema.js";

/**
 * Parsed CLI values for the generate command.
 * Values are still in string form from parseArgs.
 */
export interface GenerateCliValues {
	output?: string;
	count?: string;
	seed?: string;
	participants?: string;
	conversations?: string;
	"start-date"?: string;
	"end-date"?: string;
	"html-probability"?: string;
	"reply-probability"?: string;
	"forward-probability"?: string;
	quiet?: boolean;
	plugins?: string;
	"all-plugins"?: boolean;
	plugin?: string[];
	weight?: string[];
	"plugin-opt"?: string[];
	locale?: string[];
	"locale-weight"?: string[];
	"fallback-locale"?: string;
}

/**
 * Parsed CLI values for the validate command.
 */
export interface ValidateCliValues {
	"skip-content"?: boolean;
}

/**
 * Merge CLI values with config file values.
 * CLI values take precedence over config file values.
 * Returns a complete GenerateConfig.
 */
export const mergeGenerateConfig = (
	config: MailfuzzConfig,
	cliValues: GenerateCliValues,
): GenerateConfig => {
	const base = config.generate ?? {};

	// Parse plugin weights from CLI
	const cliPluginWeights = parsePluginWeights(cliValues.weight);

	// Parse plugin options from CLI
	const cliPluginOptions = parsePluginOptions(cliValues["plugin-opt"]);

	// Parse locales from CLI
	const cliLocales = parseLocales(cliValues.locale, cliValues["locale-weight"]);

	// Resolve plugins from CLI
	const cliPlugins = resolveCliPlugins(
		cliValues.plugins,
		cliValues["all-plugins"],
		cliValues.plugin,
	);

	return {
		output: cliValues.output ?? base.output ?? "./maildir",
		count: parseIntOrDefault(cliValues.count, base.count, 100),
		seed: parseIntOptional(cliValues.seed) ?? base.seed,
		participants: parseIntOrDefault(
			cliValues.participants,
			base.participants,
			20,
		),
		conversations: parseIntOrDefault(
			cliValues.conversations,
			base.conversations,
			30,
		),
		startDate: cliValues["start-date"] ?? base.startDate,
		endDate: cliValues["end-date"] ?? base.endDate,
		htmlProbability: parseFloatOrDefault(
			cliValues["html-probability"],
			base.htmlProbability,
			0.7,
		),
		replyProbability: parseFloatOrDefault(
			cliValues["reply-probability"],
			base.replyProbability,
			0.4,
		),
		forwardProbability: parseFloatOrDefault(
			cliValues["forward-probability"],
			base.forwardProbability,
			0.1,
		),
		quiet: cliValues.quiet ?? base.quiet ?? false,
		plugins: cliPlugins ?? base.plugins ?? ["standard"],
		allPlugins: cliValues["all-plugins"] ?? base.allPlugins ?? false,
		pluginWeights: mergeRecords(base.pluginWeights, cliPluginWeights),
		pluginOptions: mergeNestedRecords(base.pluginOptions, cliPluginOptions),
		locales:
			Object.keys(cliLocales).length > 0
				? cliLocales
				: (base.locales ?? { en: 1.0 }),
		fallbackLocale: cliValues["fallback-locale"] ?? base.fallbackLocale ?? "en",
	};
};

/**
 * Merge CLI values with config file values for validate command.
 */
export const mergeValidateConfig = (
	config: MailfuzzConfig,
	cliValues: ValidateCliValues,
): ValidateConfig => {
	const base = config.validate ?? {};

	return {
		skipContent: cliValues["skip-content"] ?? base.skipContent ?? false,
	};
};

/**
 * Parse an integer from string or return default.
 */
const parseIntOrDefault = (
	value: string | undefined,
	configValue: number | undefined,
	defaultValue: number,
): number => {
	if (value !== undefined) {
		const parsed = Number.parseInt(value, 10);
		if (!Number.isNaN(parsed)) return parsed;
	}
	return configValue ?? defaultValue;
};

/**
 * Parse an optional integer from string.
 */
const parseIntOptional = (value: string | undefined): number | undefined => {
	if (value === undefined) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
};

/**
 * Parse a float from string or return default.
 */
const parseFloatOrDefault = (
	value: string | undefined,
	configValue: number | undefined,
	defaultValue: number,
): number => {
	if (value !== undefined) {
		const parsed = Number.parseFloat(value);
		if (!Number.isNaN(parsed)) return parsed;
	}
	return configValue ?? defaultValue;
};

/**
 * Parse plugin weights from CLI --weight arguments.
 */
const parsePluginWeights = (
	weights: string[] | undefined,
): Record<string, number> | undefined => {
	if (!weights || weights.length === 0) return undefined;

	const result: Record<string, number> = {};
	for (const w of weights) {
		const [pluginId, weightStr] = w.split("=");
		if (pluginId && weightStr) {
			const weight = Number.parseFloat(weightStr);
			if (!Number.isNaN(weight) && weight >= 0) {
				result[pluginId] = weight;
			}
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
};

/**
 * Parse plugin options from CLI --plugin-opt arguments.
 */
const parsePluginOptions = (
	opts: string[] | undefined,
): Record<string, Record<string, unknown>> | undefined => {
	if (!opts || opts.length === 0) return undefined;

	const result: Record<string, Record<string, unknown>> = {};

	for (const opt of opts) {
		const eqIndex = opt.indexOf("=");
		if (eqIndex === -1) continue;

		const key = opt.slice(0, eqIndex);
		const value = opt.slice(eqIndex + 1);

		// Parse pluginIdOptionName format
		const match = /^([a-z][a-z0-9-]*)([A-Z].*)$/.exec(key);
		if (!match) continue;

		const pluginId = match[1] ?? "";
		const optionNameRaw = match[2] ?? "";
		const optionName =
			optionNameRaw.charAt(0).toLowerCase() + optionNameRaw.slice(1);

		if (!result[pluginId]) {
			result[pluginId] = {};
		}

		// Parse value type
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

	return Object.keys(result).length > 0 ? result : undefined;
};

/**
 * Parse locales from CLI --locale and --locale-weight arguments.
 */
const parseLocales = (
	locales: string[] | undefined,
	localeWeights: string[] | undefined,
): Record<string, number> => {
	const result: Record<string, number> = {};

	// Add locales with default weight 1.0
	for (const locale of locales ?? []) {
		result[locale] = 1.0;
	}

	// Add/override with weighted locales
	for (const weightArg of localeWeights ?? []) {
		const [locale, weightStr] = weightArg.split("=");
		if (locale && weightStr) {
			const weight = Number.parseFloat(weightStr);
			if (!Number.isNaN(weight) && weight > 0) {
				result[locale] = weight;
			}
		}
	}

	return result;
};

/**
 * Resolve plugin selection from CLI options.
 */
const resolveCliPlugins = (
	plugins: string | undefined,
	allPlugins: boolean | undefined,
	plugin: string[] | undefined,
): string[] | undefined => {
	if (allPlugins) {
		// Return undefined to signal all plugins should be used
		// The caller will handle this separately
		return undefined;
	}

	if (plugins) {
		return plugins.split(",").map((s) => s.trim());
	}

	if (plugin && plugin.length > 0) {
		return plugin;
	}

	return undefined;
};

/**
 * Merge two records, with override values taking precedence.
 */
const mergeRecords = <T>(
	base: Record<string, T> | undefined,
	override: Record<string, T> | undefined,
): Record<string, T> | undefined => {
	if (!override) return base;
	if (!base) return override;
	return { ...base, ...override };
};

/**
 * Merge nested records (for plugin options).
 */
const mergeNestedRecords = (
	base: Record<string, Record<string, unknown>> | undefined,
	override: Record<string, Record<string, unknown>> | undefined,
): Record<string, Record<string, unknown>> | undefined => {
	if (!override) return base;
	if (!base) return override;

	const result: Record<string, Record<string, unknown>> = { ...base };
	for (const [key, value] of Object.entries(override)) {
		result[key] = { ...(result[key] ?? {}), ...value };
	}
	return result;
};
