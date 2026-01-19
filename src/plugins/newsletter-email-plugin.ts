import type {
	EmailContent,
	EmailPlugin,
	GenerationContext,
	PluginCapabilities,
} from "../types.js";

type NewsletterCategory =
	| "tech"
	| "business"
	| "curated"
	| "industry"
	| "personal";

interface CategoryWeight {
	category: NewsletterCategory;
	weight: number;
}

const DEFAULT_CATEGORY_WEIGHTS: CategoryWeight[] = [
	{ category: "tech", weight: 0.25 },
	{ category: "business", weight: 0.2 },
	{ category: "curated", weight: 0.2 },
	{ category: "industry", weight: 0.2 },
	{ category: "personal", weight: 0.15 },
];

interface Publication {
	name: string;
	tagline: string;
	category: NewsletterCategory;
	frequency: "daily" | "weekly" | "monthly";
	authorName: string;
	authorTitle: string;
	domain: string;
	issueNumber: number;
}

interface LinkItem {
	title: string;
	description: string;
	url: string;
	source?: string;
}

/**
 * Newsletter email plugin for generating subscription-based content emails.
 * Represents content-focused publications that provide value through curated information.
 */
export class NewsletterEmailPlugin implements EmailPlugin {
	readonly id = "newsletter";
	readonly name = "Newsletter Email";
	readonly description =
		"Subscription-based content emails and curated publications";
	readonly defaultWeight = 0.25;

	readonly capabilities: PluginCapabilities = {
		canBeReply: false,
		canBeForward: true,
		canBeOriginal: true,
		supportsHtml: true,
		supportsAttachments: false,
		supportsMultipleRecipients: false,
	};

	generate(context: GenerationContext): EmailContent {
		const { isForward, parentMessage } = context;

		if (isForward && parentMessage) {
			return this.generateForward(context);
		}

		const category = this.selectCategory(context);

		switch (category) {
			case "tech":
				return this.generateTechNewsletter(context);
			case "business":
				return this.generateBusinessNewsletter(context);
			case "curated":
				return this.generateCuratedNewsletter(context);
			case "industry":
				return this.generateIndustryNewsletter(context);
			case "personal":
				return this.generatePersonalNewsletter(context);
		}
	}

	private selectCategory(context: GenerationContext): NewsletterCategory {
		const { faker } = context;
		const weights = DEFAULT_CATEGORY_WEIGHTS;
		const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
		const random = faker.number.float({ min: 0, max: totalWeight });

		let cumulative = 0;
		for (const { category, weight } of weights) {
			cumulative += weight;
			if (random <= cumulative) {
				return category;
			}
		}

		return "tech";
	}

