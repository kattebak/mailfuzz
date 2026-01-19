import os from "node:os";
import type { MaildirFlag } from "../types.js";

/**
 * Generates unique Maildir-compliant filenames.
 *
 * Format: <timestamp>.<M><microseconds>P<pid>.<hostname>,S=<size>[:2,<flags>]
 */
export class FilenameGenerator {
	private readonly hostname: string;
	private readonly pid: number;
	private deliveryCounter = 0;

	constructor() {
		// Escape special characters in hostname (/ and :)
		this.hostname =
			os.hostname().replace(/\//g, "\\057").replace(/:/g, "\\072") ||
			"localhost";
		this.pid = process.pid;
	}

	/**
	 * Generate a unique filename for a message.
	 *
	 * @param timestamp Unix timestamp in seconds
	 * @param size Message size in bytes
	 * @param flags Optional maildir flags
	 */
	generate(timestamp: number, size: number, flags?: MaildirFlag[]): string {
		const microseconds = Math.floor(Math.random() * 1000000);
		const delivery = ++this.deliveryCounter;

		// Base filename: <timestamp>.M<microseconds>P<pid>Q<delivery>.<hostname>
		let filename = `${timestamp}.M${microseconds}P${this.pid}Q${delivery}.${this.hostname}`;

		// Add size suffix
		filename += `,S=${size}`;

		// Add flags if any
		if (flags && flags.length > 0) {
			// Flags must be in alphabetical order
			const sortedFlags = [...flags].sort().join("");
			filename += `:2,${sortedFlags}`;
		}

		return filename;
	}

	/**
	 * Generate a filename for the tmp directory (no flags).
	 */
	generateTmpFilename(timestamp: number): string {
		const microseconds = Math.floor(Math.random() * 1000000);
		const delivery = ++this.deliveryCounter;

		return `${timestamp}.M${microseconds}P${this.pid}Q${delivery}.${this.hostname}`;
	}

	/**
	 * Add size and flags to a tmp filename when moving to new/cur.
	 */
	addSizeAndFlags(
		tmpFilename: string,
		size: number,
		flags?: MaildirFlag[],
	): string {
		let filename = `${tmpFilename},S=${size}`;

		if (flags && flags.length > 0) {
			const sortedFlags = [...flags].sort().join("");
			filename += `:2,${sortedFlags}`;
		}

		return filename;
	}

	/**
	 * Parse a maildir filename to extract components.
	 */
	parse(filename: string): {
		timestamp: number;
		size?: number;
		flags: MaildirFlag[];
	} {
		const flags: MaildirFlag[] = [];
		let timestamp = 0;
		let size: number | undefined;

		// Extract timestamp (first part before .)
		const timestampMatch = filename.match(/^(\d+)\./);
		if (timestampMatch?.[1]) {
			timestamp = Number.parseInt(timestampMatch[1], 10);
		}

		// Extract size (,S=<number>)
		const sizeMatch = filename.match(/,S=(\d+)/);
		if (sizeMatch?.[1]) {
			size = Number.parseInt(sizeMatch[1], 10);
		}

		// Extract flags (:2,<flags>)
		const flagsMatch = filename.match(/:2,([A-Z]+)$/);
		if (flagsMatch?.[1]) {
			for (const flag of flagsMatch[1]) {
				if (isValidFlag(flag)) {
					flags.push(flag);
				}
			}
		}

		return { timestamp, size, flags };
	}
}

/**
 * Check if a character is a valid maildir flag.
 */
const isValidFlag = (char: string): char is MaildirFlag => {
	return ["D", "F", "P", "R", "S", "T"].includes(char);
};

/**
 * Validate that flags are in alphabetical order.
 */
export const validateFlagOrder = (flags: string): boolean => {
	for (let i = 1; i < flags.length; i++) {
		const prev = flags[i - 1];
		const curr = flags[i];
		if (prev !== undefined && curr !== undefined && prev >= curr) {
			return false;
		}
	}
	return true;
};
