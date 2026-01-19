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

/**
 * Fixed pool of publications to generate multiple issues from the same newsletters.
 * This creates a more realistic inbox where you see recurring publications.
 */
const PUBLICATION_POOL: Array<{
	name: string;
	category: NewsletterCategory;
	baseIssue: number;
}> = [
	// Tech newsletters
	{ name: "The Weekly Stack", category: "tech", baseIssue: 142 },
	{ name: "DevOps Digest", category: "tech", baseIssue: 89 },
	{ name: "AI Insider", category: "tech", baseIssue: 56 },
	{ name: "Frontend Focus", category: "tech", baseIssue: 234 },
	// Business newsletters
	{ name: "The Hustle Daily", category: "business", baseIssue: 1204 },
	{ name: "Startup Roundup", category: "business", baseIssue: 312 },
	{ name: "Market Pulse", category: "business", baseIssue: 178 },
	// Curated newsletters
	{ name: "The Sunday Reader", category: "curated", baseIssue: 89 },
	{ name: "Links Worth Your Time", category: "curated", baseIssue: 156 },
	{ name: "The Overflow", category: "curated", baseIssue: 203 },
	// Industry newsletters
	{ name: "FinTech Friday", category: "industry", baseIssue: 67 },
	{ name: "Healthcare Weekly", category: "industry", baseIssue: 134 },
	// Personal newsletters
	{ name: "Thoughts & Things", category: "personal", baseIssue: 45 },
	{ name: "The Curious Mind", category: "personal", baseIssue: 78 },
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

		// Select from the fixed pool to generate multiple issues of the same newsletter
		const poolForCategory = PUBLICATION_POOL.filter(
			(p) => p.category === category,
		);
		const selectedPub = faker.helpers.arrayElement(poolForCategory);

		// Generate issue number based on base + offset (creates sequential-ish issues)
		const issueOffset = faker.number.int({ min: 0, max: 20 });
		const issueNumber = selectedPub.baseIssue + issueOffset;

		// Use locale-aware taglines
		const tagline = this.generateTagline(context);

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

		// Generate consistent author for publication using name as seed modifier
		const authorName = faker.person.fullName();

		return {
			name: selectedPub.name,
			tagline,
			category,
			frequency: faker.helpers.arrayElement(frequencies[category]),
			authorName,
			authorTitle: faker.helpers.arrayElement([
				"Editor",
				"Editor-in-Chief",
				"Founder",
				"Author",
			]),
			domain: `${selectedPub.name.toLowerCase().replace(/[^a-z]/g, "")}.io`,
			issueNumber,
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
				title: this.generateLinkTitle(context),
				description: this.generateLinkDescription(context),
				url: `https://${faker.internet.domainName()}/articles/${faker.string.alphanumeric(8)}`,
				source: faker.company.name(),
			});
		}
		return links;
	}

	private generateTechNewsletter(context: GenerationContext): EmailContent {
		const { faker, requestHtml } = context;

		const publication = this.generatePublication(context, "tech");

		const techTopics = [
			"React",
			"Vue",
			"Angular",
			"Svelte",
			"Node.js",
			"TypeScript",
			"Rust",
			"Go",
			"Python",
			"Kubernetes",
		];
		const mainTopic = faker.helpers.arrayElement(techTopics);

		const headlines = [
			`${mainTopic} ${faker.number.int({ min: 15, max: 25 })}.0 is here`,
			`The state of ${mainTopic} in ${new Date().getFullYear()}`,
			`Why ${faker.helpers.arrayElement(["microservices", "monoliths", "serverless", "edge computing"])} might be the answer`,
			`${faker.helpers.arrayElement(["GitHub", "GitLab", "AWS", "Google", "Microsoft"])} announces major update`,
		];

		const headline = faker.helpers.arrayElement(headlines);
		const subject = this.generateSubject(context, publication, headline);

		const topStory = this.generateArticleContent(context, mainTopic, 3);
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

		const topStory = this.generateArticleContent(
			context,
			"business strategy",
			3,
		);
		const marketUpdate = `Markets ${faker.helpers.arrayElement(["up", "down"])} ${faker.number.float({ min: 0.1, max: 3, fractionDigits: 2 })}% as investors ${faker.helpers.arrayElement(["react to earnings reports", "digest economic data", "await Federal Reserve decision", "weigh geopolitical concerns", "assess tech sector outlook"])}`;
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

		const analysis = this.generateArticleContent(context, industry, 4);
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

		const personalTopics = [
			"personal growth",
			"creativity",
			"productivity",
			"life lessons",
			"work-life balance",
		];
		const topic = faker.helpers.arrayElement(personalTopics);
		const body = this.generatePersonalEssay(context, topic);

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

P.S. ${faker.helpers.arrayElement([
			"If you enjoyed this, consider sharing it with a friend.",
			`Next week I'm diving into something completely different. Stay tuned.`,
			`I've been working on something new—more details coming soon.`,
			"Your replies from last week were amazing. Thank you for reading.",
			"Hit reply and let me know what you think. I read every response.",
		])}

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
<p style="font-style: italic; color: #666;">P.S. ${this.escapeHtml(
				faker.helpers.arrayElement([
					"If you enjoyed this, consider sharing it with a friend.",
					"Next week I'm diving into something completely different. Stay tuned.",
					"I've been working on something new—more details coming soon.",
					"Your replies from last week were amazing. Thank you for reading.",
					"Hit reply and let me know what you think. I read every response.",
				]),
			)}</p>
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

	/**
	 * Generate contextual article content instead of lorem ipsum.
	 * Creates more realistic newsletter-style prose.
	 */
	private generateArticleContent(
		context: GenerationContext,
		topic: string,
		paragraphCount: number,
	): string {
		const { faker } = context;

		const openings = [
			`The ${topic} landscape has evolved significantly over the past year.`,
			`When we first started covering ${topic}, few could have predicted where we'd be today.`,
			`This week brought some fascinating developments in the ${topic} space.`,
			`Industry experts have been buzzing about recent changes to ${topic}.`,
			`If you've been following ${topic} closely, you'll know this has been a pivotal moment.`,
			`The conversation around ${topic} has shifted dramatically in recent months.`,
		];

		const middles = [
			`According to ${faker.company.name()}, the market has seen a ${faker.number.int({ min: 15, max: 85 })}% increase in adoption. This trend shows no signs of slowing down, as more organizations recognize the value of investing in this space.`,
			`"We're seeing unprecedented interest from both enterprise and consumer markets," said ${faker.person.fullName()}, ${faker.person.jobTitle()} at ${faker.company.name()}. The implications for the broader industry are significant.`,
			`Several key players have made major announcements this week. ${faker.company.name()} unveiled their new strategy, while ${faker.company.name()} doubled down on their existing approach. The competitive dynamics are shifting rapidly.`,
			`What makes this particularly interesting is the intersection with broader trends. As ${faker.company.buzzPhrase()} becomes more prevalent, we're likely to see even more innovation in this area.`,
			`The data tells a compelling story. Research from ${faker.company.name()} indicates that ${faker.number.int({ min: 60, max: 90 })}% of industry leaders are prioritizing this in their ${new Date().getFullYear()} roadmaps.`,
			`This isn't just about technology—it's about fundamentally rethinking how we approach ${faker.company.buzzNoun()}. The most successful organizations are those that understand this distinction.`,
		];

		const closings = [
			`Looking ahead, we expect these trends to accelerate. The question isn't whether to adapt, but how quickly you can move.`,
			`We'll continue monitoring this space closely. In the meantime, consider how these developments might affect your own strategy.`,
			"As always, we recommend taking a measured approach. Not every trend deserves immediate action, but this one warrants attention.",
			`The bottom line: this is a space worth watching. We'll have more analysis in next week's issue.`,
		];

		const paragraphs: string[] = [];
		paragraphs.push(faker.helpers.arrayElement(openings));

		for (let i = 0; i < paragraphCount - 2; i++) {
			paragraphs.push(faker.helpers.arrayElement(middles));
		}

		if (paragraphCount > 1) {
			paragraphs.push(faker.helpers.arrayElement(closings));
		}

		return paragraphs.join("\n\n");
	}

	/**
	 * Generate structured HTML article with headers and sections.
	 */
	private generateLongFormHtmlContent(
		context: GenerationContext,
		topic: string,
	): string {
		const { faker } = context;

		const sections = [
			{
				header: `What's New in ${this.capitalize(topic)}`,
				content: this.generateArticleContent(context, topic, 2),
			},
			{
				header: "Key Takeaways",
				content: `<ul style="line-height: 1.8;">
<li>${faker.company.buzzPhrase()} is becoming increasingly important</li>
<li>Early adopters are seeing ${faker.number.int({ min: 20, max: 60 })}% improvements in efficiency</li>
<li>The market is projected to grow to $${faker.number.int({ min: 10, max: 500 })}B by ${new Date().getFullYear() + 3}</li>
<li>${faker.company.name()} and ${faker.company.name()} are leading the charge</li>
</ul>`,
			},
			{
				header: "Expert Analysis",
				content: this.generateArticleContent(context, topic, 3),
			},
			{
				header: "What This Means For You",
				content: this.generateArticleContent(context, topic, 2),
			},
		];

		return sections
			.map(
				(section) =>
					`<h3 style="color: #333; margin-top: 30px; padding-bottom: 10px; border-bottom: 1px solid #eee;">${this.escapeHtml(section.header)}</h3>\n${
						section.content.includes("<")
							? section.content
							: section.content
									.split("\n\n")
									.map(
										(p) =>
											`<p style="color: #444; line-height: 1.7;">${this.escapeHtml(p)}</p>`,
									)
									.join("\n")
					}`,
			)
			.join("\n");
	}

	/**
	 * Generate a personal essay style newsletter content.
	 */
	private generatePersonalEssay(
		context: GenerationContext,
		topic: string,
	): string {
		const { faker } = context;

		const openings = [
			`I've been thinking a lot about ${topic} lately.`,
			`Something happened this week that got me reflecting on ${topic}.`,
			`A conversation with a friend reminded me why ${topic} matters so much.`,
			`I wasn't planning to write about ${topic} today, but here we are.`,
			`Let me tell you about a lesson I learned about ${topic}.`,
		];

		const middles = [
			`The thing is, most of us approach ${topic} completely wrong. We assume it's about doing more, when really it's about doing less of the wrong things. I learned this the hard way after years of ${faker.word.verb()}ing my way through life.`,
			`When I talk to people about ${topic}, I notice a pattern. They know what they should do, but something holds them back. Fear, mostly. Fear of ${faker.word.verb()}ing wrong. Fear of what others might think. Fear of actually succeeding.`,
			`Here's what ${faker.number.int({ min: 10, max: 20 })} years of experience has taught me: ${topic} isn't a destination. It's a practice. Some days you'll feel like you've figured it all out. Other days, you'll wonder if you know anything at all. Both are normal.`,
			`I used to think ${topic} was about big, dramatic changes. Grand gestures. Transformative moments. Now I know better. It's the small, daily choices that compound over time. The boring stuff that nobody talks about.`,
			`The best advice I ever received about ${topic} came from an unexpected place. A ${faker.person.jobTitle()} I met at a ${faker.company.catchPhraseAdjective()} conference told me something that changed everything: "Stop optimizing and start experiencing."`,
		];

		const closings = [
			`So that's what I've been mulling over this week. No grand conclusions, just observations. Sometimes that's enough.`,
			`I'm still figuring this out, honestly. But I wanted to share where I am in my thinking. Maybe it resonates with you too.`,
			`This is all to say: give yourself permission to be imperfect. To experiment. To change your mind. That's where the real growth happens.`,
			"Thanks for letting me think out loud with you. These newsletters are as much for me as they are for you—a way to process and reflect.",
		];

		const paragraphs: string[] = [];
		paragraphs.push(faker.helpers.arrayElement(openings));

		const middleCount = faker.number.int({ min: 2, max: 4 });
		for (let i = 0; i < middleCount; i++) {
			paragraphs.push(faker.helpers.arrayElement(middles));
		}

		paragraphs.push(faker.helpers.arrayElement(closings));

		return paragraphs.join("\n\n");
	}

	/**
	 * Generate a locale-aware tagline using hybrid approach.
	 */
	private generateTagline(context: GenerationContext): string {
		const { faker } = context;
		const patterns = [
			() => faker.company.catchPhrase(),
			() =>
				`${this.capitalize(faker.word.adjective())} ${faker.word.noun()} ${faker.word.adverb()}`,
			() =>
				`${this.capitalize(faker.word.noun())} ${faker.word.preposition()} ${faker.word.noun()}`,
			() =>
				`${this.capitalize(faker.word.verb())} ${faker.word.adjective()} ${faker.word.noun()}`,
		];
		return faker.helpers.arrayElement(patterns)();
	}

	/**
	 * Generate a locale-aware link description using hybrid approach.
	 */
	private generateLinkDescription(context: GenerationContext): string {
		const { faker } = context;
		const patterns = [
			() =>
				`${this.capitalize(faker.word.adjective())} ${faker.word.noun()} ${faker.word.preposition()} ${faker.word.adjective()} ${faker.word.noun()}.`,
			() =>
				`${this.capitalize(faker.word.verb())} ${faker.word.noun()} ${faker.word.adverb()}.`,
			() => `${faker.company.catchPhrase()}.`,
			() =>
				`${faker.company.name()}: ${this.capitalize(faker.word.adjective())} ${faker.word.noun()}.`,
			() =>
				`${this.capitalize(faker.word.adjective())} ${faker.word.noun()} ${faker.word.verb()} ${faker.word.noun()}.`,
		];
		return faker.helpers.arrayElement(patterns)();
	}

	/**
	 * Generate a locale-aware link title using hybrid approach.
	 */
	private generateLinkTitle(context: GenerationContext): string {
		const { faker } = context;
		const patterns = [
			() =>
				`${this.capitalize(faker.word.adjective())} ${this.capitalize(faker.word.noun())}`,
			() =>
				`${this.capitalize(faker.word.verb())} ${this.capitalize(faker.word.noun())} ${faker.word.adverb()}`,
			() => `${faker.company.catchPhrase()}`,
			() => `${faker.company.name()}: ${this.capitalize(faker.word.noun())}`,
			() =>
				`${this.capitalize(faker.word.adjective())} ${this.capitalize(faker.word.noun())} ${new Date().getFullYear()}`,
			() =>
				`${this.capitalize(faker.word.verb())} ${faker.word.preposition()} ${this.capitalize(faker.word.noun())}`,
		];
		return faker.helpers.arrayElement(patterns)();
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