	private generatePublication(
		context: GenerationContext,
		category: NewsletterCategory,
	): Publication {
		const { faker, pluginConfig } = context;

		const publicationName = pluginConfig?.["publicationName"];
		if (publicationName && typeof publicationName === "string") {
			const name = publicationName;
			return {
				name,
				tagline: faker.company.catchPhrase(),
				category,
				frequency: faker.helpers.arrayElement(["daily", "weekly", "monthly"]),
				authorName: faker.person.fullName(),
				authorTitle: "Editor",
				domain: `${name.toLowerCase().replace(/[^a-z]/g, "")}.io`,
				issueNumber: faker.number.int({ min: 1, max: 500 }),
			};
		}

		const publicationNames: Record<NewsletterCategory, string[]> = {
			tech: [
				"The Weekly Stack",
				"DevOps Digest",
				"AI Insider",
				"Security Brief",
				"Frontend Focus",
				"The Pragmatic Engineer",
			],
			business: [
				"The Hustle Daily",
				"Startup Roundup",
				"Market Pulse",
				"Founder's Journal",
				"The Morning Brew",
			],
			curated: [
				"The Sunday Reader",
				"Links Worth Your Time",
				"The Overflow",
				"Interesting Finds",
				"Weekly Digest",
			],
			industry: [
				"Healthcare Weekly",
				"Sustainability Now",
				"Remote Work Report",
				"FinTech Friday",
				"EdTech Update",
			],
			personal: [
				"Thoughts & Things",
				"Weekly Musings",
				"The Curious Mind",
				"Notes to Self",
				"The Long View",
			],
		};

		const name = faker.helpers.arrayElement(publicationNames[category]);

		const taglines: Record<NewsletterCategory, string[]> = {
			tech: [
				"Your weekly dose of tech news",
				"Code, cloud, and everything in between",
				"Keeping developers informed",
			],
			business: [
				"Business news with personality",
				"Your daily dose of startup news",
				"Markets, money, and more",
			],
			curated: [
				"The best of the web, curated for you",
				"Links that matter",
				"Quality over quantity",
			],
			industry: [
				"Industry insights delivered weekly",
				"Stay ahead of the curve",
				"News that matters to your sector",
			],
			personal: [
				"Thoughts on life, work, and everything",
				"One person's perspective",
				"Essays and observations",
			],
		};

		const frequencies: Record<
			NewsletterCategory,
			Array<"daily" | "weekly" | "monthly">
		> = {
			tech: ["weekly", "daily"],
			business: ["daily", "weekly"],
			curated: ["weekly"],
			industry: ["weekly", "monthly"],
			personal: ["weekly", "monthly"],
		};

		return {
			name,
			tagline: faker.helpers.arrayElement(taglines[category]),
			category,
			frequency: faker.helpers.arrayElement(frequencies[category]),
			authorName: faker.person.fullName(),
			authorTitle: faker.helpers.arrayElement([
				"Editor",
				"Editor-in-Chief",
				"Founder",
				"Author",
			]),
			domain: `${name.toLowerCase().replace(/[^a-z]/g, "")}.io`,
			issueNumber: faker.number.int({ min: 1, max: 500 }),
		};
	}

	private generateSubject(
		context: GenerationContext,
		publication: Publication,
		headline: string,
	): string {
		const { faker, pluginConfig } = context;

		const issueFormat = (pluginConfig?.["issueFormat"] as string) ?? "both";

		const patterns = {
			number: `${publication.name} #${publication.issueNumber}: ${headline}`,
			date: `[${publication.name}] ${faker.date.recent().toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${headline}`,
			both: `${publication.name} #${publication.issueNumber} - ${headline}`,
		};

		if (publication.category === "personal") {
			return headline;
		}

		return patterns[issueFormat as keyof typeof patterns] ?? patterns.both;
	}

	private generateLinks(context: GenerationContext, count: number): LinkItem[] {
		const { faker } = context;

		const links: LinkItem[] = [];
		for (let i = 0; i < count; i++) {
			links.push({
				title: faker.company.catchPhrase(),
				description: faker.lorem.sentence(),
				url: `https://${faker.internet.domainName()}/${faker.lorem.slug()}`,
				source: faker.company.name(),
			});
		}
		return links;
	}

	private generateTechNewsletter(context: GenerationContext): EmailContent {
		const { faker, requestHtml } = context;

		const publication = this.generatePublication(context, "tech");

		const headlines = [
			`${faker.helpers.arrayElement(["React", "Vue", "Angular", "Svelte", "Node.js"])} ${faker.number.int({ min: 15, max: 25 })}.0 is here`,
			`The state of ${faker.helpers.arrayElement(["JavaScript", "TypeScript", "Python", "Rust", "Go"])} in ${new Date().getFullYear()}`,
			`Why ${faker.helpers.arrayElement(["microservices", "monoliths", "serverless", "edge computing"])} might be the answer`,
			`${faker.helpers.arrayElement(["GitHub", "GitLab", "AWS", "Google", "Microsoft"])} announces major update`,
		];

		const headline = faker.helpers.arrayElement(headlines);
		const subject = this.generateSubject(context, publication, headline);

		const topStory = faker.lorem.paragraphs(2);
		const links = this.generateLinks(context, 5);

		const linksText = links
			.map((l) => `- ${l.title}\n  ${l.description}\n  ${l.url}`)
			.join("\n\n");

		const text = `${publication.name} #${publication.issueNumber}
${publication.tagline}

---

TOP STORY: ${headline}

${topStory}

---

WORTH READING

${linksText}

---

That's all for this issue. See you ${publication.frequency === "daily" ? "tomorrow" : "next week"}!

${publication.authorName}
${publication.authorTitle}, ${publication.name}

---
Unsubscribe: https://${publication.domain}/unsubscribe
${publication.name} | ${publication.domain}`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = this.generateNewsletterHtml(
				publication,
				headline,
				topStory,
				links,
			);
		}

