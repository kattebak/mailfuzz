import { Faker, en } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import type { Attachment, GenerationContext, Participant } from "../types.js";
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
		locale: "en",
		isReply: false,
		isForward: false,
		requestHtml: false,
		participants: [participant],
		sender: participant,
		recipients: [participant],
		...overrides,
	};
};

const isImage = (attachment: Attachment): boolean =>
	attachment.contentType.startsWith("image/");

/**
 * Generate attachments until a non-image (dummy file) one is produced, so
 * size-specific assertions are exercised against the dummy-file code path.
 */
const generateDummyAttachment = async (
	pluginConfig: Record<string, unknown>,
): Promise<Attachment> => {
	const plugin = new FileUploadEmailPlugin();
	for (let seed = 0; seed < 50; seed++) {
		const faker = new Faker({ locale: [en] });
		faker.seed(seed);
		const context = createMockContext({ faker, pluginConfig });
		const content = await plugin.generate(context);
		const attachment = content.attachments?.[0];
		if (attachment && !isImage(attachment)) {
			return attachment;
		}
	}
	throw new Error("No dummy attachment produced");
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

		it("always produces exactly one attachment", async () => {
			const plugin = new FileUploadEmailPlugin();
			const content = await plugin.generate(createMockContext());

			expect(content.attachments).toHaveLength(1);
		});

		it("uses default sizes for dummy files when no pluginConfig provided", async () => {
			const attachment = await generateDummyAttachment({});

			const sizeKb = attachment.content.length / 1024;
			expect(sizeKb).toBeGreaterThanOrEqual(50);
			expect(sizeKb).toBeLessThanOrEqual(500);
		});

		it("uses custom minSizeKb and maxSizeKb from pluginConfig", async () => {
			const attachment = await generateDummyAttachment({
				minSizeKb: 200,
				maxSizeKb: 200,
			});

			expect(attachment.content.length / 1024).toBe(200);
		});

		it("generates very small dummy attachments with minSizeKb=1", async () => {
			const attachment = await generateDummyAttachment({
				minSizeKb: 1,
				maxSizeKb: 1,
			});

			expect(attachment.content.length / 1024).toBe(1);
		});

		it("generates large dummy attachments with custom maxSizeKb", async () => {
			const attachment = await generateDummyAttachment({
				minSizeKb: 1000,
				maxSizeKb: 1000,
			});

			expect(attachment.content.length / 1024).toBe(1000);
		});
	});

	describe("image attachments", () => {
		it("produces a valid PNG when an image template is selected", async () => {
			const plugin = new FileUploadEmailPlugin();

			let imageAttachment: Attachment | undefined;
			for (let seed = 0; seed < 100 && !imageAttachment; seed++) {
				const faker = new Faker({ locale: [en] });
				faker.seed(seed);
				const content = await plugin.generate(createMockContext({ faker }));
				const attachment = content.attachments?.[0];
				if (attachment && isImage(attachment)) {
					imageAttachment = attachment;
				}
			}

			expect(imageAttachment).toBeDefined();
			if (!imageAttachment) {
				return;
			}
			expect(imageAttachment.contentType).toBe("image/png");
			expect(imageAttachment.filename.endsWith(".png")).toBe(true);
			const signature = imageAttachment.content.subarray(0, 4);
			expect(Array.from(signature)).toEqual([0x89, 0x50, 0x4e, 0x47]);
		});
	});
});
