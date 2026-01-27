import { Faker, en } from "@faker-js/faker";
import {
	buildResolvedWeights,
	filterPluginsByCapability,
	normalizeWeights,
	selectPluginByWeight,
	validatePlugin,
	validateWeight,
} from "../plugins/plugin-interface.js";
import { StandardEmailPlugin } from "../plugins/standard-email-plugin.js";
import type { LocaleWeights, Participant } from "../types.js";
import type {
	ContentConfig,
	EmailPlugin,
	GeneratedMessage,
	GenerationConfig,
	GenerationContext,
	MaildirFlag,
	MailfuzzConfig,
	ParentMessageContext,
	TimeConfig,
} from "../types.js";
import { ConversationManager } from "./conversation-manager.js";
import { LocaleManager } from "./locale-manager.js";
import { MessageFactory } from "./message-factory.js";
import { ParticipantPool } from "./participant-pool.js";

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: MailfuzzConfig = {
	output: {
		path: "./maildir",
		format: "maildir",
	},
	generation: {
		seed: Date.now(),
		messageCount: 100,
		maxParticipants: 20,
		maxConversations: 30,
	},
	time: {
		startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
		endDate: new Date(),
	},
	plugins: {
		enabled: ["standard"],
	},
	content: {
		htmlProbability: 0.7,
		replyProbability: 0.4,
		forwardProbability: 0.1,
		unreadProbability: 0.2,
	},
};

/**
 * Options for creating a MailfuzzGenerator.
 */
export interface MailfuzzGeneratorOptions {
	seed?: number;
	messageCount?: number;
	maxParticipants?: number;
	maxConversations?: number;
	startDate?: Date;
	endDate?: Date;
	plugins?: EmailPlugin[];
	pluginWeights?: Record<string, number>;
	/** Plugin-specific options. Keys are plugin IDs, values are option objects. */
	pluginOptions?: Record<string, Record<string, unknown>>;
	htmlProbability?: number;
	replyProbability?: number;
	forwardProbability?: number;
	/**
	 * Probability of messages being unread (0-1).
	 * Unreads follow a logarithmic curve, concentrating most near the present.
	 * @default 0.2
	 */
	unreadProbability?: number;
	/**
	 * Fixed recipient email address.
	 * When set, all messages will be addressed to this recipient.
	 */
	recipient?: string;
	/**
	 * Locale weights for distribution.
	 * @example { en: 0.7, de: 0.2, fr: 0.1 }
	 */
	locales?: LocaleWeights;
	/**
	 * Fallback locale when primary locale lacks data.
	 * @default 'en'
	 */
	fallbackLocale?: string;
}

/**
 * Main email generation orchestrator.
 */
export class MailfuzzGenerator {
	private readonly faker: Faker;
	private readonly config: MailfuzzConfig;
	private readonly plugins: Map<string, EmailPlugin> = new Map();
	private pluginWeights: Record<string, number>;
	private readonly pluginOptions: Record<string, Record<string, unknown>>;
	private readonly participantPool: ParticipantPool;
	private readonly conversationManager: ConversationManager;
	private readonly messageFactory: MessageFactory;
	private readonly localeManager: LocaleManager;
	private readonly fixedRecipient: Participant | undefined;

	constructor(options: MailfuzzGeneratorOptions = {}) {
		// Build config from options and defaults
		this.config = this.buildConfig(options);

		// Initialize locale manager
		this.localeManager = new LocaleManager(
			options.locales,
			options.fallbackLocale,
		);

		// Create an independent seeded Faker instance (for non-locale-specific operations)
		this.faker = new Faker({ locale: [en] });
		this.faker.seed(this.config.generation.seed);

		// Store plugin weights and options
		this.pluginWeights = options.pluginWeights ?? {};
		this.pluginOptions = options.pluginOptions ?? {};

		// Register plugins
		const providedPlugins = options.plugins ?? [new StandardEmailPlugin()];
		for (const plugin of providedPlugins) {
			this.registerPlugin(plugin);
		}

		// Initialize components
		this.participantPool = new ParticipantPool(
			this.faker,
			this.config.generation.maxParticipants,
		);
		this.conversationManager = new ConversationManager(
			this.faker,
			this.config.generation.maxConversations,
		);
		this.messageFactory = new MessageFactory(this.faker);

		// Initialize fixed recipient if configured
		if (this.config.content.recipient) {
			this.fixedRecipient = this.parseRecipientEmail(
				this.config.content.recipient,
			);
		}
	}

