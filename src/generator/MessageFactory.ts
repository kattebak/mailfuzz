import os from "node:os";
import type { Faker } from "@faker-js/faker";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import type {
	Attachment,
	EmailContent,
	GeneratedMessage,
	MaildirFlag,
	Participant,
} from "../types.js";

/**
 * Factory for creating RFC 2822 compliant email messages.
 */
export class MessageFactory {
	private readonly faker: Faker;
	private readonly hostname: string;
	private messageCounter = 0;

	constructor(faker: Faker) {
		this.faker = faker;
		this.hostname = os.hostname().replace(/[/:]/g, "-") || "localhost";
	}

	/**
	 * Generate a unique Message-ID.
	 */
	generateMessageId(): string {
		const timestamp = Date.now();
		const counter = ++this.messageCounter;
		const random = this.faker.string.alphanumeric(8);
		return `<${timestamp}.${counter}.${random}@${this.hostname}>`;
	}

	/**
	 * Format a participant as an email address string.
	 */
	formatAddress(participant: Participant): string {
		return `"${participant.firstName} ${participant.lastName}" <${participant.email}>`;
	}

	/**
	 * Create a GeneratedMessage from plugin content.
	 */
	async createMessage(options: {
		content: EmailContent;
		from: Participant;
		to: Participant[];
		cc?: Participant[];
		date: Date;
		inReplyTo?: string;
		references?: string[];
		flags?: MaildirFlag[];
	}): Promise<GeneratedMessage> {
		const messageId = this.generateMessageId();

		const message: GeneratedMessage = {
			messageId,
			date: options.date,
			from: options.from,
			to: options.to,
			cc: options.cc,
			subject: options.content.subject,
			text: options.content.text,
			html: options.content.html,
			inReplyTo: options.inReplyTo,
			references: options.references,
			attachments: options.content.attachments,
			headers: options.content.headers,
			flags: options.flags ?? [],
		};

		// Generate the raw RFC 2822 message
		message.raw = await this.compileMessage(message);

		return message;
	}

	/**
	 * Compile a message to raw RFC 2822 format using MailComposer.
	 */
	private async compileMessage(message: GeneratedMessage): Promise<Buffer> {
		const mailOptions: ConstructorParameters<typeof MailComposer>[0] = {
			from: this.formatAddress(message.from),
			to: message.to.map((p) => this.formatAddress(p)).join(", "),
			subject: message.subject,
			text: message.text,
			messageId: message.messageId,
			date: message.date,
		};

		if (message.cc && message.cc.length > 0) {
			mailOptions.cc = message.cc.map((p) => this.formatAddress(p)).join(", ");
		}

		if (message.html) {
			mailOptions.html = message.html;
		}

		if (message.inReplyTo) {
			mailOptions.inReplyTo = message.inReplyTo;
		}

		if (message.references && message.references.length > 0) {
			mailOptions.references = message.references.join(" ");
		}

		if (message.attachments && message.attachments.length > 0) {
			mailOptions.attachments = message.attachments.map((att: Attachment) => ({
				filename: att.filename,
				content: att.content,
				contentType: att.contentType,
				cid: att.cid,
			}));
		}

		// Merge custom headers
		if (message.headers) {
			mailOptions.headers = message.headers;
		}

		const mail = new MailComposer(mailOptions);

		return new Promise((resolve, reject) => {
			mail.compile().build((err, buffer) => {
				if (err) {
					reject(err);
				} else {
					resolve(buffer);
				}
			});
		});
	}

	/**
	 * Get a body excerpt from a message (for reply/forward context).
	 */
	getBodyExcerpt(message: GeneratedMessage, maxLength = 500): string {
		const text = message.text;
		if (text.length <= maxLength) {
			return text;
		}
		return `${text.substring(0, maxLength)}...`;
	}
}
