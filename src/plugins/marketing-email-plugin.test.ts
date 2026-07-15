import { Faker, base, en } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import type { GenerationContext, Participant } from "../types.js";
import { MarketingEmailPlugin } from "./marketing-email-plugin.js";

const createMockContext = (seed: number): GenerationContext => {
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
	};
};

describe("MarketingEmailPlugin", () => {
	const plugin = new MarketingEmailPlugin();

	it("sets List-Unsubscribe but never List-Id", async () => {
		for (let seed = 0; seed < 40; seed++) {
			const result = await plugin.generate(createMockContext(seed));

			expect(result.headers?.["List-Unsubscribe"]).toBeDefined();
			expect(result.headers?.["List-Unsubscribe"]).toMatch(/<https:\/\/.+>/);
			expect(result.headers?.["List-Id"]).toBeUndefined();
		}
	});
});
