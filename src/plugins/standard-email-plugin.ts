import type {
	EmailContent,
	EmailPlugin,
	GenerationContext,
	PluginCapabilities,
} from "../types.js";

/**
 * Standard email plugin for generating personal/business correspondence.
 * Supports replies, forwards, and original emails with HTML.
 */
export class StandardEmailPlugin implements EmailPlugin {
	readonly id = "standard";
	readonly name = "Standard Email";
	readonly description =
		"Personal and business correspondence with replies and forwards";
	readonly defaultWeight = 1.0;

	readonly capabilities: PluginCapabilities = {
		canBeReply: true,
		canBeForward: true,
		canBeOriginal: true,
		supportsHtml: true,
		supportsAttachments: false,
		supportsMultipleRecipients: true,
	};

	generate(context: GenerationContext): EmailContent {
		const { isReply, isForward, parentMessage } = context;

		if (isReply && parentMessage) {
			return this.generateReply(context);
		}

		if (isForward && parentMessage) {
			return this.generateForward(context);
		}

		return this.generateOriginal(context);
	}

	private generateOriginal(context: GenerationContext): EmailContent {
		const { faker, sender, recipients, requestHtml } = context;

		const primaryRecipient = recipients[0];
		if (!primaryRecipient) {
			throw new Error("No recipients provided");
		}

		const subjectTemplates = [
			() => `Quick question about ${faker.company.buzzNoun()}`,
			() => `Following up on our ${faker.word.noun()}`,
			() => faker.company.catchPhrase(),
			() => `Meeting ${faker.date.weekday()}?`,
			() => `Re: ${faker.company.buzzPhrase()}`,
			() => `${faker.word.adjective()} ${faker.word.noun()} update`,
			() => `Can you help with ${faker.word.noun()}?`,
			() => `Thoughts on ${faker.company.buzzNoun()}?`,
		];

		const subjectTemplate = faker.helpers.arrayElement(subjectTemplates);
		const subject = subjectTemplate();

		const greeting = faker.helpers.arrayElement([
			`Hi ${primaryRecipient.firstName},`,
			`Hey ${primaryRecipient.firstName},`,
			`Hello ${primaryRecipient.firstName},`,
			`Dear ${primaryRecipient.firstName},`,
			`${primaryRecipient.firstName},`,
		]);

		const bodyParagraphs = this.generateEmailBody(context);

		const signoff = faker.helpers.arrayElement([
			"Best",
			"Thanks",
			"Cheers",
			"Regards",
			"Best regards",
			"Talk soon",
			"Thanks!",
		]);

		const text = `${greeting}\n\n${bodyParagraphs}\n\n${signoff},\n${sender.firstName}`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			const htmlParagraphs = bodyParagraphs
				.split("\n")
				.filter((p) => p.trim())
				.map((p) => `<p>${this.escapeHtml(p)}</p>`)
				.join("\n");

			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<p>${this.escapeHtml(greeting)}</p>
${htmlParagraphs}
<p>${this.escapeHtml(signoff)},<br>${this.escapeHtml(sender.firstName)}</p>
</body>
</html>`;
		}

		return result;
	}

	private generateReply(context: GenerationContext): EmailContent {
		const { faker, sender, parentMessage, requestHtml } = context;

		if (!parentMessage) {
			throw new Error("Parent message required for reply");
		}

		const responseStarters = [
			"Thanks for reaching out.",
			"Good point.",
			`I'll look into that.`,
			"Sounds good to me.",
			"Thanks for letting me know.",
			"Got it, thanks.",
			"Makes sense.",
			"I appreciate you sharing this.",
			"Thanks for the update.",
			"I see what you mean.",
		];

		const response = faker.helpers.arrayElement(responseStarters);
		const body = this.generateReplyBody(context);

		const signoff = faker.helpers.arrayElement([
			"Best",
			"Thanks",
			"Cheers",
			`-${sender.firstName}`,
		]);

		const text = `${response}\n\n${body}\n\n${signoff}`;

