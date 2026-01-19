import type { Faker } from "@faker-js/faker";

/**
 * Represents a participant in email communication.
 */
export interface Participant {
	firstName: string;
	lastName: string;
	email: string;
}

/**
 * Declares what types of email content a plugin can generate.
 * All capabilities default to `false` if not specified.
 */
export interface PluginCapabilities {
	/**
	 * Can this plugin generate content for a reply email?
	 * When `true`: Plugin will receive `isReply: true` contexts.
	 * When `false`: Plugin will never be selected for reply contexts.
	 */
	canBeReply: boolean;

	/**
	 * Can this plugin generate content for a forwarded email?
	 * When `true`: Plugin will receive `isForward: true` contexts.
	 * When `false`: Plugin will never be selected for forward contexts.
	 */
	canBeForward: boolean;

	/**
	 * Can this plugin generate a new/original email (not reply or forward)?
	 * When `true`: Plugin can generate original conversation starters.
	 * When `false`: Plugin can only generate replies or forwards.
	 * @default true
	 */
	canBeOriginal?: boolean;

	/**
	 * Can this plugin generate HTML content?
	 * When `true`: The `generate()` return value MAY include an `html` field.
	 * When `false`: The engine will not request HTML from this plugin.
	 */
	supportsHtml: boolean;

	/**
	 * Can this plugin generate emails with attachments?
	 * When `true`: The `generate()` return value MAY include `attachments`.
	 * When `false`: The engine will not expect attachments from this plugin.
	 */
	supportsAttachments: boolean;

	/**
	 * Can this plugin generate content for multi-recipient emails?
	 * When `true`: Plugin may be used for emails with multiple To/Cc recipients.
	 * When `false`: Plugin only generates 1:1 correspondence.
	 * @default true
	 */
	supportsMultipleRecipients?: boolean;
}

/**
 * Context about the parent message when generating a reply or forward.
 */
export interface ParentMessageContext {
	/** Original message subject */
	subject: string;

	/** Original message sender */
	from: Participant;

	/** Original message date */
	date: Date;

	/** Body excerpt for quoting (first ~500 chars) */
	bodyExcerpt: string;

	/** Message-ID for threading headers */
	messageId: string;
}

/**
 * Context provided to plugins during content generation.
 */
export interface GenerationContext {
	/**
	 * Seeded Faker instance for deterministic generation.
	 * All random values MUST come from this instance.
	 * The Faker instance is pre-configured with the selected locale.
	 */
	faker: Faker;

	/**
	 * The Faker.js locale code selected for this message.
	 * Plugins can use this for locale-aware content decisions.
	 * @example 'de', 'fr', 'en_US'
	 * @default 'en'
	 */
	locale: string;

	/**
	 * Is the engine requesting reply content?
	 * Only `true` if plugin declared `canBeReply: true`.
	 */
	isReply: boolean;

	/**
	 * Is the engine requesting forward content?
	 * Only `true` if plugin declared `canBeForward: true`.
	 */
	isForward: boolean;

	/**
	 * Should the plugin generate HTML content?
	 * Only `true` if plugin declared `supportsHtml: true`.
	 */
	requestHtml: boolean;

	/**
	 * The parent message when `isReply` or `isForward` is true.
	 */
	parentMessage?: ParentMessageContext;

	/**
	 * Participants available for this email.
	 */
	participants: Participant[];

	/**
	 * The selected sender for this email.
	 */
	sender: Participant;

	/**
	 * The selected recipients for this email.
	 */
	recipients: Participant[];

	/**
	 * Plugin-specific configuration from user config.
	 */
	pluginConfig?: Record<string, unknown>;
}

/**
 * Attachment for an email message.
 */
export interface Attachment {
	/** Filename shown to recipient */
	filename: string;

	/** MIME content type */
	contentType: string;

	/** Raw content as Buffer */
	content: Buffer;

	/** Content-ID for inline images (cid:) */
	cid?: string;
}

/**
 * Content returned by a plugin's generate method.
 */
export interface EmailContent {
	/**
	 * Email subject line.
	 * For replies, should typically start with "Re: "
	 * For forwards, should typically start with "Fwd: "
	 */
	subject: string;

	/**
	 * Plain text body content.
	 * REQUIRED - always provide text version.
	 */
	text: string;

	/**
	 * HTML body content.
	 * Only returned if `supportsHtml: true` and `context.requestHtml: true`.
	 */
	html?: string;

	/**
	 * Email attachments.
	 * Only returned if `supportsAttachments: true`.
	 */
	attachments?: Attachment[];

	/**
	 * Optional custom headers.
	 * Merged with engine-generated headers (engine headers take precedence).
	 */
	headers?: Record<string, string>;
}

/**
 * Schema definition for a plugin option.
 */
export interface PluginOptionSchema {
	/** Type of the option value */
	type: "string" | "number" | "boolean";
	/** Description shown in help text */
	description: string;
	/** Default value if not specified */
	default?: string | number | boolean;
}

/**
 * Base interface for all Mailfuzz email generation plugins.
 */
export interface EmailPlugin {
	/**
	 * Unique identifier for this plugin.
	 * Must be lowercase alphanumeric with hyphens.
	 * @example "standard", "marketing", "calendar-invite"
	 */
	readonly id: string;

	/**
	 * Human-readable display name.
	 * @example "Standard Email", "Marketing Newsletter"
	 */
	readonly name: string;

