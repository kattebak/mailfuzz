import { Faker, de, en, fr, nl } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import type { GenerationContext, Participant } from "../types.js";
import { StandardEmailPlugin } from "./standard-email-plugin.js";

const createMockContext = (
	locale: string,
	overrides: Partial<GenerationContext> = {},
): GenerationContext => {
	const faker = new Faker({ locale: [en] });
	faker.seed(12345);

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
		locale,
		isReply: false,
		isForward: false,
		requestHtml: false,
		sender,
		recipients: [recipient],
		participants: [sender, recipient],
		...overrides,
	};
};

describe("StandardEmailPlugin", () => {
	const plugin = new StandardEmailPlugin();

	describe("metadata", () => {
		it("has correct id and name", () => {
			expect(plugin.id).toBe("standard");
			expect(plugin.name).toBe("Standard Email");
		});

		it("has correct capabilities", () => {
			expect(plugin.capabilities.canBeReply).toBe(true);
			expect(plugin.capabilities.canBeForward).toBe(true);
			expect(plugin.capabilities.canBeOriginal).toBe(true);
			expect(plugin.capabilities.supportsHtml).toBe(true);
			expect(plugin.capabilities.supportsAttachments).toBe(false);
		});
	});

	describe("generate original email", () => {
		it("generates English greeting for en locale", () => {
			const context = createMockContext("en");
			const result = plugin.generate(context);

			expect(result.text).toMatch(/^(Hi|Hey|Hello|Dear|Bob) Bob,|^Bob,/);
		});

		it("generates German greeting for de locale", () => {
			const context = createMockContext("de");
			const result = plugin.generate(context);

			expect(result.text).toMatch(
				/^(Hallo|Liebe\(r\)|Guten Tag|Sehr geehrte\(r\)|Bob) Bob,|^Bob,/,
			);
		});

		it("generates French greeting for fr locale", () => {
			const context = createMockContext("fr");
			const result = plugin.generate(context);

			expect(result.text).toMatch(
				/^(Bonjour|Salut|Cher\/Chère|Bonsoir|Bob) Bob,|^Bob,/,
			);
		});

		it("generates Dutch greeting for nl locale", () => {
			const context = createMockContext("nl");
			const result = plugin.generate(context);

			expect(result.text).toMatch(/^(Hallo|Beste|Geachte|Dag|Bob) Bob,|^Bob,/);
		});

		it("falls back to English for unknown locale", () => {
			const context = createMockContext("xx_XX");
			const result = plugin.generate(context);

			expect(result.text).toMatch(/^(Hi|Hey|Hello|Dear|Bob) Bob,|^Bob,/);
		});

		it("handles locale variants (de_AT -> de)", () => {
			const context = createMockContext("de_AT");
			const result = plugin.generate(context);

			expect(result.text).toMatch(
				/^(Hallo|Liebe\(r\)|Guten Tag|Sehr geehrte\(r\)|Bob) Bob,|^Bob,/,
			);
		});
	});

	describe("generate reply", () => {
		const parentMessage = {
			subject: "Original Subject",
			from: {
				firstName: "Charlie",
				lastName: "Original",
				email: "charlie@example.com",
			},
			date: new Date("2026-01-15T10:00:00Z"),
			bodyExcerpt: "This is the original message body.",
			messageId: "<original@example.com>",
		};

		it("generates German reply starters for de locale", () => {
			const context = createMockContext("de", {
				isReply: true,
				parentMessage,
			});
			const result = plugin.generate(context);

			expect(result.text).toMatch(
				/(Danke für deine Nachricht|Guter Punkt|Ich schaue mir das an|Klingt gut|Danke für die Info|Verstanden, danke|Das ergibt Sinn|Danke für das Update)/,
			);
			expect(result.subject).toBe("Re: Original Subject");
		});

		it("generates French reply starters for fr locale", () => {
			const context = createMockContext("fr", {
				isReply: true,
				parentMessage,
			});
			const result = plugin.generate(context);

			expect(result.text).toMatch(
				/(Merci pour ton message|Bonne remarque|Je vais regarder ça|Ça me semble bien|Merci de m'avoir prévenu|Compris, merci|C'est logique|Merci pour la mise à jour)/,
			);
		});
	});

	describe("generate forward", () => {
		const parentMessage = {
			subject: "Important News",
			from: {
				firstName: "Charlie",
				lastName: "Original",
				email: "charlie@example.com",
			},
			date: new Date("2026-01-15T10:00:00Z"),
			bodyExcerpt: "This is important news.",
			messageId: "<original@example.com>",
		};

		it("generates German forward intro for de locale", () => {
			const context = createMockContext("de", {
				isForward: true,
				parentMessage,
			});
			const result = plugin.generate(context);

			expect(result.text).toMatch(
				/(Zur Info|Das könnte dich interessieren|Leite das mal weiter|Siehe unten|FYI - siehe unten)/,
			);
			expect(result.subject).toBe("Fwd: Important News");
		});

		it("generates French forward intro for fr locale", () => {
			const context = createMockContext("fr", {
				isForward: true,
				parentMessage,
			});
			const result = plugin.generate(context);

			expect(result.text).toMatch(
				/(Pour info|Ça pourrait t'intéresser|Je te fais suivre|Voir ci-dessous|FYI - voir ci-dessous)/,
			);
		});
	});

	describe("HTML generation", () => {
		it("generates HTML when requested", () => {
			const context = createMockContext("en", { requestHtml: true });
			const result = plugin.generate(context);

			expect(result.html).toBeDefined();
			expect(result.html).toContain("<!DOCTYPE html>");
			expect(result.html).toContain("<body>");
		});

		it("escapes HTML entities in content", () => {
			const context = createMockContext("en", { requestHtml: true });
			// Use a sender with special characters
			context.sender = {
				firstName: "Alice & Bob",
				lastName: "Test",
				email: "test@example.com",
			};
			const result = plugin.generate(context);

			expect(result.html).toContain("&amp;");
		});
	});

	describe("deterministic output", () => {
		it("generates same output with same seed", () => {
			const context1 = createMockContext("en");
			const context2 = createMockContext("en");

			const result1 = plugin.generate(context1);
			const result2 = plugin.generate(context2);

			expect(result1.subject).toBe(result2.subject);
			expect(result1.text).toBe(result2.text);
		});
	});
});
