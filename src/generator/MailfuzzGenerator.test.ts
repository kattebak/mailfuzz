import { describe, expect, it } from "vitest";
import type { EmailPlugin, PluginCapabilities } from "../types.js";
import { MailfuzzGenerator } from "./MailfuzzGenerator.js";

const createMockPlugin = (
	id: string,
	capabilities: Partial<PluginCapabilities>,
	defaultWeight?: number,
): EmailPlugin => ({
	id,
	name: `Mock ${id}`,
	capabilities: {
		canBeReply: false,
		canBeForward: false,
		canBeOriginal: true,
		supportsHtml: false,
		supportsAttachments: false,
		supportsMultipleRecipients: true,
		...capabilities,
	},
	defaultWeight,
	generate: () => ({ subject: `Test from ${id}`, text: "Test body" }),
});

describe("MailfuzzGenerator", () => {
	describe("construction", () => {
		it("creates generator with default options", () => {
			const generator = new MailfuzzGenerator();
			const config = generator.getConfig();

			expect(config.generation.messageCount).toBe(100);
			expect(config.generation.maxParticipants).toBe(20);
			expect(config.generation.maxConversations).toBe(30);
		});

		it("creates generator with custom options", () => {
			const generator = new MailfuzzGenerator({
				seed: 42,
				messageCount: 50,
				maxParticipants: 10,
			});

			const config = generator.getConfig();

			expect(config.generation.seed).toBe(42);
			expect(config.generation.messageCount).toBe(50);
			expect(config.generation.maxParticipants).toBe(10);
		});

		it("registers standard plugin by default", () => {
			const generator = new MailfuzzGenerator();
			const plugins = generator.getPlugins();

			expect(plugins).toHaveLength(1);
			expect(plugins[0]?.id).toBe("standard");
		});
	});

	describe("deterministic generation", () => {
		it("produces identical output with same seed", async () => {
			const generator1 = new MailfuzzGenerator({
				seed: 12345,
				messageCount: 5,
			});

			const generator2 = new MailfuzzGenerator({
				seed: 12345,
				messageCount: 5,
			});

			const messages1 = await generator1.generateAll();
			const messages2 = await generator2.generateAll();

			expect(messages1).toHaveLength(5);
			expect(messages2).toHaveLength(5);

			// Same seed should produce same subjects
			for (let i = 0; i < 5; i++) {
				expect(messages1[i]?.subject).toBe(messages2[i]?.subject);
				expect(messages1[i]?.from.email).toBe(messages2[i]?.from.email);
			}
		});

		it("produces different output with different seeds", async () => {
			const generator1 = new MailfuzzGenerator({
				seed: 12345,
				messageCount: 3,
			});

			const generator2 = new MailfuzzGenerator({
				seed: 54321,
				messageCount: 3,
			});

			const messages1 = await generator1.generateAll();
			const messages2 = await generator2.generateAll();

			// Different seeds should produce different subjects (with high probability)
			const subjects1 = messages1.map((m) => m.subject).join(",");
			const subjects2 = messages2.map((m) => m.subject).join(",");

			expect(subjects1).not.toBe(subjects2);
		});
	});

	describe("message generation", () => {
		it("generates messages with required fields", async () => {
			const generator = new MailfuzzGenerator({
				seed: 42,
				messageCount: 3,
			});

			const messages = await generator.generateAll();

			for (const message of messages) {
				expect(message.messageId).toMatch(/^<.+@.+>$/);
				expect(message.date).toBeInstanceOf(Date);
				expect(message.from.email).toBeTruthy();
				expect(message.to.length).toBeGreaterThan(0);
				expect(message.subject).toBeTruthy();
				expect(message.text).toBeTruthy();
				expect(message.raw).toBeInstanceOf(Buffer);
			}
		});

		it("generates messages within date range", async () => {
			const startDate = new Date("2024-01-01");
			const endDate = new Date("2024-01-31");

			const generator = new MailfuzzGenerator({
				seed: 42,
				messageCount: 10,
				startDate,
				endDate,
			});

			const messages = await generator.generateAll();

			for (const message of messages) {
				expect(message.date.getTime()).toBeGreaterThanOrEqual(
					startDate.getTime(),
				);
				expect(message.date.getTime()).toBeLessThanOrEqual(endDate.getTime());
			}
		});

		it("generates messages in chronological order", async () => {
			const generator = new MailfuzzGenerator({
				seed: 42,
				messageCount: 10,
			});

			const messages = await generator.generateAll();

			for (let i = 1; i < messages.length; i++) {
				const prev = messages[i - 1];
				const curr = messages[i];
				if (prev && curr) {
					expect(curr.date.getTime()).toBeGreaterThanOrEqual(
						prev.date.getTime(),
					);
				}
			}
		});
	});

	describe("threading", () => {
		it("creates conversations and replies", async () => {
			const generator = new MailfuzzGenerator({
				seed: 42,
				messageCount: 20,
				replyProbability: 0.5,
				forwardProbability: 0.1,
			});

			const messages = await generator.generateAll();

			// Should have at least some messages with In-Reply-To
			const replies = messages.filter((m) => m.inReplyTo);

			// With 50% reply probability and 20 messages, we should have some replies
			// (after the first few originals to start conversations)
			expect(replies.length).toBeGreaterThan(0);

			// Replies should have valid In-Reply-To format
			for (const reply of replies) {
				expect(reply.inReplyTo).toMatch(/^<.+@.+>$/);
			}
		});
	});

	describe("single message generation", () => {
		it("generateMessage returns a valid message", async () => {
			const generator = new MailfuzzGenerator({ seed: 42 });

			const message = await generator.generateMessage();

			expect(message.messageId).toBeTruthy();
			expect(message.from.email).toBeTruthy();
			expect(message.raw).toBeInstanceOf(Buffer);
		});
	});

	describe("streaming", () => {
		it("stream yields messages one at a time", async () => {
			const generator = new MailfuzzGenerator({
				seed: 42,
				messageCount: 5,
			});

			const messages: Awaited<ReturnType<typeof generator.generateMessage>>[] =
				[];

			for await (const message of generator.stream()) {
				messages.push(message);
			}

			expect(messages).toHaveLength(5);
		});
	});

	describe("plugin weight management", () => {
		it("getPluginWeight returns defaultWeight when no override", () => {
			const plugin = createMockPlugin("test", {}, 0.5);
			const generator = new MailfuzzGenerator({
				plugins: [plugin],
			});

			expect(generator.getPluginWeight("test")).toBe(0.5);
		});

		it("getPluginWeight returns 1.0 fallback when no default", () => {
			const plugin = createMockPlugin("test", {});
			const generator = new MailfuzzGenerator({
				plugins: [plugin],
			});

			expect(generator.getPluginWeight("test")).toBe(1.0);
		});

		it("getPluginWeight returns user override when set via options", () => {
			const plugin = createMockPlugin("test", {}, 0.5);
			const generator = new MailfuzzGenerator({
				plugins: [plugin],
				pluginWeights: { test: 2.0 },
			});

			expect(generator.getPluginWeight("test")).toBe(2.0);
		});

		it("setPluginWeight updates the weight", () => {
			const plugin = createMockPlugin("test", {}, 0.5);
			const generator = new MailfuzzGenerator({
				plugins: [plugin],
			});

			expect(generator.getPluginWeight("test")).toBe(0.5);

			generator.setPluginWeight("test", 3.0);

			expect(generator.getPluginWeight("test")).toBe(3.0);
		});

		it("setPluginWeight throws for unregistered plugin", () => {
			const generator = new MailfuzzGenerator();

			expect(() => generator.setPluginWeight("unknown", 1.0)).toThrow(
				"Plugin not registered: unknown",
			);
		});

		it("setPluginWeight throws for negative weight", () => {
			const plugin = createMockPlugin("test", {});
			const generator = new MailfuzzGenerator({
				plugins: [plugin],
			});

			expect(() => generator.setPluginWeight("test", -1)).toThrow(
				"must be non-negative",
			);
		});

		it("setPluginWeight accepts zero weight", () => {
			const plugin = createMockPlugin("test", {}, 1.0);
			const generator = new MailfuzzGenerator({
				plugins: [plugin],
			});

			generator.setPluginWeight("test", 0);

			expect(generator.getPluginWeight("test")).toBe(0);
		});

		it("getPluginWeight throws for unregistered plugin", () => {
			const generator = new MailfuzzGenerator();

			expect(() => generator.getPluginWeight("unknown")).toThrow(
				"Plugin not registered: unknown",
			);
		});
	});
});
