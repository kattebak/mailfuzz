import { Faker, base, en } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { MessageFactory } from "../generator/message-factory.js";
import type { GenerationContext, Participant } from "../types.js";
import { TransactionalEmailPlugin } from "./transactional-email-plugin.js";

const createMockContext = (
	seed: number,
	overrides: Partial<GenerationContext> = {},
): GenerationContext => {
	const faker = new Faker({ locale: [en, base] });
	faker.seed(seed);

	const sender: Participant = {
		firstName: "Alice",
		lastName: "Organizer",
		email: "alice@example.com",
	};
	const recipient: Participant = {
		firstName: "Bob",
		lastName: "Attendee",
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

describe("TransactionalEmailPlugin", () => {
	const plugin = new TransactionalEmailPlugin();

	it("has expected metadata and capabilities", () => {
		expect(plugin.id).toBe("transactional");
		expect(plugin.capabilities.supportsAttachments).toBe(true);
	});

	it("emits a text/calendar part with a valid VCALENDAR body", () => {
		for (let seed = 0; seed < 30; seed++) {
			const result = plugin.generate(createMockContext(seed));

			expect(result.attachments).toHaveLength(1);
			const attachment = result.attachments?.[0];
			expect(attachment?.contentType).toMatch(/^text\/calendar/);
			expect(attachment?.filename).toMatch(/\.ics$/);

			const ics = attachment?.content.toString("utf-8") ?? "";
			expect(ics).toContain("BEGIN:VCALENDAR");
			expect(ics).toContain("BEGIN:VEVENT");
			expect(ics).toContain("DTSTART:");
			expect(ics).toContain("END:VCALENDAR");
		}
	});

	it("keeps the text/calendar part in the compiled RFC 2822 message", async () => {
		const context = createMockContext(1);
		const content = plugin.generate(context);

		const factory = new MessageFactory(context.faker);
		const message = await factory.createMessage({
			content,
			from: content.sender ?? context.sender,
			to: context.recipients,
			date: new Date("2026-07-01T12:00:00Z"),
		});

		const raw = message.raw?.toString("utf-8") ?? "";
		expect(raw).toContain("text/calendar");
	});
});