	/**
	 * Parse an email address into a Participant.
	 * Uses deterministic fake name generation based on the email.
	 */
	private parseRecipientEmail(email: string): Participant {
		// Generate deterministic names from the email local part
		const localPart = email.split("@")[0] ?? "user";
		// Try to split on common separators
		const parts = localPart.split(/[._-]/);
		const firstName =
			parts[0]?.charAt(0).toUpperCase() + (parts[0]?.slice(1) ?? "") || "User";
		const lastName =
			parts.length > 1
				? parts[1]?.charAt(0).toUpperCase() + (parts[1]?.slice(1) ?? "")
				: this.faker.person.lastName();

		return { firstName, lastName, email };
	}

	/**
	 * Build full config from options and defaults.
	 */
	private buildConfig(options: MailfuzzGeneratorOptions): MailfuzzConfig {
		return {
			output: { ...DEFAULT_CONFIG.output },
			generation: {
				seed: options.seed ?? DEFAULT_CONFIG.generation.seed,
				messageCount:
					options.messageCount ?? DEFAULT_CONFIG.generation.messageCount,
				maxParticipants:
					options.maxParticipants ?? DEFAULT_CONFIG.generation.maxParticipants,
				maxConversations:
					options.maxConversations ??
					DEFAULT_CONFIG.generation.maxConversations,
			},
			time: {
				startDate: options.startDate ?? DEFAULT_CONFIG.time.startDate,
				endDate: options.endDate ?? DEFAULT_CONFIG.time.endDate,
			},
			plugins: {
				enabled: DEFAULT_CONFIG.plugins.enabled,
				weights: options.pluginWeights,
			},
			content: {
				htmlProbability:
					options.htmlProbability ?? DEFAULT_CONFIG.content.htmlProbability,
				replyProbability:
					options.replyProbability ?? DEFAULT_CONFIG.content.replyProbability,
				forwardProbability:
					options.forwardProbability ??
					DEFAULT_CONFIG.content.forwardProbability,
				unreadProbability:
					options.unreadProbability ?? DEFAULT_CONFIG.content.unreadProbability,
				recipient: options.recipient,
			},
		};
	}

	/**
	 * Register a plugin.
	 */
	registerPlugin(plugin: EmailPlugin): void {
		const validation = validatePlugin(plugin);
		if (!validation.valid) {
			throw new Error(`Invalid plugin: ${validation.errors.join("; ")}`);
		}

		if (this.plugins.has(plugin.id)) {
			throw new Error(`Plugin already registered: ${plugin.id}`);
		}

		this.plugins.set(plugin.id, plugin);
	}

	/**
	 * Get all registered plugins.
	 */
	getPlugins(): EmailPlugin[] {
		return Array.from(this.plugins.values());
	}

	/**
	 * Set or update the weight for a specific plugin.
	 * @throws Error if weight is invalid or plugin not registered
	 */
	setPluginWeight(pluginId: string, weight: number): void {
		if (!this.plugins.has(pluginId)) {
			throw new Error(`Plugin not registered: ${pluginId}`);
		}

		const validation = validateWeight(weight, pluginId);
		if (!validation.valid) {
			throw new Error(validation.error);
		}

		this.pluginWeights[pluginId] = weight;
	}

	/**
	 * Get the effective weight for a plugin.
	 * Returns: user override → plugin default → 1.0 fallback
	 */
	getPluginWeight(pluginId: string): number {
		const plugin = this.plugins.get(pluginId);
		if (!plugin) {
			throw new Error(`Plugin not registered: ${pluginId}`);
		}

		const userWeight = this.pluginWeights[pluginId];
		if (userWeight !== undefined) {
			return userWeight;
		}
		if (plugin.defaultWeight !== undefined) {
			return plugin.defaultWeight;
		}
		return 1.0;
	}

	/**
	 * Generate a stream of messages.
	 */
	async *stream(): AsyncGenerator<GeneratedMessage> {
		const { messageCount } = this.config.generation;
		const { startDate, endDate } = this.config.time;

		// Generate dates spread across the time range
		const dates = this.generateDates(messageCount, startDate, endDate);

		for (let i = 0; i < messageCount; i++) {
			const messageDate = dates[i];
			if (!messageDate) continue;

			const message = await this.generateSingleMessage(messageDate);
			yield message;
		}
	}

