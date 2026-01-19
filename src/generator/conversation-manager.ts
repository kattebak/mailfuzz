import type { Faker } from "@faker-js/faker";
import type { Conversation, GeneratedMessage, Participant } from "../types.js";

/**
 * Manages conversation threads and threading state.
 */
export class ConversationManager {
	private conversations: Map<string, Conversation> = new Map();
	private readonly faker: Faker;
	private readonly maxConversations: number;
	private conversationCounter = 0;

	constructor(faker: Faker, maxConversations: number) {
		this.faker = faker;
		this.maxConversations = maxConversations;
	}

	/**
	 * Create a new conversation from an original message.
	 */
	createConversation(message: GeneratedMessage): Conversation {
		const id = `conv-${++this.conversationCounter}`;
		const conversation: Conversation = {
			id,
			messageIds: [message.messageId],
			lastMessage: message,
			participants: [message.from, ...message.to],
			subject: message.subject,
		};

		// If we're at max conversations, remove the oldest
		if (this.conversations.size >= this.maxConversations) {
			const firstKey = this.conversations.keys().next().value;
			if (firstKey) {
				this.conversations.delete(firstKey);
			}
		}

		this.conversations.set(id, conversation);
		return conversation;
	}

	/**
	 * Add a reply/forward to an existing conversation.
	 */
	addToConversation(conversationId: string, message: GeneratedMessage): void {
		const conversation = this.conversations.get(conversationId);
		if (!conversation) {
			throw new Error(`Conversation not found: ${conversationId}`);
		}

		conversation.messageIds.push(message.messageId);
		conversation.lastMessage = message;

		// Add any new participants
		const existingEmails = new Set(
			conversation.participants.map((p) => p.email),
		);
		for (const recipient of message.to) {
			if (!existingEmails.has(recipient.email)) {
				conversation.participants.push(recipient);
				existingEmails.add(recipient.email);
			}
		}
	}

	/**
	 * Get a random conversation for reply/forward.
	 * Returns undefined if no conversations exist.
	 */
	getRandomConversation(): Conversation | undefined {
		if (this.conversations.size === 0) {
			return undefined;
		}

		const conversations = Array.from(this.conversations.values());
		return this.faker.helpers.arrayElement(conversations);
	}

	/**
	 * Get conversation by ID.
	 */
	getConversation(id: string): Conversation | undefined {
		return this.conversations.get(id);
	}

	/**
	 * Get all active conversations.
	 */
	getAllConversations(): Conversation[] {
		return Array.from(this.conversations.values());
	}

	/**
	 * Get the number of active conversations.
	 */
	get count(): number {
		return this.conversations.size;
	}

	/**
	 * Build the References header for a reply in a conversation.
	 * Returns all previous Message-IDs in the thread.
	 */
	buildReferences(conversationId: string): string[] {
		const conversation = this.conversations.get(conversationId);
		if (!conversation) {
			return [];
		}
		return [...conversation.messageIds];
	}

	/**
	 * Get a suitable sender for a reply in a conversation.
	 * The sender should be someone already in the conversation
	 * but not the last message's sender.
	 */
	getReplyCandidate(conversation: Conversation): Participant | undefined {
		const lastSenderEmail = conversation.lastMessage.from.email;
		const candidates = conversation.participants.filter(
			(p) => p.email !== lastSenderEmail,
		);

		if (candidates.length === 0) {
			return undefined;
		}

		return this.faker.helpers.arrayElement(candidates);
	}
}
