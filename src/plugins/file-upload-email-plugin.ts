import type {
	Attachment,
	EmailContent,
	EmailPlugin,
	GenerationContext,
	PluginCapabilities,
} from "../types.js";

type FileCategory = "export" | "document" | "report" | "media" | "archive";

interface FileTemplate {
	category: FileCategory;
	subjectTemplate: (ctx: TemplateContext) => string;
	bodyTemplate: (ctx: TemplateContext) => string;
	filenameTemplate: (ctx: TemplateContext) => string;
	contentType: string;
	extension: string;
}

interface TemplateContext {
	faker: GenerationContext["faker"];
	sender: GenerationContext["sender"];
	recipient: GenerationContext["recipients"][0];
	projectName: string;
	date: string;
}

const FILE_TEMPLATES: FileTemplate[] = [
	// Data exports
	{
		category: "export",
		subjectTemplate: ({ projectName }) =>
			`Your data export is ready: ${projectName}`,
		bodyTemplate: ({ projectName, sender }) =>
			`Your requested data export for ${projectName} is now ready for download.\n\nThe file is attached to this email. Please note that this link will expire in 7 days.\n\nIf you didn't request this export, please contact us immediately.\n\nBest regards,\n${sender.firstName}`,
		filenameTemplate: ({ projectName, date }) =>
			`${projectName.toLowerCase().replace(/\s+/g, "-")}-export-${date}.zip`,
		contentType: "application/zip",
		extension: "zip",
	},
	{
		category: "export",
		subjectTemplate: () => "Here's your file export",
		bodyTemplate: ({ sender }) =>
			`Hi,\n\nThe export you requested is attached to this email.\n\nLet me know if you have any questions.\n\nThanks,\n${sender.firstName}`,
		filenameTemplate: ({ date }) => `export-${date}.zip`,
		contentType: "application/zip",
		extension: "zip",
	},
	{
		category: "export",
		subjectTemplate: ({ projectName }) => `${projectName} - Data Export`,
		bodyTemplate: ({ projectName, recipient }) =>
			`Hi ${recipient.firstName},\n\nAttached you'll find the complete data export for ${projectName}.\n\nThe archive contains all the requested files in their original format.\n\nRegards`,
		filenameTemplate: ({ projectName, date }) =>
			`${projectName.toLowerCase().replace(/\s+/g, "_")}_${date}.tar.gz`,
		contentType: "application/gzip",
		extension: "tar.gz",
	},

	// Documents for signing
	{
		category: "document",
		subjectTemplate: () => "Documents ready for your signature",
		bodyTemplate: ({ recipient, sender }) =>
			`Dear ${recipient.firstName},\n\nPlease find attached the documents that require your signature.\n\nKindly review and sign at your earliest convenience. If you have any questions, don't hesitate to reach out.\n\nBest regards,\n${sender.firstName} ${sender.lastName}`,
		filenameTemplate: () => "documents-for-signature.pdf",
		contentType: "application/pdf",
		extension: "pdf",
	},
	{
		category: "document",
		subjectTemplate: () => "Action Required: Documents to be signed",
		bodyTemplate: ({ recipient }) =>
			`Hi ${recipient.firstName},\n\nAttached are the documents we discussed. Please review, sign, and return them by end of week.\n\nThank you for your prompt attention to this matter.`,
		filenameTemplate: ({ date }) => `agreement-${date}.pdf`,
		contentType: "application/pdf",
		extension: "pdf",
	},
	{
		category: "document",
		subjectTemplate: () => "Contract for review",
		bodyTemplate: ({ recipient, projectName }) =>
			`Dear ${recipient.firstName},\n\nPlease find attached the contract for the ${projectName} project.\n\nReview at your convenience and let me know if you have any questions or concerns.\n\nBest`,
		filenameTemplate: ({ projectName }) =>
			`${projectName.toLowerCase().replace(/\s+/g, "-")}-contract.pdf`,
		contentType: "application/pdf",
		extension: "pdf",
	},

	// Reports
	{
		category: "report",
		subjectTemplate: ({ projectName }) => `${projectName} - Monthly Report`,
		bodyTemplate: ({ recipient, projectName }) =>
			`Hi ${recipient.firstName},\n\nAttached is the monthly report for ${projectName}.\n\nKey highlights are on page 2. Let me know if you'd like to schedule a call to discuss.\n\nCheers`,
		filenameTemplate: ({ projectName, date }) =>
			`${projectName.toLowerCase().replace(/\s+/g, "-")}-report-${date}.pdf`,
		contentType: "application/pdf",
		extension: "pdf",
	},
	{
		category: "report",
		subjectTemplate: () => "Q4 Financial Report Attached",
		bodyTemplate: ({ recipient }) =>
			`${recipient.firstName},\n\nPlease find attached the Q4 financial report as discussed.\n\nThe spreadsheet contains all the raw data, and the PDF has the executive summary.\n\nLet me know if you need anything else.`,
		filenameTemplate: () => "q4-financial-report.xlsx",
		contentType:
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		extension: "xlsx",
	},
	{
		category: "report",
		subjectTemplate: () => "Analytics report - as requested",
		bodyTemplate: ({ sender }) =>
			`Hi,\n\nHere's the analytics report you asked for.\n\nThe data covers the last 30 days. I've highlighted the key metrics on the first tab.\n\nBest,\n${sender.firstName}`,
		filenameTemplate: ({ date }) => `analytics-${date}.xlsx`,
		contentType:
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		extension: "xlsx",
	},

	// Media files
	{
		category: "media",
		subjectTemplate: ({ projectName }) => `${projectName} - Final Assets`,
		bodyTemplate: ({ recipient }) =>
			`Hi ${recipient.firstName},\n\nAttached are the final design assets.\n\nThe archive includes all source files and exports in multiple formats.\n\nLet me know if you need any revisions.`,
		filenameTemplate: ({ projectName }) =>
			`${projectName.toLowerCase().replace(/\s+/g, "-")}-assets.zip`,
		contentType: "application/zip",
		extension: "zip",
	},
	{
		category: "media",
		subjectTemplate: () => "Photos from the event",
		bodyTemplate: ({ recipient }) =>
			`Hey ${recipient.firstName},\n\nHere are the photos from last week's event!\n\nI've included both high-res and web-optimized versions.\n\nEnjoy!`,
		filenameTemplate: ({ date }) => `event-photos-${date}.zip`,
		contentType: "application/zip",
		extension: "zip",
	},
	{
		category: "media",
		subjectTemplate: () => "Video files ready for download",
		bodyTemplate: ({ recipient, projectName }) =>
			`Hi ${recipient.firstName},\n\nThe video files for ${projectName} are ready.\n\nDue to the file size, I've compressed them into a zip archive. Full quality MP4s are inside.\n\nCheers`,
		filenameTemplate: ({ projectName }) =>
			`${projectName.toLowerCase().replace(/\s+/g, "-")}-video.zip`,
		contentType: "application/zip",
		extension: "zip",
	},

	// Archives and backups
	{
		category: "archive",
		subjectTemplate: ({ projectName }) => `${projectName} - Backup Archive`,
		bodyTemplate: ({ recipient, projectName, date }) =>
			`Hi ${recipient.firstName},\n\nAttached is the backup archive for ${projectName} created on ${date}.\n\nPlease store this in a secure location.\n\nRegards`,
		filenameTemplate: ({ projectName, date }) =>
			`${projectName.toLowerCase().replace(/\s+/g, "-")}-backup-${date}.zip`,
		contentType: "application/zip",
		extension: "zip",
	},
	{
		category: "archive",
		subjectTemplate: () => "Your account data archive",
		bodyTemplate: ({ recipient }) =>
			`Dear ${recipient.firstName},\n\nAs requested, please find attached a complete archive of your account data.\n\nThis includes all your content, settings, and activity history.\n\nIf you have any questions about the contents, please don't hesitate to ask.`,
		filenameTemplate: ({ date }) => `account-data-${date}.zip`,
		contentType: "application/zip",
		extension: "zip",
	},
	{
		category: "archive",
		subjectTemplate: () => "Project files - Complete archive",
		bodyTemplate: ({ projectName, sender }) =>
			`Hi,\n\nHere's the complete archive for ${projectName} including all source files, documentation, and assets.\n\nEverything is organized into folders by type.\n\nBest,\n${sender.firstName}`,
		filenameTemplate: ({ projectName }) =>
			`${projectName.toLowerCase().replace(/\s+/g, "-")}-complete.zip`,
		contentType: "application/zip",
		extension: "zip",
	},
];