	/**
	 * Generate all messages and return as array.
	 */
	async generateAll(): Promise<GeneratedMessage[]> {
		const messages: GeneratedMessage[] = [];
		for await (const message of this.stream()) {
			messages.push(message);
		}
		return messages;
	}

	/**
	 * Generate a single message.
	 */
	async generateMessage(): Promise<GeneratedMessage> {
		const date = this.faker.date.between({
			from: this.config.time.startDate,
			to: this.config.time.endDate,
		});
		return this.generateSingleMessage(date);
	}

	/**
	 * Internal: Generate a single message at a specific date.
	 */
	private async generateSingleMessage(date: Date): Promise<GeneratedMessage> {
		// Determine message type (original, reply, or forward)
		const messageType = this.determineMessageType();

		// Get appropriate plugin for this message type
		const plugin = this.selectPlugin(messageType);

		// Build generation context
		const context = this.buildContext(plugin, messageType);

		// Generate content from plugin
		const content = await Promise.resolve(plugin.generate(context));

		// Use plugin-provided sender if available, otherwise use context sender
		const sender = content.sender ?? context.sender;

		// Determine message flags based on age
		const flags = this.determineFlags(date);

		// Create the message
		const message = await this.messageFactory.createMessage({
			content,
			from: sender,
			to: context.recipients,
			date,
			inReplyTo: context.parentMessage?.messageId,
			references: context.parentMessage
				? this.conversationManager.buildReferences(
						this.getConversationIdForParent(context.parentMessage.messageId),
					)
				: undefined,
			flags,
		});

		// Update conversation state
		if (messageType === "original") {
			// Newsletter and similar plugins don't allow replies to their conversations
			const allowReplies = plugin.capabilities.canBeReply !== false;
			this.conversationManager.createConversation(message, allowReplies);
		} else if (context.parentMessage) {
			const convId = this.getConversationIdForParent(
				context.parentMessage.messageId,
			);
			if (convId) {
				this.conversationManager.addToConversation(convId, message);
			}
		}

		return message;
	}

	/**
	 * Determine the type of message to generate.
	 */
	private determineMessageType(): "original" | "reply" | "forward" {
		const { replyProbability, forwardProbability } = this.config.content;

		// Can only forward if there are existing conversations
		if (this.conversationManager.count === 0) {
			return "original";
		}

		const roll = this.faker.number.float({ min: 0, max: 1 });

		// Can only reply if there are replyable conversations (not newsletters, etc.)
		if (
			roll < replyProbability &&
			this.conversationManager.replyableCount > 0
		) {
			return "reply";
		}

		if (roll < replyProbability + forwardProbability) {
			return "forward";
		}

		return "original";
	}

	/**
	 * Select an appropriate plugin for the message type.
	 */
	private selectPlugin(
		messageType: "original" | "reply" | "forward",
	): EmailPlugin {
		const allPlugins = this.getPlugins();
		const eligiblePlugins = filterPluginsByCapability(allPlugins, messageType);

		if (eligiblePlugins.length === 0) {
			// Fallback: try original if no plugins support requested type
			const fallbackPlugins = filterPluginsByCapability(allPlugins, "original");
			if (fallbackPlugins.length === 0) {
				throw new Error("No plugins available for generation");
			}
			return fallbackPlugins[0] as EmailPlugin;
		}

		// Resolve weights: user override → plugin default → 1.0
		const resolvedWeights = buildResolvedWeights(
			eligiblePlugins,
			this.pluginWeights,
		);
		const weights = normalizeWeights(eligiblePlugins, resolvedWeights);
		const random = this.faker.number.float({ min: 0, max: 1 });

		return selectPluginByWeight(eligiblePlugins, weights, random);
	}

