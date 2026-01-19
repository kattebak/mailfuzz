import fs from "node:fs/promises";
import path from "node:path";
import type { GeneratedMessage } from "../types.js";
import { FilenameGenerator } from "./filename-generator.js";

/**
 * Result of writing messages to a maildir.
 */
export interface WriteResult {
	totalWritten: number;
	newMessages: number;
	curMessages: number;
	errors: Array<{ messageId: string; error: string }>;
}

/**
 * Writes generated messages to a Maildir-compliant directory structure.
 *
 * Directory structure:
 * - tmp/  - Temporary files during write
 * - new/  - Unread messages
 * - cur/  - Read messages (with flags)
 */
export class MaildirWriter {
	private readonly maildirPath: string;
	private readonly filenameGenerator: FilenameGenerator;

	constructor(maildirPath: string) {
		this.maildirPath = maildirPath;
		this.filenameGenerator = new FilenameGenerator();
	}

	/**
	 * Ensure the maildir directory structure exists.
	 */
	async ensureDirectories(): Promise<void> {
		const dirs = ["tmp", "new", "cur"];

		for (const dir of dirs) {
			await fs.mkdir(path.join(this.maildirPath, dir), { recursive: true });
		}
	}

	/**
	 * Write a single message to the maildir.
	 * Uses atomic write: write to tmp, then rename to destination.
	 */
	async writeMessage(message: GeneratedMessage): Promise<string> {
		if (!message.raw) {
			throw new Error(`Message ${message.messageId} has no raw content`);
		}

		const timestamp = Math.floor(message.date.getTime() / 1000);
		const size = message.raw.length;
		const hasSeenFlag = message.flags.includes("S");

		// Generate filename for tmp
		const tmpFilename = this.filenameGenerator.generateTmpFilename(timestamp);
		const tmpPath = path.join(this.maildirPath, "tmp", tmpFilename);

		// Write to tmp directory
		await fs.writeFile(tmpPath, message.raw);

		// Determine destination directory
		// Messages with 'S' (Seen) flag go to cur/, unread go to new/
		const destDir = hasSeenFlag ? "cur" : "new";

		// Add size and flags to filename
		const destFilename = this.filenameGenerator.addSizeAndFlags(
			tmpFilename,
			size,
			message.flags.length > 0 ? message.flags : undefined,
		);
		const destPath = path.join(this.maildirPath, destDir, destFilename);

		// Atomic rename from tmp to destination
		await fs.rename(tmpPath, destPath);

		return destPath;
	}

	/**
	 * Write multiple messages to the maildir.
	 */
	async writeMessages(messages: GeneratedMessage[]): Promise<WriteResult> {
		await this.ensureDirectories();

		const result: WriteResult = {
			totalWritten: 0,
			newMessages: 0,
			curMessages: 0,
			errors: [],
		};

		for (const message of messages) {
			try {
				const destPath = await this.writeMessage(message);

				result.totalWritten++;

				if (destPath.includes("/new/")) {
					result.newMessages++;
				} else {
					result.curMessages++;
				}
			} catch (error) {
				result.errors.push({
					messageId: message.messageId,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return result;
	}

	/**
	 * Write messages from an async generator.
	 */
	async writeFromGenerator(
		generator: AsyncGenerator<GeneratedMessage>,
		onProgress?: (written: number) => void,
	): Promise<WriteResult> {
		await this.ensureDirectories();

		const result: WriteResult = {
			totalWritten: 0,
			newMessages: 0,
			curMessages: 0,
			errors: [],
		};

		for await (const message of generator) {
			try {
				const destPath = await this.writeMessage(message);

				result.totalWritten++;

				if (destPath.includes("/new/")) {
					result.newMessages++;
				} else {
					result.curMessages++;
				}

				onProgress?.(result.totalWritten);
			} catch (error) {
				result.errors.push({
					messageId: message.messageId,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return result;
	}

	/**
	 * Clean up any stale files in tmp directory.
	 * Per spec, files older than 36 hours should be removed.
	 */
	async cleanTmp(maxAgeMs = 36 * 60 * 60 * 1000): Promise<number> {
		const tmpDir = path.join(this.maildirPath, "tmp");
		let cleaned = 0;

		try {
			const files = await fs.readdir(tmpDir);
			const now = Date.now();

			for (const file of files) {
				const filePath = path.join(tmpDir, file);
				try {
					const stat = await fs.stat(filePath);
					if (now - stat.mtimeMs > maxAgeMs) {
						await fs.unlink(filePath);
						cleaned++;
					}
				} catch {
					// Ignore errors for individual files
				}
			}
		} catch {
			// tmp directory might not exist yet
		}

		return cleaned;
	}

	/**
	 * Get the maildir path.
	 */
	getPath(): string {
		return this.maildirPath;
	}
}
