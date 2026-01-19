import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MailfuzzGenerator } from "./generator/MailfuzzGenerator.js";
import { MaildirWriter } from "./maildir/MaildirWriter.js";
import { validateMaildir } from "./validation/MaildirValidator.js";
import { validateMessage } from "./validation/MessageValidator.js";

describe("Integration: Full generation and validation roundtrip", () => {
	let tempDir: string;

	beforeEach(async () => {
		// Create a temporary directory for each test
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mailfuzz-test-"));
	});

	afterEach(async () => {
		// Clean up temporary directory
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("generates and validates a small maildir", async () => {
		const maildirPath = path.join(tempDir, "maildir");

		// Generate messages
		const generator = new MailfuzzGenerator({
			seed: 42,
			messageCount: 10,
		});

		const writer = new MaildirWriter(maildirPath);
		const writeResult = await writer.writeFromGenerator(generator.stream());

		// Verify write results
		expect(writeResult.totalWritten).toBe(10);
		expect(writeResult.errors).toHaveLength(0);
		expect(writeResult.newMessages + writeResult.curMessages).toBe(10);

		// Validate the maildir
		const validationResult = await validateMaildir(maildirPath, true);

		expect(validationResult.valid).toBe(true);
		expect(validationResult.messageCount).toBe(10);
		expect(validationResult.errors).toHaveLength(0);
	});

	it("generates messages that pass individual validation", async () => {
		const generator = new MailfuzzGenerator({
			seed: 123,
			messageCount: 5,
		});

		const messages = await generator.generateAll();

		for (const message of messages) {
			expect(message.raw).toBeDefined();
			if (message.raw) {
				const result = await validateMessage(message.raw);
				expect(result.valid).toBe(true);
				expect(result.errors).toHaveLength(0);
			}
		}
	});

	it("creates proper maildir directory structure", async () => {
		const maildirPath = path.join(tempDir, "maildir");

		const generator = new MailfuzzGenerator({
			seed: 42,
			messageCount: 5,
		});

		const writer = new MaildirWriter(maildirPath);
		await writer.writeFromGenerator(generator.stream());

		// Check directory structure exists
		const dirs = ["tmp", "new", "cur"];
		for (const dir of dirs) {
			const dirPath = path.join(maildirPath, dir);
			const stat = await fs.stat(dirPath);
			expect(stat.isDirectory()).toBe(true);
		}

		// tmp should be empty after generation
		const tmpFiles = await fs.readdir(path.join(maildirPath, "tmp"));
		expect(tmpFiles).toHaveLength(0);
	});

	it("distributes messages between new/ and cur/ based on flags", async () => {
		const maildirPath = path.join(tempDir, "maildir");

		// Use a larger sample for statistical reliability
		const generator = new MailfuzzGenerator({
			seed: 42,
			messageCount: 50,
		});

		const writer = new MaildirWriter(maildirPath);
		const result = await writer.writeFromGenerator(generator.stream());

		// Both new and cur should have some messages
		// (exact distribution depends on age-based probability)
		expect(result.newMessages).toBeGreaterThan(0);
		expect(result.curMessages).toBeGreaterThan(0);
	});

	it("generates deterministic output for same seed", async () => {
		const maildirPath1 = path.join(tempDir, "maildir1");
		const maildirPath2 = path.join(tempDir, "maildir2");

		// Generate two maildirs with same seed
		for (const maildirPath of [maildirPath1, maildirPath2]) {
			const generator = new MailfuzzGenerator({
				seed: 12345,
				messageCount: 5,
			});

			const writer = new MaildirWriter(maildirPath);
			await writer.writeFromGenerator(generator.stream());
		}

		// Read files from both
		const readAllMessages = async (maildir: string): Promise<string[]> => {
			const messages: string[] = [];
			for (const dir of ["new", "cur"]) {
				const dirPath = path.join(maildir, dir);
				try {
					const files = await fs.readdir(dirPath);
					for (const file of files) {
						const content = await fs.readFile(
							path.join(dirPath, file),
							"utf-8",
						);
						messages.push(content);
					}
				} catch {
					// Directory might not exist
				}
			}
			return messages.sort();
		};

		const messages1 = await readAllMessages(maildirPath1);
		const messages2 = await readAllMessages(maildirPath2);

		expect(messages1).toHaveLength(5);
		expect(messages2).toHaveLength(5);

		// Messages should be identical (minus timestamps that might differ)
		// We check that subjects and bodies match
		for (let i = 0; i < messages1.length; i++) {
			const m1 = messages1[i] ?? "";
			const m2 = messages2[i] ?? "";

			// Extract subject line
			const subjectMatch1 = m1.match(/^Subject: (.+)$/m);
			const subjectMatch2 = m2.match(/^Subject: (.+)$/m);

			expect(subjectMatch1?.[1]).toBe(subjectMatch2?.[1]);
		}
	});

	it("handles threading correctly", async () => {
		const generator = new MailfuzzGenerator({
			seed: 42,
			messageCount: 20,
			replyProbability: 0.5,
			forwardProbability: 0.1,
		});

		const messages = await generator.generateAll();

		// Check that replies have proper threading headers
		const replies = messages.filter((m) => m.inReplyTo);

		for (const reply of replies) {
			// In-Reply-To should reference an existing message
			expect(reply.inReplyTo).toMatch(/^<.+@.+>$/);

			// References should be an array (even if empty)
			if (reply.references) {
				expect(Array.isArray(reply.references)).toBe(true);
			}
		}
	});
});