/**
 * File upload email plugin for generating emails with large file attachments.
 * Represents automated file sharing, export notifications, and document delivery.
 */
export class FileUploadEmailPlugin implements EmailPlugin {
	readonly id = "file-upload";
	readonly name = "File Upload Email";
	readonly description =
		"File export notifications, document sharing, and large file delivery";
	readonly defaultWeight = 0.1;

	readonly capabilities: PluginCapabilities = {
		canBeReply: false,
		canBeForward: true,
		canBeOriginal: true,
		supportsHtml: true,
		supportsAttachments: true,
		supportsMultipleRecipients: false,
	};

	generate(context: GenerationContext): EmailContent {
		const { isForward, parentMessage } = context;

		if (isForward && parentMessage) {
			return this.generateForward(context);
		}

		return this.generateOriginal(context);
	}

	private generateOriginal(context: GenerationContext): EmailContent {
		const { faker, sender, recipients, requestHtml } = context;

		const recipient = recipients[0];
		if (!recipient) {
			throw new Error("No recipients provided");
		}

		const template = faker.helpers.arrayElement(FILE_TEMPLATES);
		const projectName = this.generateProjectName(faker);
		const date = faker.date
			.recent({ days: 7 })
			.toISOString()
			.split("T")[0] as string;

		const templateContext: TemplateContext = {
			faker,
			sender,
			recipient,
			projectName,
			date,
		};

		const subject = template.subjectTemplate(templateContext);
		const text = template.bodyTemplate(templateContext);
		const filename = template.filenameTemplate(templateContext);

		const attachment = this.generateDummyAttachment(
			faker,
			filename,
			template.contentType,
		);

		const result: EmailContent = {
			subject,
			text,
			attachments: [attachment],
		};

		if (requestHtml) {
			result.html = this.generateHtml(text, sender, recipient, filename);
		}

		return result;
	}

