import { type ParsedMail, simpleParser } from "mailparser";
import type { MessageValidationResult } from "../types.js";

/**
 * Validates email messages for RFC 2822 compliance using mailparser.
 */
export class MessageValidator {
	/**
	 * Validate a raw email message buffer.
	 */
	async validate(raw: Buffer): Promise<MessageValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];

		let parsed: ParsedMail;

		try {
			parsed = await simpleParser(raw);
		} catch (error) {
			return {
				valid: false,
				errors: [
					`Failed to parse message: ${error instanceof Error ? error.message : String(error)}`,
				],
				warnings: [],
			};
		}

		// Check required headers per RFC 2822

		// Date is required
		if (!parsed.date) {
			errors.push("Missing required header: Date");
		}

		// From is required
		if (!parsed.from || parsed.from.value.length === 0) {
			errors.push("Missing required header: From");
		}

		// Validate From address format
		if (parsed.from?.value) {
			for (const addr of parsed.from.value) {
				if (!addr.address || !this.isValidEmail(addr.address)) {
					errors.push(`Invalid From address: ${addr.address ?? "empty"}`);
				}
			}
		}

		// To is recommended but not strictly required
		if (!parsed.to) {
			warnings.push("Missing recommended header: To");
		} else if ("value" in parsed.to) {
			for (const addr of parsed.to.value) {
				if (!addr.address || !this.isValidEmail(addr.address)) {
					errors.push(`Invalid To address: ${addr.address ?? "empty"}`);
				}
			}
		}

		// Message-ID should be included
		if (!parsed.messageId) {
			warnings.push("Missing Message-ID header (SHOULD include per RFC 2822)");
		} else {
			// Validate Message-ID format: <local-part@domain>
			if (!this.isValidMessageId(parsed.messageId)) {
				errors.push(`Invalid Message-ID format: ${parsed.messageId}`);
			}
		}

		// If this is a reply, check threading headers
		if (parsed.inReplyTo) {
			if (!this.isValidMessageId(parsed.inReplyTo)) {
				warnings.push(`Invalid In-Reply-To format: ${parsed.inReplyTo}`);
			}
		}

		// Check References header format if present
		if (parsed.references) {
			const refs = Array.isArray(parsed.references)
				? parsed.references
				: [parsed.references];
			for (const ref of refs) {
				if (!this.isValidMessageId(ref)) {
					warnings.push(`Invalid References entry: ${ref}`);
				}
			}
		}

		// Check that body exists
		if (!parsed.text && !parsed.html) {
			warnings.push("Message has no text or HTML body");
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Parse a message and return the parsed result.
	 */
	async parse(raw: Buffer): Promise<ParsedMail> {
		return simpleParser(raw);
	}

	/**
	 * Basic email address validation.
	 */
	private isValidEmail(email: string): boolean {
		// Basic RFC 2822 email pattern
		const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return pattern.test(email);
	}

	/**
	 * Validate Message-ID format: <local-part@domain>
	 */
	private isValidMessageId(messageId: string): boolean {
		// Message-ID should be wrapped in angle brackets and contain @
		const pattern = /^<[^>]+@[^>]+>$/;
		return pattern.test(messageId);
	}
}

/**
 * Convenience function for quick validation.
 */
export const validateMessage = async (
	raw: Buffer,
): Promise<MessageValidationResult> => {
	const validator = new MessageValidator();
	return validator.validate(raw);
};