	/**
	 * Brief description of what this plugin generates.
	 * @example "Personal and business correspondence"
	 */
	readonly description: string;

	/**
	 * Declares what this plugin can and cannot do.
	 */
	readonly capabilities: PluginCapabilities;

	/**
	 * Default weight for this plugin in the generation distribution.
	 * Represents expected frequency relative to other plugins.
	 * Guidelines: 1.0 = baseline, 0.5 = half as common, 2.0 = twice as common
	 * @default 1.0
	 */
	readonly defaultWeight?: number;

	/**
	 * Schema for plugin-specific options.
	 * Keys are option names (camelCase), values describe the option.
	 * CLI format: --plugin-opt pluginIdOptionName=value
	 */
	readonly options?: Record<string, PluginOptionSchema>;

	/**
	 * Generate email content for the given context.
	 */
	generate(context: GenerationContext): EmailContent | Promise<EmailContent>;
}

/**
 * Output configuration for generated emails.
 */
export interface OutputConfig {
	/** Maildir output path */
	path: string;

	/** Output format (currently only maildir supported) */
	format: "maildir";
}

/**
 * Generation parameters configuration.
 */
export interface GenerationConfig {
	/** Master random seed for deterministic generation */
	seed: number;

	/** Total messages to generate */
	messageCount: number;

	/** Size of participant pool */
	maxParticipants: number;

	/** Maximum number of conversation threads */
	maxConversations: number;
}

/**
 * Time range configuration for message dates.
 */
export interface TimeConfig {
	/** Oldest message date */
	startDate: Date;

	/** Newest message date */
	endDate: Date;
}

/**
 * Plugin configuration.
 */
export interface PluginsConfig {
	/** Plugin IDs to use */
	enabled: string[];

	/** Plugin weights for selection probability */
	weights?: Record<string, number>;

	/** Plugin-specific options */
	options?: Record<string, unknown>;
}

/**
 * Content generation probabilities.
 */
export interface ContentConfig {
	/** Probability of generating HTML content (0-1) */
	htmlProbability: number;

	/** Probability of generating a reply vs new message (0-1) */
	replyProbability: number;

	/** Probability of generating a forward (0-1) */
	forwardProbability: number;

	/**
	 * Probability of messages being unread (0-1).
	 * Unreads are distributed towards the present (more recent = higher chance of unread).
	 * @default 0.2
	 */
	unreadProbability?: number;

	/**
	 * Fixed recipient email address.
	 * When set, all messages will be addressed to this recipient.
	 */
	recipient?: string;
}

/**
 * Locale weight configuration.
 * Keys are Faker.js locale codes (e.g., 'en', 'de', 'fr', 'de_AT').
 * Values are relative weights (will be normalized to sum to 1.0).
 * @example { en: 0.7, de: 0.2, fr: 0.1 }
 */
export type LocaleWeights = Record<string, number>;

/**
 * Locale configuration for email generation.
 */
export interface LocaleConfig {
	/**
	 * Locale weights for distribution.
	 * Keys are Faker.js locale codes, values are relative weights.
	 * If empty or undefined, defaults to { en: 1.0 }
	 * @example { en: 0.7, de: 0.2, fr: 0.1 }
	 */
	weights: LocaleWeights;

	/**
	 * Fallback locale when primary locale lacks data.
	 * @default 'en'
	 */
	fallbackLocale?: string;
}

/**
 * Complete Mailfuzz configuration schema.
 */
export interface MailfuzzConfig {
	output: OutputConfig;
	generation: GenerationConfig;
	time: TimeConfig;
	plugins: PluginsConfig;
	content: ContentConfig;
	/** Locale configuration for multilingual email generation */
	locale?: LocaleConfig;
}

/**
 * Maildir message flags per RFC specification.
 * Must be in alphabetical order: DFPRST
 */
export type MaildirFlag = "D" | "F" | "P" | "R" | "S" | "T";

/**
 * Internal message representation during generation.
 */
export interface GeneratedMessage {
	/** Unique Message-ID */
	messageId: string;

	/** Message date */
	date: Date;

	/** Sender participant */
	from: Participant;

	/** Recipient participants */
	to: Participant[];

	/** CC recipients */
	cc?: Participant[];

	/** Email subject */
	subject: string;

	/** Plain text body */
	text: string;

	/** HTML body */
	html?: string;

	/** Threading: parent Message-ID */
	inReplyTo?: string;

	/** Threading: chain of Message-IDs */
	references?: string[];

	/** Attachments */
	attachments?: Attachment[];

	/** Custom headers */
	headers?: Record<string, string>;

	/** Raw RFC 2822 message buffer */
	raw?: Buffer;

	/** Maildir flags to apply */
	flags: MaildirFlag[];
}

/**
 * Conversation thread state.
 */
export interface Conversation {
	/** Unique conversation identifier */
	id: string;

	/** All Message-IDs in this thread (for References header) */
	messageIds: string[];

	/** Most recent message for reply context */
	lastMessage: GeneratedMessage;

	/** Participants involved in this conversation */
	participants: Participant[];

	/** Original subject line */
	subject: string;

	/**
	 * Whether this conversation can receive replies.
	 * False for newsletters, marketing emails, etc.
	 */
	allowReplies: boolean;
}

/**
 * Validation result for a single message.
 */
export interface MessageValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Validation result for a maildir.
 */
export interface MaildirValidationResult {
	valid: boolean;
	messageCount: number;
	errors: string[];
	warnings: string[];
}
