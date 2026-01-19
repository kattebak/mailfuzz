import fs from "node:fs/promises";
import path from "node:path";
import { validateFlagOrder } from "../maildir/FilenameGenerator.js";
import type { MaildirValidationResult } from "../types.js";
import { MessageValidator } from "./MessageValidator.js";

/**
 * Validates Maildir directory structure and contents.
 */
export class MaildirValidator {
	private readonly maildirPath: string;
	private readonly messageValidator: MessageValidator;

	constructor(maildirPath: string) {
		this.maildirPath = maildirPath;
		this.messageValidator = new MessageValidator();
	}

	/**
	 * Validate the entire maildir.
	 */
	async validate(
		validateMessageContent = true,
	): Promise<MaildirValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];
		let messageCount = 0;

		// Check directory structure
		const structureResult = await this.validateStructure();
		errors.push(...structureResult.errors);
		warnings.push(...structureResult.warnings);

		// Check tmp is empty (should be after generation)
		const tmpResult = await this.checkTmpEmpty();
		warnings.push(...tmpResult.warnings);

		// Validate filenames and messages in new/
		const newResult = await this.validateDirectory(
			"new",
			validateMessageContent,
		);
		errors.push(...newResult.errors);
		warnings.push(...newResult.warnings);
		messageCount += newResult.messageCount;

		// Validate filenames and messages in cur/
		const curResult = await this.validateDirectory(
			"cur",
			validateMessageContent,
		);
		errors.push(...curResult.errors);
		warnings.push(...curResult.warnings);
		messageCount += curResult.messageCount;

		return {
			valid: errors.length === 0,
			messageCount,
			errors,
			warnings,
		};
	}

	/**
	 * Validate the required directory structure exists.
	 */
	private async validateStructure(): Promise<{
		errors: string[];
		warnings: string[];
	}> {
		const errors: string[] = [];
		const warnings: string[] = [];

		const requiredDirs = ["tmp", "new", "cur"];

		// Check root maildir exists
		try {
			const stat = await fs.stat(this.maildirPath);
			if (!stat.isDirectory()) {
				errors.push(`Maildir path is not a directory: ${this.maildirPath}`);
				return { errors, warnings };
			}
		} catch {
			errors.push(`Maildir path does not exist: ${this.maildirPath}`);
			return { errors, warnings };
		}

		// Check required subdirectories
		for (const dir of requiredDirs) {
			const dirPath = path.join(this.maildirPath, dir);
			try {
				const stat = await fs.stat(dirPath);
				if (!stat.isDirectory()) {
					errors.push(`${dir}/ is not a directory`);
				}
			} catch {
				errors.push(`Missing required directory: ${dir}/`);
			}
		}

		return { errors, warnings };
	}

	/**
	 * Check that tmp directory is empty.
	 */
	private async checkTmpEmpty(): Promise<{ warnings: string[] }> {
		const warnings: string[] = [];
		const tmpPath = path.join(this.maildirPath, "tmp");

		try {
			const files = await fs.readdir(tmpPath);
			if (files.length > 0) {
				warnings.push(
					`tmp/ directory contains ${files.length} files (should be empty after generation)`,
				);
			}
		} catch {
			// tmp might not exist, which is handled by structure validation
		}

		return { warnings };
	}

	/**
	 * Validate a specific directory (new/ or cur/).
	 */
	private async validateDirectory(
		dir: "new" | "cur",
		validateContent: boolean,
	): Promise<{
		errors: string[];
		warnings: string[];
		messageCount: number;
	}> {
		const errors: string[] = [];
		const warnings: string[] = [];
		let messageCount = 0;

		const dirPath = path.join(this.maildirPath, dir);

		let files: string[];
		try {
			files = await fs.readdir(dirPath);
		} catch {
			return { errors, warnings, messageCount: 0 };
		}

		for (const filename of files) {
			// Skip hidden files
			if (filename.startsWith(".")) {
				continue;
			}

			messageCount++;

			// Validate filename format
			const filenameResult = this.validateFilename(filename, dir);
			errors.push(...filenameResult.errors);
			warnings.push(...filenameResult.warnings);

			// Optionally validate message content
			if (validateContent) {
				const filePath = path.join(dirPath, filename);
				try {
					const content = await fs.readFile(filePath);
					const msgResult = await this.messageValidator.validate(content);

					if (!msgResult.valid) {
						for (const err of msgResult.errors) {
							errors.push(`${dir}/${filename}: ${err}`);
						}
					}

					for (const warn of msgResult.warnings) {
						warnings.push(`${dir}/${filename}: ${warn}`);
					}
				} catch (error) {
					errors.push(
						`Failed to read ${dir}/${filename}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
		}

		return { errors, warnings, messageCount };
	}

	/**
	 * Validate a maildir filename.
	 */
	private validateFilename(
		filename: string,
		dir: "new" | "cur",
	): { errors: string[]; warnings: string[] } {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Basic format: <timestamp>.<delivery>.<hostname>[,S=<size>][:2,<flags>]

		// Should start with a timestamp
		if (!/^\d+\./.test(filename)) {
			errors.push(`Invalid filename format (no timestamp): ${filename}`);
			return { errors, warnings };
		}

		// Check for size suffix
		if (!filename.includes(",S=")) {
			warnings.push(`Missing size suffix in filename: ${filename}`);
		}

		// Check flag format if present
		const flagMatch = filename.match(/:2,([A-Z]*)$/);
		if (flagMatch) {
			const flags = flagMatch[1] ?? "";

			// Flags must be in alphabetical order
			if (!validateFlagOrder(flags)) {
				errors.push(`Flags not in alphabetical order in filename: ${filename}`);
			}

			// Check for valid flag characters
			const validFlags = new Set(["D", "F", "P", "R", "S", "T"]);
			for (const flag of flags) {
				if (!validFlags.has(flag)) {
					errors.push(`Invalid flag '${flag}' in filename: ${filename}`);
				}
			}
		}

		// Messages in new/ should NOT have the :2, suffix (unless they have flags)
		// Messages in cur/ should have the :2, suffix (even if no flags, though :2, alone is valid)
		if (dir === "cur" && !filename.includes(":2,")) {
			// It's technically valid but unusual for cur/ to not have info suffix
			// Many implementations require it
			warnings.push(`Message in cur/ without info suffix: ${filename}`);
		}

		return { errors, warnings };
	}
}

/**
 * Convenience function for quick validation.
 */
export const validateMaildir = async (
	maildirPath: string,
	validateMessageContent = true,
): Promise<MaildirValidationResult> => {
	const validator = new MaildirValidator(maildirPath);
	return validator.validate(validateMessageContent);
};
