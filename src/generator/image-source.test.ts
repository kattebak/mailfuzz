import { Faker, en } from "@faker-js/faker";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmailContent, GenerationContext, Participant } from "../types.js";
import { attachHeroImage, getImage } from "./image-source.js";
import { MessageFactory } from "./message-factory.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

const seededFaker = (seed: number): Faker => {
	const faker = new Faker({ locale: [en] });
	faker.seed(seed);
	return faker;
};

const isPng = (buffer: Buffer): boolean =>
	Array.from(buffer.subarray(0, 4)).join(",") === PNG_SIGNATURE.join(",");

const participant: Participant = {
	email: "test@example.com",
	firstName: "Test",
	lastName: "User",
};

const mockContext = (
	faker: Faker,
	mode?: "local" | "kittens",
): GenerationContext => ({
	faker,
	locale: "en",
	isReply: false,
	isForward: false,
	requestHtml: true,
	participants: [participant],
	sender: participant,
	recipients: [participant],
	imageMode: mode,
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("getImage", () => {
	it("local mode produces a valid PNG", async () => {
		const image = await getImage({ faker: seededFaker(1), mode: "local" });

		expect(image.contentType).toBe("image/png");
		expect(image.filename.endsWith(".png")).toBe(true);
		expect(isPng(image.buffer)).toBe(true);
	});

	it("local mode is deterministic for a fixed seed", async () => {
		const a = await getImage({ faker: seededFaker(42), mode: "local" });
		const b = await getImage({ faker: seededFaker(42), mode: "local" });

		expect(a.buffer.equals(b.buffer)).toBe(true);
		expect(a.filename).toBe(b.filename);
	});

	it("defaults to local mode when mode is omitted", async () => {
		const image = await getImage({ faker: seededFaker(7) });

		expect(image.contentType).toBe("image/png");
		expect(isPng(image.buffer)).toBe(true);
	});

	it("kittens mode returns the fetched photo on success", async () => {
		const photo = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02, 0x03]);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				headers: { get: () => "image/jpeg" },
				arrayBuffer: async () => photo.buffer,
			}),
		);

		const image = await getImage({ faker: seededFaker(3), mode: "kittens" });

		expect(image.contentType).toBe("image/jpeg");
		expect(image.filename.endsWith(".jpg")).toBe(true);
		expect(Array.from(image.buffer.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
	});

	it("kittens mode falls back to local on fetch failure", async () => {
		const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

		const image = await getImage({ faker: seededFaker(9), mode: "kittens" });

		expect(image.contentType).toBe("image/png");
		expect(isPng(image.buffer)).toBe(true);
		expect(stderr).toHaveBeenCalled();
	});

	it("kittens mode falls back to local on non-200 response", async () => {
		vi.spyOn(process.stderr, "write").mockReturnValue(true);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 503 }),
		);

		const image = await getImage({ faker: seededFaker(11), mode: "kittens" });

		expect(image.contentType).toBe("image/png");
		expect(isPng(image.buffer)).toBe(true);
	});
});

describe("attachHeroImage", () => {
	it("injects a cid image and adds the matching inline attachment", async () => {
		const content: EmailContent = {
			subject: "Hello",
			text: "hi",
			html: "<!DOCTYPE html><html><body><p>Hi</p></body></html>",
		};

		await attachHeroImage(content, mockContext(seededFaker(5)), {
			width: 600,
			height: 200,
		});

		expect(content.attachments).toHaveLength(1);
		const attachment = content.attachments?.[0];
		expect(attachment?.cid).toBeDefined();
		expect(content.html).toContain(`cid:${attachment?.cid}`);
		expect(isPng(attachment?.content ?? Buffer.alloc(0))).toBe(true);
	});

	it("is a no-op when there is no HTML body", async () => {
		const content: EmailContent = { subject: "Hello", text: "hi" };

		await attachHeroImage(content, mockContext(seededFaker(5)), {
			width: 600,
			height: 200,
		});

		expect(content.attachments).toBeUndefined();
		expect(content.html).toBeUndefined();
	});

	it("inline cid image lands in the compiled raw message", async () => {
		const content: EmailContent = {
			subject: "Hero",
			text: "body",
			html: "<!DOCTYPE html><html><body><p>Body</p></body></html>",
		};

		await attachHeroImage(content, mockContext(seededFaker(8)), {
			width: 600,
			height: 200,
		});

		const factory = new MessageFactory(seededFaker(8));
		const message = await factory.createMessage({
			content,
			from: participant,
			to: [participant],
			date: new Date("2025-01-01T00:00:00Z"),
		});

		const raw = message.raw?.toString("utf-8") ?? "";
		const cid = content.attachments?.[0]?.cid ?? "";
		expect(raw).toContain("Content-ID");
		expect(raw).toContain(cid);
		expect(raw.toLowerCase()).toContain("multipart/related");
	});
});
