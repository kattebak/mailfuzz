import { Faker, base, en } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import type { GenerationContext, Participant } from "../types.js";
import { SpamEmailPlugin } from "./spam-email-plugin.js";

const createMockContext = (
	seed: number,
	overrides: Partial<GenerationContext> = {},
): GenerationContext => {
	const faker = new Faker({ locale: [en, base] });
	faker.seed(seed);

	const participant: Participant = {
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
		sender: participant,
		recipients: [participant],
		participants: [participant],
		...overrides,
	};
};

describe("SpamEmailPlugin", () => {
	const plugin = new SpamEmailPlugin();

	it("marks every message as automated bulk mail", () => {
		for (let seed = 0; seed < 40; seed++) {
			const result = plugin.generate(createMockContext(seed));
			const headers = result.headers ?? {};

			const isAutomated =
				headers["Precedence"] === "bulk" ||
				headers["Auto-Submitted"] === "auto-generated";

			expect(isAutomated).toBe(true);
		}
	});

	it("sets an automated header on malware attachments too", () => {
		const result = plugin.generate(
			createMockContext(3, { pluginConfig: { includeAttachments: true } }),
		);
		const headers = result.headers ?? {};

		const isAutomated =
			headers["Precedence"] === "bulk" ||
			headers["Auto-Submitted"] === "auto-generated";

		expect(isAutomated).toBe(true);
	});
});
