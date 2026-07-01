/**
 * Configuration module for mailfuzz.
 * Provides schema-driven configuration with JSON config file support.
 */

export {
	GenerateConfigSchema,
	ValidateConfigSchema,
	MailfuzzConfigSchema,
	ImageModeSchema,
	type ImageMode,
	type GenerateConfig,
	type ValidateConfig,
	type MailfuzzConfig,
	type PartialGenerateConfig,
	type PartialValidateConfig,
} from "./schema.js";

export {
	generateCliOptions,
	validateCliOptions,
	buildParseArgsOptions,
	type CliOptionMeta,
} from "./cli-options.js";

export {
	findConfigFile,
	loadConfigFile,
	getDefaults,
	resolveConfig,
	mergeConfigs,
	type ResolvedConfig,
} from "./config-loader.js";

export {
	mergeGenerateConfig,
	mergeValidateConfig,
	type GenerateCliValues,
	type ValidateCliValues,
} from "./config-merger.js";