	private generateForward(context: GenerationContext): EmailContent {
		const { faker, parentMessage, requestHtml, sender, recipients } = context;

		if (!parentMessage) {
			throw new Error("Parent message required for forward");
		}

		const recipient = recipients[0];
		if (!recipient) {
			throw new Error("No recipients provided");
		}

		const introductions = [
			"FYI - forwarding this file along",
			"Here's that file I mentioned",
			"Passing this along as discussed",
			"See attached - thought you might need this",
			"Forwarding for your reference",
		];

		const intro = faker.helpers.arrayElement(introductions);

		const cleanSubject = parentMessage.subject.replace(/^Fwd:\s*/i, "");
		const subject = `Fwd: ${cleanSubject}`;

		const forwardHeader = `---------- Forwarded message ----------
From: ${parentMessage.from.firstName} ${parentMessage.from.lastName} <${parentMessage.from.email}>
Date: ${parentMessage.date.toUTCString()}
Subject: ${parentMessage.subject}`;

		const text = `${intro}\n\n${forwardHeader}\n\n${parentMessage.bodyExcerpt}`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = this.generateForwardHtml(
				intro,
				parentMessage,
				sender,
				recipient,
			);
		}

		return result;
	}

	private generateProjectName(faker: GenerationContext["faker"]): string {
		const patterns = [
			() => `${faker.company.buzzNoun()} ${faker.word.noun()}`,
			() => faker.company.name(),
			() => `${faker.word.adjective()} ${faker.word.noun()}`,
			() =>
				`Project ${faker.word.noun().charAt(0).toUpperCase()}${faker.word.noun().slice(1)}`,
			() => `${faker.lorem.word()} ${faker.date.month()}`,
			() => faker.commerce.productName(),
		];

		const pattern = faker.helpers.arrayElement(patterns);
		return pattern();
	}

	private generateDummyAttachment(
		faker: GenerationContext["faker"],
		filename: string,
		contentType: string,
	): Attachment {
		// Generate a dummy file with realistic-ish size
		// Real files would be much larger, but we generate small dummy content
		const sizeKb = faker.number.int({ min: 50, max: 500 });
		const content = Buffer.alloc(sizeKb * 1024, 0);

		// Add a simple header to make it slightly more realistic
		const header = `Dummy file generated by mailfuzz\nFilename: ${filename}\nSize: ${sizeKb}KB\n\n`;
		content.write(header, 0, "utf-8");

		return {
			filename,
			contentType,
			content,
		};
	}

	private generateHtml(
		text: string,
		sender: GenerationContext["sender"],
		recipient: GenerationContext["recipients"][0],
		filename: string,
	): string {
		const paragraphs = text
			.split("\n")
			.filter((p) => p.trim())
			.map((p) => `<p>${this.escapeHtml(p)}</p>`)
			.join("\n");

		return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
${paragraphs}
<div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
  <p style="margin: 0; font-size: 14px; color: #666;">
    📎 <strong>${this.escapeHtml(filename)}</strong>
  </p>
</div>
</body>
</html>`;
	}

	private generateForwardHtml(
		intro: string,
		parentMessage: GenerationContext["parentMessage"],
		sender: GenerationContext["sender"],
		recipient: GenerationContext["recipients"][0],
	): string {
		if (!parentMessage) {
			throw new Error("Parent message required");
		}

		return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
<p>${this.escapeHtml(intro)}</p>
<div style="margin-top: 20px; padding: 15px; border-left: 3px solid #ccc; background: #f9f9f9;">
  <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
    <strong>From:</strong> ${this.escapeHtml(parentMessage.from.firstName)} ${this.escapeHtml(parentMessage.from.lastName)}<br>
    <strong>Date:</strong> ${parentMessage.date.toUTCString()}<br>
    <strong>Subject:</strong> ${this.escapeHtml(parentMessage.subject)}
  </p>
  <p>${this.escapeHtml(parentMessage.bodyExcerpt)}</p>
</div>
</body>
</html>`;
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
}