		return result;
	}

	private generateBusinessNewsletter(context: GenerationContext): EmailContent {
		const { faker, requestHtml } = context;

		const publication = this.generatePublication(context, "business");

		const headlines = [
			`${faker.company.name()} raises $${faker.number.int({ min: 10, max: 500 })}M Series ${faker.helpers.arrayElement(["A", "B", "C", "D"])}`,
			`${faker.helpers.arrayElement(["IPO", "M&A", "Layoffs", "Expansion"])}: What it means for founders`,
			`The ${faker.helpers.arrayElement(["AI", "crypto", "SaaS", "fintech"])} market in ${new Date().getFullYear()}`,
			`How ${faker.person.firstName()} built a $${faker.number.int({ min: 1, max: 100 })}M company`,
		];

		const headline = faker.helpers.arrayElement(headlines);
		const subject = this.generateSubject(context, publication, headline);

		const topStory = faker.lorem.paragraphs(2);
		const marketUpdate = `Markets ${faker.helpers.arrayElement(["up", "down"])} ${faker.number.float({ min: 0.1, max: 3, fractionDigits: 2 })}% as ${faker.lorem.sentence()}`;
		const links = this.generateLinks(context, 4);

		const linksText = links
			.map((l) => `- ${l.title}\n  ${l.description}`)
			.join("\n\n");

		const text = `${publication.name}
${publication.tagline}

---

MARKET UPDATE
${marketUpdate}

---

TODAY'S TOP STORY
${headline}

${topStory}

---

QUICK HITS

${linksText}

---

${publication.authorName}
${publication.name}

Unsubscribe: https://${publication.domain}/unsubscribe`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = this.generateNewsletterHtml(
				publication,
				headline,
				topStory,
				links,
			);
		}

		return result;
	}

	private generateCuratedNewsletter(context: GenerationContext): EmailContent {
		const { faker, requestHtml } = context;

		const publication = this.generatePublication(context, "curated");

		const themeOptions = [
			"productivity",
			"creativity",
			"technology",
			"life hacks",
			"learning",
		];
		const theme = faker.helpers.arrayElement(themeOptions);
		const headline = `This week's best reads on ${theme}`;
		const subject = this.generateSubject(context, publication, headline);

		const intro = `Happy ${faker.date.weekday()}! Here are this week's most interesting finds on ${theme} and more.`;
		const links = this.generateLinks(context, 7);

		const linksText = links
			.map(
				(l, i) =>
					`${i + 1}. ${l.title}\n   ${l.description}\n   Source: ${l.source}\n   ${l.url}`,
			)
			.join("\n\n");

		const text = `${publication.name} #${publication.issueNumber}
${publication.tagline}

---

${intro}

---

THIS WEEK'S PICKS

${linksText}

---

That's all for this week. Found something interesting? Reply to this email!

${publication.authorName}

---
Unsubscribe: https://${publication.domain}/unsubscribe`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = this.generateCuratedHtml(publication, intro, links);
		}

		return result;
	}

	private generateIndustryNewsletter(context: GenerationContext): EmailContent {
		const { faker, requestHtml } = context;

		const publication = this.generatePublication(context, "industry");

		const industries = [
			"healthcare",
			"fintech",
			"edtech",
			"cleantech",
			"biotech",
		];
		const industry = faker.helpers.arrayElement(industries);

		const headlines = [
			`${this.capitalize(industry)} funding hits new high`,
			`Regulation changes coming to ${industry}`,
			`Top ${industry} trends to watch`,
			`${faker.company.name()} disrupts ${industry} market`,
		];

		const headline = faker.helpers.arrayElement(headlines);
		const subject = this.generateSubject(context, publication, headline);

		const analysis = faker.lorem.paragraphs(3);
		const links = this.generateLinks(context, 4);

		const linksText = links
			.map((l) => `- ${l.title}: ${l.description}`)
			.join("\n");

		const text = `${publication.name}
${publication.tagline}

---

INDUSTRY ANALYSIS

${headline}

${analysis}

---

NEWS ROUNDUP

${linksText}

---

Questions? Feedback? Reply to this email.

${publication.authorName}
${publication.authorTitle}

Unsubscribe: https://${publication.domain}/unsubscribe`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = this.generateNewsletterHtml(
				publication,
				headline,
				analysis,
				links,
			);
		}

		return result;
	}

	private generatePersonalNewsletter(context: GenerationContext): EmailContent {
		const { faker, requestHtml } = context;

		const publication = this.generatePublication(context, "personal");

		const headlines = [
			`Some thoughts on ${faker.helpers.arrayElement(["quitting my job", "starting over", "saying no", "slowing down"])}`,
			`What I learned this ${faker.helpers.arrayElement(["week", "month", "year"])}`,
			`Issue #${publication.issueNumber}: ${faker.helpers.arrayElement(["Reflections", "Updates", "Thoughts", "Notes"])}`,
			"Quick update + an announcement",
			`On ${faker.word.noun()}s and ${faker.word.noun()}s`,
		];

		const headline = faker.helpers.arrayElement(headlines);
		const subject = headline;

		const greeting = faker.helpers.arrayElement([
			"Hey friends,",
			"Hi there,",
			"Hello,",
			"Hey everyone,",
		]);

		const body = faker.lorem.paragraphs({ min: 3, max: 6 });

		const signoff = faker.helpers.arrayElement([
			"Until next time",
			"Talk soon",
			"Thanks for reading",
			"More soon",
		]);

		const text = `${greeting}

${body}

---

${signoff},
${publication.authorName}

P.S. ${faker.lorem.sentence()}

---
Unsubscribe: https://${publication.domain}/unsubscribe
Reply to this email anytime - I read everything!`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.8; color: #333;">
<p>${this.escapeHtml(greeting)}</p>
${body
	.split("\n\n")
	.map((p) => `<p>${this.escapeHtml(p)}</p>`)
	.join("\n")}
<hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
<p>${this.escapeHtml(signoff)},<br>${this.escapeHtml(publication.authorName)}</p>
<p style="font-style: italic; color: #666;">P.S. ${this.escapeHtml(faker.lorem.sentence())}</p>
<hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
<p style="font-size: 12px; color: #999;">
<a href="https://${publication.domain}/unsubscribe" style="color: #999;">Unsubscribe</a><br>
Reply to this email anytime - I read everything!
</p>
</body>
</html>`;
		}

		return result;
	}

	private generateForward(context: GenerationContext): EmailContent {
		const { faker, parentMessage } = context;

		if (!parentMessage) {
			throw new Error("Parent message required for forward");
		}

		const intros = [
			"Thought you might find this newsletter interesting.",
			"This article made me think of you.",
			"Great insights in this one - worth a read.",
			"FYI - relevant to what we discussed.",
			"You should check this out.",
		];

		const intro = faker.helpers.arrayElement(intros);

		const cleanSubject = parentMessage.subject.replace(/^Fwd:\s*/i, "");
		const subject = `Fwd: ${cleanSubject}`;

		const forwardHeader = `---------- Forwarded Newsletter ----------
From: ${parentMessage.from.firstName} ${parentMessage.from.lastName} <${parentMessage.from.email}>
Date: ${parentMessage.date.toUTCString()}
Subject: ${parentMessage.subject}`;

		const text = `${intro}

${forwardHeader}

${parentMessage.bodyExcerpt}`;

		const result: EmailContent = { subject, text };

		if (context.requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif;">
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

	private generateNewsletterHtml(
		publication: Publication,
		headline: string,
		topStory: string,
		links: LinkItem[],
	): string {
		return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
<table width="600" align="center" style="background-color: white; border-collapse: collapse;">
<tr>
<td style="padding: 30px; border-bottom: 2px solid #333;">
<h1 style="margin: 0; font-size: 24px;">${this.escapeHtml(publication.name)}</h1>
<p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">${this.escapeHtml(publication.tagline)}</p>
</td>
</tr>
<tr>
<td style="padding: 30px;">
<p style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Issue #${publication.issueNumber}</p>
<h2 style="margin: 10px 0 20px 0; font-size: 28px; line-height: 1.3;">${this.escapeHtml(headline)}</h2>
${topStory
	.split("\n\n")
	.map(
		(p) =>
			`<p style="color: #444; line-height: 1.7;">${this.escapeHtml(p)}</p>`,
	)
	.join("\n")}
</td>
</tr>
<tr>
<td style="padding: 0 30px 30px 30px;">
<h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px;">Worth Reading</h3>
${links
	.map(
		(link) => `
<div style="margin-bottom: 20px;">
<h4 style="margin: 0 0 5px 0;"><a href="${this.escapeHtml(link.url)}" style="color: #0066cc; text-decoration: none;">${this.escapeHtml(link.title)}</a></h4>
<p style="margin: 0; color: #666; font-size: 14px;">${this.escapeHtml(link.description)}</p>
${link.source ? `<p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">via ${this.escapeHtml(link.source)}</p>` : ""}
</div>`,
	)
	.join("")}
</td>
</tr>
<tr>
<td style="background-color: #f8f8f8; padding: 30px; text-align: center;">
<p style="margin: 0 0 10px 0; color: #666;">${this.escapeHtml(publication.authorName)}</p>
<p style="margin: 0; color: #999; font-size: 14px;">${this.escapeHtml(publication.authorTitle)}, ${this.escapeHtml(publication.name)}</p>
</td>
</tr>
<tr>
<td style="padding: 20px; text-align: center; font-size: 12px; color: #999;">
<p style="margin: 0;"><a href="https://${publication.domain}/unsubscribe" style="color: #999;">Unsubscribe</a> | <a href="https://${publication.domain}" style="color: #999;">View in browser</a></p>
<p style="margin: 10px 0 0 0;">${this.escapeHtml(publication.name)} | ${publication.domain}</p>
</td>
</tr>
</table>
</body>
</html>`;
	}

	private generateCuratedHtml(
		publication: Publication,
		intro: string,
		links: LinkItem[],
	): string {
		return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
<table width="600" align="center" style="background-color: white; border-collapse: collapse;">
<tr>
<td style="padding: 30px; border-bottom: 2px solid #333;">
<h1 style="margin: 0; font-size: 24px;">${this.escapeHtml(publication.name)}</h1>
<p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Issue #${publication.issueNumber}</p>
</td>
</tr>
<tr>
<td style="padding: 30px;">
<p style="color: #444; line-height: 1.7; font-size: 16px;">${this.escapeHtml(intro)}</p>
</td>
</tr>
<tr>
<td style="padding: 0 30px 30px 30px;">
<h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px;">This Week's Picks</h3>
${links
	.map(
		(link, i) => `
<div style="margin-bottom: 25px; padding-left: 20px; border-left: 3px solid #0066cc;">
<span style="color: #0066cc; font-weight: bold; font-size: 14px;">${i + 1}</span>
<h4 style="margin: 5px 0;"><a href="${this.escapeHtml(link.url)}" style="color: #333; text-decoration: none;">${this.escapeHtml(link.title)}</a></h4>
<p style="margin: 5px 0; color: #666; font-size: 14px;">${this.escapeHtml(link.description)}</p>
<p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">via ${this.escapeHtml(link.source ?? "")}</p>
</div>`,
	)
	.join("")}
</td>
</tr>
<tr>
<td style="background-color: #f8f8f8; padding: 30px; text-align: center;">
<p style="margin: 0; color: #666;">Found something interesting? Reply to this email!</p>
<p style="margin: 10px 0 0 0; color: #999; font-size: 14px;">${this.escapeHtml(publication.authorName)}</p>
</td>
</tr>
<tr>
<td style="padding: 20px; text-align: center; font-size: 12px; color: #999;">
<a href="https://${publication.domain}/unsubscribe" style="color: #999;">Unsubscribe</a>
</td>
</tr>
</table>
</body>
</html>`;
	}

	private capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
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
