import type {
	EmailContent,
	EmailPlugin,
	GenerationContext,
	PluginCapabilities,
} from "../types.js";

/**
 * Locale-aware greetings for different languages.
 * The placeholder {name} will be replaced with the recipient's first name.
 */
const GREETINGS: Record<string, string[]> = {
	de: [
		"Hallo {name},",
		"Liebe(r) {name},",
		"Guten Tag {name},",
		"Sehr geehrte(r) {name},",
		"{name},",
	],
	fr: [
		"Bonjour {name},",
		"Salut {name},",
		"Cher/Chère {name},",
		"Bonsoir {name},",
		"{name},",
	],
	nl: [
		"Hallo {name},",
		"Beste {name},",
		"Geachte {name},",
		"Dag {name},",
		"{name},",
	],
	es: [
		"Hola {name},",
		"Querido/a {name},",
		"Estimado/a {name},",
		"Buenos días {name},",
		"{name},",
	],
	it: [
		"Ciao {name},",
		"Caro/a {name},",
		"Gentile {name},",
		"Buongiorno {name},",
		"{name},",
	],
	pt: [
		"Olá {name},",
		"Caro/a {name},",
		"Prezado/a {name},",
		"Bom dia {name},",
		"{name},",
	],
	en: ["Hi {name},", "Hey {name},", "Hello {name},", "Dear {name},", "{name},"],
};

/**
 * Locale-aware sign-offs for different languages.
 */
const SIGNOFFS: Record<string, string[]> = {
	de: [
		"Mit freundlichen Grüßen",
		"Viele Grüße",
		"Liebe Grüße",
		"Beste Grüße",
		"Bis bald",
		"Danke",
	],
	fr: [
		"Cordialement",
		"Bien cordialement",
		"Amicalement",
		"À bientôt",
		"Merci",
		"Salutations",
	],
	nl: [
		"Met vriendelijke groet",
		"Groetjes",
		"Hartelijke groet",
		"Tot ziens",
		"Bedankt",
	],
	es: ["Saludos", "Un abrazo", "Atentamente", "Hasta pronto", "Gracias"],
	it: ["Cordiali saluti", "Saluti", "A presto", "Grazie", "Cari saluti"],
	pt: ["Atenciosamente", "Abraços", "Até logo", "Obrigado/a", "Saudações"],
	en: [
		"Best",
		"Thanks",
		"Cheers",
		"Regards",
		"Best regards",
		"Talk soon",
		"Thanks!",
	],
};

/**
 * Locale-aware response starters for replies.
 */
const RESPONSE_STARTERS: Record<string, string[]> = {
	de: [
		"Danke für deine Nachricht.",
		"Guter Punkt.",
		"Ich schaue mir das an.",
		"Klingt gut.",
		"Danke für die Info.",
		"Verstanden, danke.",
		"Das ergibt Sinn.",
		"Danke für das Update.",
	],
	fr: [
		"Merci pour ton message.",
		"Bonne remarque.",
		"Je vais regarder ça.",
		"Ça me semble bien.",
		"Merci de m'avoir prévenu.",
		"Compris, merci.",
		"C'est logique.",
		"Merci pour la mise à jour.",
	],
	nl: [
		"Bedankt voor je bericht.",
		"Goed punt.",
		"Ik zal ernaar kijken.",
		"Klinkt goed.",
		"Bedankt voor de info.",
		"Begrepen, bedankt.",
		"Dat is logisch.",
		"Bedankt voor de update.",
	],
	es: [
		"Gracias por tu mensaje.",
		"Buen punto.",
		"Lo revisaré.",
		"Me parece bien.",
		"Gracias por avisarme.",
		"Entendido, gracias.",
		"Tiene sentido.",
		"Gracias por la actualización.",
	],
	it: [
		"Grazie per il tuo messaggio.",
		"Buon punto.",
		"Ci darò un'occhiata.",
		"Mi sembra bene.",
		"Grazie per l'informazione.",
		"Capito, grazie.",
		"Ha senso.",
		"Grazie per l'aggiornamento.",
	],
	pt: [
		"Obrigado pela mensagem.",
		"Bom ponto.",
		"Vou dar uma olhada.",
		"Parece bom.",
		"Obrigado por avisar.",
		"Entendido, obrigado.",
		"Faz sentido.",
		"Obrigado pela atualização.",
	],
	en: [
		"Thanks for reaching out.",
		"Good point.",
		"I'll look into that.",
		"Sounds good to me.",
		"Thanks for letting me know.",
		"Got it, thanks.",
		"Makes sense.",
		"Thanks for the update.",
	],
};