	/**
	 * Build the generation context for a plugin.
	 */
	private buildContext(
		plugin: EmailPlugin,
		messageType: "original" | "reply" | "forward",
	): GenerationContext {
		const isReply = messageType === "reply";
		const isForward = messageType === "forward";

		// Select locale for this message and create locale-configured Faker
		const locale = this.localeManager.selectLocale(this.faker);
		const localeFaker = this.localeManager.createFakerInstance(
			locale,
			this.faker.number.int({ min: 0, max: 2147483647 }),
		);

		const requestHtml =
			plugin.capabilities.supportsHtml &&
			this.faker.number.float({ min: 0, max: 1 }) <
				this.config.content.htmlProbability;

		let sender = this.participantPool.getRandom();
		// Use fixed recipient if configured, otherwise select random recipient
		let recipients = this.fixedRecipient
			? [this.fixedRecipient]
			: [this.participantPool.getRandomExcluding([sender])];
		let parentMessage: ParentMessageContext | undefined;

		// For replies and forwards, use conversation context
		if ((isReply || isForward) && this.conversationManager.count > 0) {
			// Use replyable conversations for replies, any conversation for forwards
			const conversation = isReply
				? this.conversationManager.getRandomReplyableConversation()
				: this.conversationManager.getRandomConversation();

			if (conversation) {
				const lastMessage = conversation.lastMessage;

				parentMessage = {
					subject: lastMessage.subject,
					from: lastMessage.from,
					date: lastMessage.date,
					bodyExcerpt: this.messageFactory.getBodyExcerpt(lastMessage),
					messageId: lastMessage.messageId,
				};

				if (isReply) {
					// Reply: sender is someone from the conversation (not last sender)
					const replyCandidate =
						this.conversationManager.getReplyCandidate(conversation);
					if (replyCandidate) {
						sender = replyCandidate;
					}
					// Reply to the last sender, but use fixed recipient if configured
					recipients = this.fixedRecipient
						? [this.fixedRecipient]
						: [lastMessage.from];
				} else {
					// Forward: sender picks a new recipient not in conversation
					sender = this.faker.helpers.arrayElement(conversation.participants);
					// Use fixed recipient if configured
					recipients = this.fixedRecipient
						? [this.fixedRecipient]
						: [
								this.participantPool.getRandomExcluding(
									conversation.participants,
								),
							];
				}
			}
		}

		return {
			faker: localeFaker,
			locale,
			isReply,
			isForward,
			requestHtml,
			parentMessage,
			participants: this.participantPool.getAll(),
			sender,
			recipients,
			pluginConfig: this.pluginOptions[plugin.id],
		};
	}

	/**
	 * Determine flags for a message based on its date.
	 * Unread messages are distributed towards the present (more recent = higher chance of unread).
	 * Uses a logarithmic curve to concentrate unreads near the present with a gradual falloff.
	 */
	private determineFlags(messageDate: Date): MaildirFlag[] {
		const flags: MaildirFlag[] = [];

		const { startDate, endDate } = this.config.time;
		const totalRange = endDate.getTime() - startDate.getTime();
		const messageAge = endDate.getTime() - messageDate.getTime();

		// Calculate age ratio (0 = newest, 1 = oldest)
		const ageRatio = totalRange > 0 ? messageAge / totalRange : 0;

		// Use logarithmic curve for unread distribution
		// log(1 + (1-x)*k) / log(1+k) where x is ageRatio and k controls steepness
		// At ageRatio=0 (newest): recencyWeight = 1
		// At ageRatio=1 (oldest): recencyWeight = 0
		// k=9 gives ~70% of unreads in the most recent 30% of the time range
		const steepness = 9;
		const recencyWeight =
			Math.log(1 + (1 - ageRatio) * steepness) / Math.log(1 + steepness);
		const unreadProbability = this.config.content.unreadProbability ?? 0.2;

		// Effective unread probability: scales with recency via logarithmic curve
		// Newest messages have full unreadProbability, older messages have lower probability
		const effectiveUnreadProb = unreadProbability * recencyWeight;

		const isUnread =
			this.faker.number.float({ min: 0, max: 1 }) < effectiveUnreadProb;

		if (!isUnread) {
			flags.push("S"); // Seen
		}

		// Small chance of being flagged
		if (this.faker.number.float({ min: 0, max: 1 }) < 0.05) {
			flags.push("F");
		}

		// Sort flags alphabetically as per maildir spec
		return flags.sort() as MaildirFlag[];
	}

	/**
	 * Generate a sorted array of dates across the time range.
	 */
	private generateDates(count: number, startDate: Date, endDate: Date): Date[] {
		const dates: Date[] = [];

		for (let i = 0; i < count; i++) {
			dates.push(this.faker.date.between({ from: startDate, to: endDate }));
		}

		// Sort chronologically
		return dates.sort((a, b) => a.getTime() - b.getTime());
	}

	/**
	 * Find conversation ID containing a message ID.
	 */
	private getConversationIdForParent(messageId: string): string {
		for (const conversation of this.conversationManager.getAllConversations()) {
			if (conversation.messageIds.includes(messageId)) {
				return conversation.id;
			}
		}
		return "";
	}

	/**
	 * Get the current configuration.
	 */
	getConfig(): MailfuzzConfig {
		return { ...this.config };
	}
}
