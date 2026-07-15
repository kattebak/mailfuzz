import { Faker, base, en } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { MessageFactory } from "../generator/message-factory.js";
import type { GenerationContext, Participant } from "../types.js";
import { NewsletterEmailPlugin } from "./newsletter-email-plugin.js";

const createMockContext = (
	seed: number,
	overrides: Partial<GenerationContext> = {},
): GenerationContext => {
	const faker = new Faker({ locale: [en, base] });
	faker.seed(seed);

	const sender: Participant = {
		firstName: "Alice",
		lastName: "Sender",
		email: "alice@example.com",
	};
	const recipient: Participant = {
		firstName: "Bob",
		lastName: "Recipient",
		email: "bob@example.com",
	};

	return {
		faker,
		locale: "en",
		isReply: false,
		isForward: false,
		requestHtml: false,
		sender,
		recipients: [recipient],
		participants: [sender, recipient],
		...overrides,
	};
};

describe("NewsletterEmailPlugin", () => {
	const plugin = new NewsletterEmailPlugin();

	it("sets both List-Unsubscribe and List-Id on every generated issue", async () => {
		for (let seed = 0; seed < 40; seed++) {
			const result = await plugin.generate(createMockContext(seed));

			expect(result.headers?.["List-Unsubscribe"]).toBeDefined();
			expect(result.headers?.["List-Unsubscribe"]).toMatch(
				/<https:\/\/.+\/unsubscribe>/,
			);
			expect(result.headers?.["List-Id"]).toBeDefined();
			expect(result.headers?.["List-Id"]).toMatch(/<.+\..+>/);
		}
	});

	it("does not attach list headers to forwarded newsletters", async () => {
		const parentMessage = {
			subject: "The Weekly Stack #142",
			from: {
				firstName: "The Weekly Stack",
				lastName: "",
				email: "newsletter@theweeklystack.io",
			},
			date: new Date("2026-01-15T10:00:00Z"),
			bodyExcerpt: "This week's top story.",
			messageId: "<original@example.com>",
		};

		const result = await plugin.generate(
			createMockContext(7, { isForward: true, parentMessage }),
		);

		expect(result.headers?.["List-Id"]).toBeUndefined();
	});

	it("renders list headers into the compiled RFC 2822 message", async () => {
		const context = createMockContext(2);
		const content = await plugin.generate(context);

		const factory = new MessageFactory(context.faker);
		const message = await factory.createMessage({
			content,
			from: content.sender ?? context.sender,
			to: context.recipients,
			date: new Date("2026-07-01T12:00:00Z"),
		});

		const raw = message.raw?.toString("utf-8") ?? "";
		expect(raw).toMatch(/^List-Unsubscribe:/m);
		expect(raw).toMatch(/^List-ID:/im);
	});
});