/**
 * Locale-aware forward introductions.
 */
const FORWARD_INTROS: Record<string, string[]> = {
	de: [
		"Zur Info",
		"Das könnte dich interessieren.",
		"Leite das mal weiter.",
		"Siehe unten.",
		"FYI - siehe unten",
	],
	fr: [
		"Pour info",
		"Ça pourrait t'intéresser.",
		"Je te fais suivre.",
		"Voir ci-dessous.",
		"FYI - voir ci-dessous",
	],
	nl: [
		"Ter info",
		"Dit is misschien interessant voor je.",
		"Stuur ik even door.",
		"Zie hieronder.",
		"FYI - zie hieronder",
	],
	es: [
		"Para tu información",
		"Esto podría interesarte.",
		"Te reenvío esto.",
		"Ver abajo.",
		"FYI - ver abajo",
	],
	it: [
		"Per tua informazione",
		"Potrebbe interessarti.",
		"Ti inoltro questo.",
		"Vedi sotto.",
		"FYI - vedi sotto",
	],
	pt: [
		"Para sua informação",
		"Isso pode te interessar.",
		"Encaminhando isso.",
		"Veja abaixo.",
		"FYI - veja abaixo",
	],
	en: [
		"FYI",
		"Thought you might find this interesting.",
		"Forwarding this along.",
		"See below.",
		"FYI - see below",
		"Passing this along.",
		"Thought you should see this.",
	],
};

/**
 * Get the base locale code from a locale string.
 * @example "de_AT" -> "de", "en_US" -> "en"
 */
function getBaseLocale(locale: string): string {
	const parts = locale.split("_");
	return parts[0] ?? "en";
}

/**
 * Get locale-aware options with fallback to English.
 */
function getLocaleOptions<T>(map: Record<string, T[]>, locale: string): T[] {
	const baseLocale = getBaseLocale(locale);
	return map[baseLocale] ?? map["en"] ?? [];
}

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
		const { faker, sender, recipients, requestHtml, locale } = context;

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

		const greetings = getLocaleOptions(GREETINGS, locale);
		const greetingTemplate = faker.helpers.arrayElement(greetings);
		const greeting = greetingTemplate.replace(
			"{name}",
			primaryRecipient.firstName,
		);

		const bodyParagraphs = this.generateEmailBody(context);

		const signoffs = getLocaleOptions(SIGNOFFS, locale);
		const signoff = faker.helpers.arrayElement(signoffs);

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
		const { faker, sender, parentMessage, requestHtml, locale } = context;

		if (!parentMessage) {
			throw new Error("Parent message required for reply");
		}

		const responseStarters = getLocaleOptions(RESPONSE_STARTERS, locale);
		const response = faker.helpers.arrayElement(responseStarters);
		const body = this.generateReplyBody(context);

		const signoffs = getLocaleOptions(SIGNOFFS, locale);
		const signoffOptions = [...signoffs, `-${sender.firstName}`];
		const signoff = faker.helpers.arrayElement(signoffOptions);

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
		const { faker, parentMessage, requestHtml, locale } = context;

		if (!parentMessage) {
			throw new Error("Parent message required for forward");
		}

		const introductions = getLocaleOptions(FORWARD_INTROS, locale);
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