		// Handle Re: prefix - don't double it
		const subject = parentMessage.subject.startsWith("Re:")
			? parentMessage.subject
			: `Re: ${parentMessage.subject}`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<p>${this.escapeHtml(response)}</p>
<p>${this.escapeHtml(body)}</p>
<p>${this.escapeHtml(signoff)}</p>
</body>
</html>`;
		}

		return result;
	}

	private generateForward(context: GenerationContext): EmailContent {
		const { faker, parentMessage, requestHtml } = context;

		if (!parentMessage) {
			throw new Error("Parent message required for forward");
		}

		const introductions = [
			"FYI",
			"Thought you might find this interesting.",
			"Forwarding this along.",
			"See below.",
			"FYI - see below",
			"Passing this along.",
			"Thought you should see this.",
		];

		const intro = faker.helpers.arrayElement(introductions);

		// Remove existing Fwd: prefix if present
		const cleanSubject = parentMessage.subject.replace(/^Fwd:\s*/i, "");
		const subject = `Fwd: ${cleanSubject}`;

		const forwardHeader = `---------- Forwarded message ----------
From: ${parentMessage.from.firstName} ${parentMessage.from.lastName} <${parentMessage.from.email}>
Date: ${parentMessage.date.toUTCString()}
Subject: ${parentMessage.subject}`;

		const text = `${intro}\n\n${forwardHeader}\n\n${parentMessage.bodyExcerpt}`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<p>${this.escapeHtml(intro)}</p>
<hr>
<div style="margin-left: 1em; padding-left: 1em; border-left: 2px solid #ccc;">
<p><strong>From:</strong> ${this.escapeHtml(parentMessage.from.firstName)} ${this.escapeHtml(parentMessage.from.lastName)} &lt;${this.escapeHtml(parentMessage.from.email)}&gt;<br>
<strong>Date:</strong> ${this.escapeHtml(parentMessage.date.toUTCString())}<br>
<strong>Subject:</strong> ${this.escapeHtml(parentMessage.subject)}</p>
<p>${this.escapeHtml(parentMessage.bodyExcerpt)}</p>
</div>
</body>
</html>`;
		}

		return result;
	}

	/**
	 * Generate contextual email body content instead of lorem ipsum.
	 */
	private generateEmailBody(context: GenerationContext): string {
		const { faker } = context;

		const paragraphOptions = [
			`I wanted to reach out about the ${faker.company.buzzNoun()} we discussed. I've been thinking about it more and have some ideas I'd like to share with you.`,
			`Hope you're doing well. I've been meaning to follow up on our last conversation about ${faker.company.buzzPhrase()}.`,
			`Just wanted to check in and see how things are going on your end. I know you've been busy with ${faker.company.buzzNoun()}.`,
			`I came across something interesting that made me think of our previous discussion. It relates to ${faker.company.catchPhrase().toLowerCase()}.`,
			`Quick update on my end: things have been progressing well with ${faker.company.buzzNoun()}. I'd love to get your thoughts when you have a moment.`,
			`I've been reviewing the ${faker.company.buzzNoun()} materials and have some questions. Would you have time to chat this week?`,
			`Thanks for your patience while I looked into this. I think I have some useful information to share about ${faker.company.buzzNoun()}.`,
		];

		const followUps = [
			"Let me know what you think when you get a chance.",
			"Would be great to catch up soon.",
			`Happy to discuss further if you're interested.`,
			"Looking forward to hearing your thoughts.",
			"No rush on this, just wanted to keep you in the loop.",
		];

		const paragraphCount = faker.number.int({ min: 1, max: 3 });
		const paragraphs: string[] = [];

		for (let i = 0; i < paragraphCount; i++) {
			paragraphs.push(faker.helpers.arrayElement(paragraphOptions));
		}

		if (faker.datatype.boolean()) {
			paragraphs.push(faker.helpers.arrayElement(followUps));
		}

		return paragraphs.join("\n\n");
	}

	/**
	 * Generate contextual reply body content.
	 */
	private generateReplyBody(context: GenerationContext): string {
		const { faker } = context;

		const replyBodies = [
			`I'll take a look at this and get back to you by end of day. If you need anything sooner, just let me know.`,
			`That's a great point. I hadn't considered that angle before. Let me think about it and we can discuss further.`,
			`Happy to help with this. I've dealt with similar situations before and have some ideas that might work.`,
			`I'll check my calendar and send over some times that work. Should be able to find something this week.`,
			`Sounds good to me. I'll follow up with the team and circle back once I have more information.`,
			`Thanks for clarifying. That makes more sense now. I'll proceed with the approach you suggested.`,
			`I agree with your assessment. Let's move forward with the plan and see how it goes.`,
			`Good question. I'll need to do some digging on my end. Will update you once I know more.`,
		];

		return faker.helpers.arrayElement(replyBodies);
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
