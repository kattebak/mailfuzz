import { Faker, en } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import type { GenerationContext, Participant } from "../types.js";
import { FileUploadEmailPlugin } from "./file-upload-email-plugin.js";

const createMockContext = (
	overrides: Partial<GenerationContext> = {},
): GenerationContext => {
	const faker = new Faker({ locale: [en] });
	faker.seed(12345);

	const participant: Participant = {
		email: "test@example.com",
		firstName: "Test",
		lastName: "User",
	};

	return {
		faker,
		isReply: false,
		isForward: false,
		requestHtml: false,
		participants: [participant],
		sender: participant,
		recipients: [participant],
		...overrides,
	};
};

describe("FileUploadEmailPlugin", () => {
	describe("options", () => {
		it("declares minSizeKb and maxSizeKb options", () => {
			const plugin = new FileUploadEmailPlugin();

			expect(plugin.options).toBeDefined();
			expect(plugin.options?.minSizeKb).toEqual({
				type: "number",
				description: "Minimum attachment size in KB",
				default: 50,
			});
			expect(plugin.options?.maxSizeKb).toEqual({
				type: "number",
				description: "Maximum attachment size in KB",
				default: 500,
			});
		});

		it("uses default sizes when no pluginConfig provided", () => {
			const plugin = new FileUploadEmailPlugin();
			const context = createMockContext();

			const content = plugin.generate(context);

			expect(content.attachments).toHaveLength(1);
			const attachment = content.attachments?.[0];
			expect(attachment).toBeDefined();

			// Default range is 50-500 KB
			const sizeKb = attachment?.content.length / 1024;
			expect(sizeKb).toBeGreaterThanOrEqual(50);
			expect(sizeKb).toBeLessThanOrEqual(500);
		});

		it("uses custom minSizeKb from pluginConfig", () => {
			const plugin = new FileUploadEmailPlugin();
			const context = createMockContext({
				pluginConfig: { minSizeKb: 200, maxSizeKb: 200 },
			});

			const content = plugin.generate(context);

			expect(content.attachments).toHaveLength(1);
			const attachment = content.attachments?.[0];
			expect(attachment).toBeDefined();

			// With both set to 200, size should be exactly 200 KB
			const sizeKb = attachment?.content.length / 1024;
			expect(sizeKb).toBe(200);
		});

		it("uses custom maxSizeKb from pluginConfig", () => {
			const plugin = new FileUploadEmailPlugin();

			// Generate multiple samples with a fixed max to verify range constraint
			const results: number[] = [];
			for (let i = 0; i < 10; i++) {
				const faker = new Faker({ locale: [en] });
				faker.seed(i);
				const context = createMockContext({
					faker,
					pluginConfig: { minSizeKb: 10, maxSizeKb: 20 },
				});

				const content = plugin.generate(context);
				const attachment = content.attachments?.[0];
				if (attachment) {
					results.push(attachment.content.length / 1024);
				}
			}

			// All sizes should be within the configured range
			for (const sizeKb of results) {
				expect(sizeKb).toBeGreaterThanOrEqual(10);
				expect(sizeKb).toBeLessThanOrEqual(20);
			}
		});

		it("generates very small attachments with minSizeKb=1", () => {
			const plugin = new FileUploadEmailPlugin();
			const context = createMockContext({
				pluginConfig: { minSizeKb: 1, maxSizeKb: 1 },
			});

			const content = plugin.generate(context);

			expect(content.attachments).toHaveLength(1);
			const attachment = content.attachments?.[0];
			expect(attachment).toBeDefined();

			const sizeKb = attachment?.content.length / 1024;
			expect(sizeKb).toBe(1);
		});

		it("generates large attachments with custom maxSizeKb", () => {
			const plugin = new FileUploadEmailPlugin();
			const context = createMockContext({
				pluginConfig: { minSizeKb: 1000, maxSizeKb: 1000 },
			});

			const content = plugin.generate(context);

			expect(content.attachments).toHaveLength(1);
			const attachment = content.attachments?.[0];
			expect(attachment).toBeDefined();

			const sizeKb = attachment?.content.length / 1024;
			expect(sizeKb).toBe(1000);
		});
	});
});
