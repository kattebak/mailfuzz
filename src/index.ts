// Main generator
export {
	MailfuzzGenerator,
	type MailfuzzGeneratorOptions,
} from "./generator/mailfuzz-generator.js";

// Plugins
export { StandardEmailPlugin } from "./plugins/standard-email-plugin.js";
export {
	filterPluginsByCapability,
	isValidPluginId,
	normalizeWeights,
	pluginCanHandle,
	selectPluginByWeight,
	validateCapabilities,
	validatePlugin,
} from "./plugins/plugin-interface.js";

// Maildir
export { MaildirWriter, type WriteResult } from "./maildir/maildir-writer.js";
export {
	FilenameGenerator,
	validateFlagOrder,
} from "./maildir/filename-generator.js";

// Validation
export {
	MaildirValidator,
	validateMaildir,
} from "./validation/maildir-validator.js";
export {
	MessageValidator,
	validateMessage,
} from "./validation/message-validator.js";

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
