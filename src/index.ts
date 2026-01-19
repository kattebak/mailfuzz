// Main generator
export {
	MailfuzzGenerator,
	type MailfuzzGeneratorOptions,
} from "./generator/MailfuzzGenerator.js";

// Plugins
export { StandardEmailPlugin } from "./plugins/StandardEmailPlugin.js";
export {
	filterPluginsByCapability,
	isValidPluginId,
	normalizeWeights,
	pluginCanHandle,
	selectPluginByWeight,
	validateCapabilities,
	validatePlugin,
} from "./plugins/PluginInterface.js";

// Maildir
export { MaildirWriter, type WriteResult } from "./maildir/MaildirWriter.js";
export {
	FilenameGenerator,
	validateFlagOrder,
} from "./maildir/FilenameGenerator.js";

// Validation
export {
	MaildirValidator,
	validateMaildir,
} from "./validation/MaildirValidator.js";
export {
	MessageValidator,
	validateMessage,
} from "./validation/MessageValidator.js";

// Types
export type {
	Attachment,
	ContentConfig,
	Conversation,
	EmailContent,
	EmailPlugin,
	GeneratedMessage,
	GenerationConfig,
	GenerationContext,
	MaildirFlag,
	MaildirValidationResult,
	MailfuzzConfig,
	MessageValidationResult,
	OutputConfig,
	ParentMessageContext,
	Participant,
	PluginCapabilities,
	PluginsConfig,
	TimeConfig,
} from "./types.js";
