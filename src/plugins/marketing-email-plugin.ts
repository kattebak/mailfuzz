import type {
	EmailContent,
	EmailPlugin,
	GenerationContext,
	Participant,
	PluginCapabilities,
} from "../types.js";

type MarketingCategory =
	| "promotional"
	| "product"
	| "abandoned-cart"
	| "loyalty"
	| "reengagement";

interface CategoryWeight {
	category: MarketingCategory;
	weight: number;
}

const DEFAULT_CATEGORY_WEIGHTS: CategoryWeight[] = [
	{ category: "promotional", weight: 0.35 },
	{ category: "product", weight: 0.25 },
	{ category: "abandoned-cart", weight: 0.15 },
	{ category: "loyalty", weight: 0.15 },
	{ category: "reengagement", weight: 0.1 },
];

interface Brand {
	name: string;
	tagline: string;
	domain: string;
	industry: string;
	primaryColor: string;
	sender: Participant;
}

/**
 * Bulk email service domains - typical marketing email senders.
 */
const BULK_EMAIL_DOMAINS = [
	"mail.sendgrid.net",
	"em.mailchimp.com",
	"bounce.mailjet.com",
	"mail.klaviyo.com",
	"t.mailersend.com",
	"email.campaign-archive.com",
	"mailer.constantcontact.com",
	"bounce.brevo.com",
	"mta.marketo.com",
	"email.hubspot.com",
	"promo.mailgun.org",
	"bulk.intercom-mail.com",
];

/**
 * Sender prefixes for marketing emails.
 */
const SENDER_PREFIXES = [
	"no-reply",
	"noreply",
	"info",
	"hello",
	"deals",
	"offers",
	"promo",
	"marketing",
	"news",
	"updates",
	"shop",
	"store",
	"team",
	"support",
];

const INDUSTRIES = [
	"retail",
	"saas",
	"travel",
	"food",
	"fashion",
	"electronics",
	"fitness",
];

/**
 * Marketing email plugin for generating legitimate promotional content.
 * Represents opted-in commercial communications with proper branding and unsubscribe mechanisms.
 */
export class MarketingEmailPlugin implements EmailPlugin {
	readonly id = "marketing";
	readonly name = "Marketing Email";
	readonly description =
		"Promotional emails, product announcements, and loyalty campaigns";
	readonly defaultWeight = 0.5;

	readonly capabilities: PluginCapabilities = {
		canBeReply: false,
		canBeForward: false,
		canBeOriginal: true,
		supportsHtml: true,
		supportsAttachments: false,
		supportsMultipleRecipients: false,
	};

	generate(context: GenerationContext): EmailContent {
		const category = this.selectCategory(context);

		switch (category) {
			case "promotional":
				return this.generatePromotional(context);
			case "product":
				return this.generateProductAnnouncement(context);
			case "abandoned-cart":
				return this.generateAbandonedCart(context);
			case "loyalty":
				return this.generateLoyalty(context);
			case "reengagement":
				return this.generateReengagement(context);
		}
	}

	private selectCategory(context: GenerationContext): MarketingCategory {
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

		return "promotional";
	}

	private generateBrand(context: GenerationContext): Brand {
		const { faker, pluginConfig } = context;

		const brandName = pluginConfig?.["brandName"];
		if (brandName && typeof brandName === "string") {
			const name = brandName;
			const domain = `${name.toLowerCase().replace(/[^a-z]/g, "")}.com`;
			return {
				name,
				tagline: faker.company.catchPhrase(),
				domain,
				industry: faker.helpers.arrayElement(INDUSTRIES),
				primaryColor: faker.color.rgb(),
				sender: this.generateSender(context, name, domain),
			};
		}

		const industry = faker.helpers.arrayElement(INDUSTRIES);

		const namePatterns: Record<string, () => string> = {
			retail: () =>
				`${this.capitalize(faker.word.adjective())} ${this.capitalize(faker.word.noun())}`,
			fashion: () => `${faker.person.lastName()} & Co.`,
			saas: () =>
				`${this.capitalize(faker.hacker.verb())}${this.capitalize(faker.word.noun())}`,
			travel: () =>
				`${this.capitalize(faker.word.adjective())} ${faker.helpers.arrayElement(["Travels", "Journeys", "Adventures", "Escapes"])}`,
			food: () =>
				`${faker.person.firstName()}'s ${faker.helpers.arrayElement(["Kitchen", "Pantry", "Table", "Bites"])}`,
			electronics: () => `${this.capitalize(faker.word.adjective())}Tech`,
			fitness: () =>
				`${this.capitalize(faker.word.verb())} ${faker.helpers.arrayElement(["Fitness", "Wellness", "Active", "Fit"])}`,
		};

		const nameGenerator = namePatterns[industry] ?? namePatterns["retail"];
		if (!nameGenerator) {
			throw new Error(`No name pattern for industry: ${industry}`);
		}
		const name = nameGenerator();
		const domain = `${name.toLowerCase().replace(/[^a-z]/g, "")}.com`;

		return {
			name,
			tagline: faker.company.catchPhrase(),
			domain,
			industry,
			primaryColor: faker.color.rgb(),
			sender: this.generateSender(context, name, domain),
		};
	}

	/**
	 * Generate a marketing sender - typically no-reply from bulk email service.
	 */
	private generateSender(
		context: GenerationContext,
		brandName: string,
		brandDomain: string,
	): Participant {
		const { faker } = context;

		// 70% chance of using bulk email service, 30% chance of brand domain
		const useBulkService = faker.number.float({ min: 0, max: 1 }) < 0.7;

		const prefix = faker.helpers.arrayElement(SENDER_PREFIXES);

		if (useBulkService) {
			const bulkDomain = faker.helpers.arrayElement(BULK_EMAIL_DOMAINS);
			// Bulk services often encode brand in subdomain or local part
			const localPart = faker.helpers.arrayElement([
				`${prefix}`,
				`${brandName.toLowerCase().replace(/[^a-z]/g, "")}`,
				`${prefix}.${brandName.toLowerCase().replace(/[^a-z]/g, "")}`,
				`${faker.string.alphanumeric(8)}`,
			]);
			return {
				firstName: brandName,
				lastName: "",
				email: `${localPart}@${bulkDomain}`,
			};
		}

		return {
			firstName: brandName,
			lastName: "",
			email: `${prefix}@${brandDomain}`,
		};
	}

	private capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	private generateCompliance(
		context: GenerationContext,
		brand: Brand,
	): {
		address: string;
		unsubscribeUrl: string;
	} {
		const { faker } = context;
		return {
			address: `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state({ abbreviated: true })} ${faker.location.zipCode()}`,
			unsubscribeUrl: `https://${brand.domain}/unsubscribe?token=${faker.string.alphanumeric(32)}`,
		};
	}

	private generatePromotional(context: GenerationContext): EmailContent {
		const { faker, recipients, requestHtml } = context;

		const brand = this.generateBrand(context);
		const compliance = this.generateCompliance(context, brand);
		const recipient = recipients[0];

		const discount = faker.helpers.arrayElement([
			15, 20, 25, 30, 40, 50, 60, 70, 75, 80,
		]);

		// More aggressive urgency patterns
		const urgency = faker.helpers.arrayElement([
			"TODAY ONLY",
			"ENDS TONIGHT",
			"LAST CHANCE",
			"FINAL HOURS",
			"24 HOURS ONLY",
			"ENDING SOON",
			"ACT NOW",
			"DON'T WAIT",
			"HURRY",
			"EXPIRES MIDNIGHT",
			"GOING FAST",
			"ALMOST GONE",
		]);

		// More aggressive/pushy subject lines
		const subject = faker.helpers.arrayElement([
			`🚨 ${discount}% OFF - ${urgency}!`,
			`⚡ FLASH SALE: ${discount}% off EVERYTHING`,
			`😱 ${urgency}: Up to ${discount}% off!`,
			`🔥 You're MISSING OUT on ${discount}% savings`,
			`❗ Don't ignore this: ${discount}% off expires TONIGHT`,
			`💥 ${brand.name}: ${discount}% OFF - ${urgency}`,
			`⏰ ${urgency}! ${discount}% off won't last`,
			`🎁 Your ${discount}% discount is about to DISAPPEAR`,
			`👀 Still thinking? ${discount}% off ends soon`,
			`💸 FREE MONEY: ${discount}% off everything`,
			`🛒 Your cart misses you - here's ${discount}% off`,
			`⚠️ WARNING: ${discount}% sale ending!`,
			`Re: Your ${discount}% off code (expiring)`,
			`Fwd: ${discount}% discount - did you see this?`,
			`URGENT: ${brand.name} ${discount}% off - ${urgency}`,
		]);

		// Generate pushy marketing copy
		const pushyCopy = this.generatePushyCopy(context, brand, discount);

		const text = `${recipient?.firstName ?? "Friend"},

${urgency}! This is your LAST CHANCE to save ${discount}% on everything at ${brand.name}!

${pushyCopy}

>>> USE CODE: SAVE${discount} <<<

🛒 SHOP NOW: https://${brand.domain}/sale

Don't let this slip away. ${faker.company.buzzPhrase()}!

${brand.tagline}

---
${brand.name}
${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}
This email was sent to ${recipient?.email ?? "you"} because you signed up for ${brand.name} promotions.`;

		const result: EmailContent = { subject, text, sender: brand.sender };

		if (requestHtml) {
			result.html = this.generatePromotionalHtml(
				brand,
				compliance,
				recipient?.firstName ?? "there",
				discount,
				urgency,
			);
		}

		return result;
	}

	/**
	 * Generate pushy marketing copy with urgency and FOMO.
	 */
	private generatePushyCopy(
		context: GenerationContext,
		brand: Brand,
		discount: number,
	): string {
		const { faker } = context;

		const fomoLines = [
			`${faker.number.int({ min: 100, max: 2000 })} customers already grabbed this deal!`,
			`Only ${faker.number.int({ min: 3, max: 50 })} items left at this price.`,
			`${faker.number.int({ min: 50, max: 500 })} people are viewing this sale RIGHT NOW.`,
			`This deal sold out in ${faker.number.int({ min: 2, max: 12 })} hours last time!`,
			`Our best-selling items are ${faker.number.int({ min: 60, max: 90 })}% claimed.`,
		];

		const urgencyLines = [
			"Prices go back up at MIDNIGHT. No exceptions.",
			"Once it's gone, it's GONE. We won't restock at this price.",
			`This is NOT a drill. ${discount}% off ends TODAY.`,
			"We've NEVER offered a deal this good. Don't blow it.",
			"Your wallet will thank you. Your future self will thank you.",
		];

		const benefitLines = [
			`${this.capitalize(faker.commerce.productAdjective())} ${faker.commerce.product()}s at unbeatable prices.`,
			`${this.capitalize(faker.company.buzzVerb())} your ${faker.company.buzzNoun()} with our ${faker.commerce.productAdjective()} collection.`,
			`Premium ${faker.commerce.productMaterial()} ${faker.commerce.product()}s - now ${discount}% off.`,
		];

		return `${faker.helpers.arrayElement(fomoLines)}

${faker.helpers.arrayElement(urgencyLines)}

${faker.helpers.arrayElement(benefitLines)}`;
	}

	private generatePromotionalHtml(
		brand: Brand,
		compliance: { address: string; unsubscribeUrl: string },
		firstName: string,
		discount: number,
		urgency: string,
	): string {
		return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
<span style="display:none;">${discount}% off everything - ${urgency}!</span>
<table width="600" align="center" style="background-color: white; border-collapse: collapse;">
<tr>
<td style="text-align: center; padding: 20px; background-color: ${brand.primaryColor};">
<h1 style="color: white; margin: 0;">${this.escapeHtml(brand.name)}</h1>
</td>
</tr>
<tr>
<td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
<p style="color: white; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase;">${this.escapeHtml(urgency)}</p>
<h2 style="color: white; font-size: 48px; margin: 0;">${discount}% OFF</h2>
<p style="color: white; font-size: 18px;">Everything in store</p>
<p style="margin: 30px 0;">
<a href="https://${brand.domain}" style="background-color: white; color: #333; padding: 15px 40px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block;">SHOP NOW</a>
</p>
<p style="color: white; font-size: 14px;">Use code: <strong>SAVE${discount}</strong></p>
</td>
</tr>
<tr>
<td style="padding: 30px; text-align: center;">
<p>Hi ${this.escapeHtml(firstName)},</p>
<p>Don't miss your chance to save big on everything at ${this.escapeHtml(brand.name)}!</p>
<p style="font-style: italic; color: #666;">${this.escapeHtml(brand.tagline)}</p>
</td>
</tr>
<tr>
<td style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
<p style="margin: 0 0 10px 0;">&copy; ${new Date().getFullYear()} ${this.escapeHtml(brand.name)}. All rights reserved.</p>
<p style="margin: 0 0 10px 0;">${this.escapeHtml(compliance.address)}</p>
<p style="margin: 0;"><a href="${this.escapeHtml(compliance.unsubscribeUrl)}" style="color: #aaa;">Unsubscribe</a> | <a href="https://${brand.domain}/preferences" style="color: #aaa;">Email Preferences</a></p>
</td>
</tr>
</table>
</body>
</html>`;
	}

	private generateProductAnnouncement(
		context: GenerationContext,
	): EmailContent {
		const { faker, recipients, requestHtml } = context;

		const brand = this.generateBrand(context);
		const compliance = this.generateCompliance(context, brand);
		const recipient = recipients[0];

		const productName = `${this.capitalize(faker.commerce.productAdjective())} ${this.capitalize(faker.commerce.product())}`;
		const productFeatures = [
			this.generateBenefit(context),
			this.generateBenefit(context),
			this.generateBenefit(context),
			this.generateBenefit(context),
		];

		// More aggressive product launch subjects
		const subject = faker.helpers.arrayElement([
			`🆕 JUST DROPPED: The ${productName}`,
			`🎉 IT'S HERE! The ${productName} you've been waiting for`,
			`⚡ FIRST LOOK: ${productName} - Be the FIRST to own it`,
			`🔥 NEW RELEASE: ${productName} is selling FAST`,
			`👀 Psst... the ${productName} just launched`,
			`📢 BREAKING: ${brand.name} unveils the ${productName}`,
			`💎 EXCLUSIVE: Get the new ${productName} before everyone else`,
			`🚀 The wait is OVER - ${productName} is live!`,
			`You asked, we delivered: ${productName} 🎁`,
			`The ${productName} is here and it's ${faker.commerce.productAdjective()}`,
		]);

		const hypeIntro = faker.helpers.arrayElement([
			"The moment you've been waiting for is HERE.",
			"We've been working on something SPECIAL.",
			`Get ready to ${faker.company.buzzVerb()} like never before.`,
			"This changes EVERYTHING.",
			"We're SO excited to finally share this with you!",
		]);

		const text = `${recipient?.firstName ?? "Hey there"}!

${hypeIntro}

Introducing the ALL-NEW ${productName}! 🎉

✨ ${productFeatures.join("\n✨ ")}

${faker.number.int({ min: 500, max: 5000 })} people already pre-ordered. Don't get left behind!

🛒 GET YOURS NOW: https://${brand.domain}/new/${productName.toLowerCase().replace(/\s/g, "-")}

${faker.company.buzzPhrase()} - only from ${brand.name}.

${brand.tagline}

---
${brand.name}
${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}`;

		const result: EmailContent = { subject, text, sender: brand.sender };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
<span style="display:none;">Introducing the all-new ${this.escapeHtml(productName)}</span>
<table width="600" align="center" style="background-color: white; border-collapse: collapse;">
<tr>
<td style="text-align: center; padding: 20px;">
<h2 style="color: #333; margin: 0;">${this.escapeHtml(brand.name)}</h2>
</td>
</tr>
<tr>
<td style="background-color: #f8f8f8; padding: 40px; text-align: center;">
<p style="color: #666; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0;">Introducing</p>
<h1 style="color: #333; font-size: 36px; margin: 0 0 20px 0;">${this.escapeHtml(productName)}</h1>
<div style="width: 200px; height: 150px; background-color: #ddd; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
<span style="color: #999;">[Product Image]</span>
</div>
</td>
</tr>
<tr>
<td style="padding: 30px;">
<h3 style="color: #333;">Features you'll love:</h3>
<ul style="color: #666; line-height: 1.8;">
${productFeatures.map((f) => `<li>${this.escapeHtml(f)}</li>`).join("\n")}
</ul>
<p style="text-align: center; margin-top: 30px;">
<a href="https://${brand.domain}/new" style="background-color: ${brand.primaryColor}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block;">Learn More</a>
</p>
</td>
</tr>
<tr>
<td style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
<p style="margin: 0 0 10px 0;">&copy; ${new Date().getFullYear()} ${this.escapeHtml(brand.name)}</p>
<p style="margin: 0 0 10px 0;">${this.escapeHtml(compliance.address)}</p>
<p style="margin: 0;"><a href="${this.escapeHtml(compliance.unsubscribeUrl)}" style="color: #aaa;">Unsubscribe</a></p>
</td>
</tr>
</table>
</body>
</html>`;
		}

		return result;
	}

	private generateAbandonedCart(context: GenerationContext): EmailContent {
		const { faker, recipients, requestHtml } = context;

		const brand = this.generateBrand(context);
		const compliance = this.generateCompliance(context, brand);
		const recipient = recipients[0];

		const itemCount = faker.number.int({ min: 1, max: 4 });
		const cartItems = Array.from({ length: itemCount }, () => ({
			name: faker.commerce.productName(),
			price: faker.commerce.price({ min: 20, max: 300 }),
		}));

		const discount = faker.helpers.arrayElement([10, 15, 20, 25, 30]);
		const hasFreeShipping = faker.datatype.boolean();
		const stockWarning = faker.datatype.boolean();

		// More aggressive abandoned cart subjects
		const subject = faker.helpers.arrayElement([
			"😱 You LEFT something behind!",
			"⚠️ Your cart is about to EXPIRE",
			`🛒 Complete your order NOW - ${discount}% off!`,
			"👀 We noticed you didn't finish...",
			`⏰ HURRY! Your items won't last (${discount}% off)`,
			"🚨 Don't lose your cart!",
			`💸 Here's ${discount}% off to finish your order`,
			"Did you forget about us? 😢",
			hasFreeShipping
				? "🎁 FREE SHIPPING on your abandoned cart!"
				: "⚡ Your items are almost SOLD OUT",
			`Re: Your incomplete order at ${brand.name}`,
			"FINAL REMINDER: Complete your purchase",
			`${recipient?.firstName ?? "Hey"}, you left $${cartItems.reduce((sum, item) => sum + Number.parseFloat(item.price), 0).toFixed(0)} in your cart!`,
		]);

		const itemsList = cartItems
			.map((item) => `🛍️ ${item.name} - $${item.price}`)
			.join("\n");

		const totalValue = cartItems
			.reduce((sum, item) => sum + Number.parseFloat(item.price), 0)
			.toFixed(2);

		const urgencyMessage = faker.helpers.arrayElement([
			`These items are in ${faker.number.int({ min: 5, max: 50 })} other carts right now!`,
			"Stock is running LOW. We can't hold these forever.",
			`${faker.number.int({ min: 10, max: 100 })} people bought this in the last hour!`,
			"Your reserved items will be released to other shoppers soon.",
			"Prices may increase. Lock in your savings NOW.",
		]);

		const text = `${recipient?.firstName ?? "Hey"},

You left some ${faker.commerce.productAdjective().toLowerCase()} items in your cart! 🛒

${itemsList}

💰 Cart Total: $${totalValue}
${discount > 0 ? `🎉 YOUR DISCOUNT: ${discount}% OFF with code COMEBACK${discount}` : ""}
${hasFreeShipping ? "📦 BONUS: FREE SHIPPING on this order!" : ""}

${stockWarning ? urgencyMessage : ""}

👉 COMPLETE YOUR ORDER: https://${brand.domain}/cart/recover

Don't let ${faker.company.buzzAdjective()} deals slip away!

${brand.name}
${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}
Sent because you have items in your ${brand.name} cart.`;

		const result: EmailContent = { subject, text, sender: brand.sender };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
<span style="display:none;">You left something behind...</span>
<table width="600" align="center" style="background-color: white; border-collapse: collapse;">
<tr>
<td style="text-align: center; padding: 20px; border-bottom: 1px solid #eee;">
<h2 style="color: #333; margin: 0;">${this.escapeHtml(brand.name)}</h2>
</td>
</tr>
<tr>
<td style="padding: 40px; text-align: center;">
<h1 style="color: #333; margin: 0 0 10px 0;">Forgot something?</h1>
<p style="color: #666;">Hi ${this.escapeHtml(recipient?.firstName ?? "there")}, you left these items in your cart:</p>
</td>
</tr>
<tr>
<td style="padding: 0 40px;">
${cartItems
	.map(
		(item) => `
<div style="display: flex; align-items: center; padding: 15px; border-bottom: 1px solid #eee;">
<div style="width: 60px; height: 60px; background-color: #f0f0f0; margin-right: 15px;"></div>
<div style="flex: 1;">
<p style="margin: 0; font-weight: bold;">${this.escapeHtml(item.name)}</p>
<p style="margin: 5px 0 0 0; color: #666;">$${item.price}</p>
</div>
</div>`,
	)
	.join("")}
</td>
</tr>
<tr>
<td style="padding: 30px; text-align: center;">
${discount > 0 ? `<p style="background-color: #fff3cd; padding: 15px; border-radius: 5px;"><strong>Use code COMEBACK${discount}</strong> for ${discount}% off!</p>` : ""}
${hasFreeShipping ? '<p style="color: #28a745; font-weight: bold;">+ FREE SHIPPING on this order!</p>' : ""}
<p style="margin-top: 20px;">
<a href="https://${brand.domain}/cart" style="background-color: ${brand.primaryColor}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Your Order</a>
</p>
</td>
</tr>
<tr>
<td style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
<p style="margin: 0 0 10px 0;">${this.escapeHtml(compliance.address)}</p>
<p style="margin: 0;"><a href="${this.escapeHtml(compliance.unsubscribeUrl)}" style="color: #aaa;">Unsubscribe</a></p>
</td>
</tr>
</table>
</body>
</html>`;
		}

		return result;
	}

	private generateLoyalty(context: GenerationContext): EmailContent {
		const { faker, recipients, requestHtml } = context;

		const brand = this.generateBrand(context);
		const compliance = this.generateCompliance(context, brand);
		const recipient = recipients[0];

		const points = faker.number.int({ min: 100, max: 10000 });
		const pointsExpiring = faker.number.int({ min: 50, max: points });
		const tier = faker.helpers.arrayElement([
			"Bronze",
			"Silver",
			"Gold",
			"Platinum",
			"Diamond",
			"VIP",
		]);
		const isBirthday = faker.datatype.boolean({ probability: 0.2 });
		const isExpiring = faker.datatype.boolean({ probability: 0.3 });

		let subject: string;
		let text: string;

		if (isBirthday) {
			subject = faker.helpers.arrayElement([
				`🎂 Happy Birthday! FREE gift inside from ${brand.name}`,
				`🎁 ${recipient?.firstName ?? "Friend"}, your birthday present is here!`,
				`🎉 It's YOUR day! Claim your birthday reward`,
				`Happy Birthday from ${brand.name}! 🥳 Special offer inside`,
			]);
			text = `HAPPY BIRTHDAY, ${(recipient?.firstName ?? "friend").toUpperCase()}! 🎂🎉

To celebrate YOUR special day, here's an EXCLUSIVE gift from ${brand.name}:

🎁 25% OFF your ENTIRE purchase!
🎁 DOUBLE POINTS on everything!
🎁 FREE ${faker.commerce.product()} with orders over $50!

>>> USE CODE: BDAY25 <<<

Your ${tier} Status: ACTIVE ✓
Points Balance: ${points.toLocaleString()} 🌟

Don't let your birthday reward go to waste!
🛒 CLAIM NOW: https://${brand.domain}/birthday

${brand.tagline}

${brand.name}
${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}`;
		} else if (isExpiring) {
			subject = faker.helpers.arrayElement([
				`⚠️ ${pointsExpiring.toLocaleString()} points EXPIRING SOON`,
				`🚨 Use it or lose it: ${pointsExpiring.toLocaleString()} points expire!`,
				`😱 Don't lose ${pointsExpiring.toLocaleString()} points!`,
				"⏰ URGENT: Your rewards expire in 48 hours",
			]);
			text = `${recipient?.firstName ?? "Hey"},

⚠️ WARNING: You have ${pointsExpiring.toLocaleString()} points about to EXPIRE!

Your ${tier} Status: ACTIVE ✓
Total Points: ${points.toLocaleString()} 🌟
EXPIRING SOON: ${pointsExpiring.toLocaleString()} points ⚠️

Don't let your hard-earned rewards disappear!

Here's what you can get:
🎁 ${this.generateBenefit(context)} (${faker.number.int({ min: 100, max: 500 })} pts)
🎁 ${this.generateBenefit(context)} (${faker.number.int({ min: 200, max: 800 })} pts)
🎁 ${this.generateBenefit(context)} (${faker.number.int({ min: 500, max: 2000 })} pts)

👉 REDEEM NOW: https://${brand.domain}/rewards

${brand.name}
${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}`;
		} else {
			subject = faker.helpers.arrayElement([
				`🌟 You've earned ${points.toLocaleString()} bonus points!`,
				`🏆 Congrats! You've unlocked ${tier} status!`,
				`💎 ${tier} EXCLUSIVE: Double points this week!`,
				`🎉 ${recipient?.firstName ?? "VIP"}, check your rewards balance!`,
				`🔥 ${tier} Member: New perks just unlocked`,
			]);

			text = `${recipient?.firstName ?? "Hey there"}, you're a ROCKSTAR! 🌟

Your ${tier} Status: ACTIVE ✓
Points Balance: ${points.toLocaleString()} 🌟

As a valued ${tier} member, you EXCLUSIVELY enjoy:
✨ ${this.generateBenefit(context)}
✨ ${this.generateBenefit(context)}
✨ ${this.generateBenefit(context)}
✨ ${this.generateBenefit(context)}

${faker.number.int({ min: 100, max: 1000 })} members just upgraded their status this week. Keep ${faker.company.buzzVerb()}ing to unlock even MORE perks!

👉 VIEW ALL REWARDS: https://${brand.domain}/rewards

${brand.tagline}

${brand.name}
${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}`;
		}

		const result: EmailContent = { subject, text, sender: brand.sender };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
<table width="600" align="center" style="background-color: white; border-collapse: collapse;">
<tr>
<td style="text-align: center; padding: 20px; background-color: ${brand.primaryColor};">
<h2 style="color: white; margin: 0;">${this.escapeHtml(brand.name)} Rewards</h2>
</td>
</tr>
<tr>
<td style="padding: 40px; text-align: center;">
${isBirthday ? '<h1 style="font-size: 48px; margin: 0;">🎂</h1>' : ""}
<h2 style="color: #333;">${isBirthday ? `Happy Birthday, ${this.escapeHtml(recipient?.firstName ?? "friend")}!` : `Hello, ${tier} Member!`}</h2>
<div style="background: linear-gradient(135deg, #f5af19 0%, #f12711 100%); color: white; padding: 30px; border-radius: 10px; margin: 20px 0;">
<p style="margin: 0 0 10px 0; font-size: 14px;">YOUR POINTS BALANCE</p>
<p style="margin: 0; font-size: 48px; font-weight: bold;">${points.toLocaleString()}</p>
<p style="margin: 10px 0 0 0;">${tier} Status</p>
</div>
${isBirthday ? '<p style="font-size: 24px; color: #333;">Enjoy <strong>25% OFF</strong> with code <strong>BDAY25</strong></p>' : ""}
<p style="margin-top: 20px;">
<a href="https://${brand.domain}/rewards" style="background-color: ${brand.primaryColor}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block;">View Rewards</a>
</p>
</td>
</tr>
<tr>
<td style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
<p style="margin: 0 0 10px 0;">${this.escapeHtml(compliance.address)}</p>
<p style="margin: 0;"><a href="${this.escapeHtml(compliance.unsubscribeUrl)}" style="color: #aaa;">Unsubscribe</a></p>
</td>
</tr>
</table>
</body>
</html>`;
		}

		return result;
	}

	private generateReengagement(context: GenerationContext): EmailContent {
		const { faker, recipients, requestHtml } = context;

		const brand = this.generateBrand(context);
		const compliance = this.generateCompliance(context, brand);
		const recipient = recipients[0];

		const discount = faker.helpers.arrayElement([20, 25, 30, 40, 50]);
		const daysAway = faker.number.int({ min: 30, max: 365 });
		const timeAway = faker.helpers.arrayElement([
			`${daysAway} days`,
			"a while",
			"too long",
			"ages",
			"forever",
		]);

		// More aggressive win-back subjects
		const subject = faker.helpers.arrayElement([
			`😢 We miss you! Here's ${discount}% off to come back`,
			`💔 Is this goodbye, ${recipient?.firstName ?? "friend"}?`,
			`🥺 ${recipient?.firstName ?? "Hey"}, where did you go?`,
			`⚠️ FINAL NOTICE: ${discount}% off expires tonight`,
			"We're breaking up... unless you come back 💔",
			`👋 ${recipient?.firstName ?? "Friend"}, it's been ${timeAway}...`,
			`🎁 A ${discount}% apology gift - please come back!`,
			"Is there someone else? 😢 We can change!",
			`🚨 LAST CHANCE: ${discount}% off before we say goodbye`,
			"Re: We haven't heard from you...",
			`${recipient?.firstName ?? "Hey"} - did we do something wrong?`,
			`One last offer before we remove you (${discount}% off)`,
		]);

		const guiltyMessage = faker.helpers.arrayElement([
			`It's been ${timeAway} since your last visit. We've been waiting... 😢`,
			`Your account has been lonely for ${daysAway} days.`,
			"We noticed you've been away. Did we do something wrong?",
			`${faker.number.int({ min: 50, max: 500 })} new products added since you left!`,
			"A lot has changed. We think you'll like what you see.",
		]);

		const desperateOffer = faker.helpers.arrayElement([
			`${discount}% OFF everything - just for coming back!`,
			`FREE shipping + ${discount}% off your entire order!`,
			`${discount}% off + a FREE ${faker.commerce.product()} with any purchase!`,
			`Double points + ${discount}% off - we're serious about winning you back!`,
		]);

		const text = `${recipient?.firstName ?? "Hey there"},

${guiltyMessage}

We really, REALLY want you back. So here's what we're offering:

🎁 ${desperateOffer}

>>> USE CODE: COMEBACK${discount} <<<

${this.generateMarketingBody(context, brand)}

This offer expires in 48 hours. After that... well, we might have to say goodbye. 😢

👉 COME BACK NOW: https://${brand.domain}/welcome-back

We hope to see you soon (please?) 🙏

The ${brand.name} Team

${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}
You're receiving this because we miss having you as a ${brand.name} customer.`;

		const result: EmailContent = { subject, text, sender: brand.sender };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
<table width="600" align="center" style="background-color: white; border-collapse: collapse;">
<tr>
<td style="text-align: center; padding: 20px;">
<h2 style="color: #333; margin: 0;">${this.escapeHtml(brand.name)}</h2>
</td>
</tr>
<tr>
<td style="padding: 40px; text-align: center; background-color: #fef3cd;">
<h1 style="color: #333; margin: 0 0 20px 0;">We miss you!</h1>
<p style="color: #666; font-size: 18px;">It's been ${timeAway} since your last visit.</p>
<p style="color: #666;">Come back and see what's new at ${this.escapeHtml(brand.name)}.</p>
</td>
</tr>
<tr>
<td style="padding: 40px; text-align: center;">
<p style="font-size: 18px; color: #333;">Here's a special offer just for you:</p>
<div style="background-color: #d4edda; padding: 20px; border-radius: 10px; margin: 20px 0;">
<p style="font-size: 36px; font-weight: bold; color: #155724; margin: 0;">${discount}% OFF</p>
<p style="color: #155724; margin: 10px 0 0 0;">Use code: <strong>WEBACK${discount}</strong></p>
</div>
<p style="margin-top: 20px;">
<a href="https://${brand.domain}" style="background-color: ${brand.primaryColor}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block;">Shop Now</a>
</p>
</td>
</tr>
<tr>
<td style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
<p style="margin: 0 0 10px 0;">The ${this.escapeHtml(brand.name)} Team</p>
<p style="margin: 0 0 10px 0;">${this.escapeHtml(compliance.address)}</p>
<p style="margin: 0;"><a href="${this.escapeHtml(compliance.unsubscribeUrl)}" style="color: #aaa;">Unsubscribe</a></p>
</td>
</tr>
</table>
</body>
</html>`;
		}

		return result;
	}

	/**
	 * Generate a locale-aware call to action.
	 * Uses faker's locale-aware word methods for dynamic content.
	 */
	private generateCta(context: GenerationContext): string {
		const { faker } = context;
		const patterns = [
			() => `${this.capitalize(faker.word.verb())} ${faker.word.noun()}`,
			() => this.capitalize(faker.word.verb()),
			() => `${this.capitalize(faker.word.adjective())} ${faker.word.noun()}`,
		];
		return faker.helpers.arrayElement(patterns)();
	}

	/**
	 * Generate locale-aware marketing body text.
	 */
	private generateMarketingBody(
		context: GenerationContext,
		brand: Brand,
	): string {
		const { faker } = context;

		const patterns = [
			() =>
				`${this.capitalize(faker.word.adjective())} ${faker.word.noun()} ${faker.word.preposition()} ${faker.word.adjective()} ${faker.word.noun()}.`,
			() => `${faker.company.catchPhrase()}.`,
			() =>
				`${this.capitalize(faker.word.verb())} ${faker.word.adjective()} ${faker.word.noun()} ${faker.word.adverb()}.`,
			() => `${faker.commerce.productDescription()}.`,
		];

		const sentences: string[] = [];
		const count = faker.number.int({ min: 2, max: 4 });
		for (let i = 0; i < count; i++) {
			sentences.push(faker.helpers.arrayElement(patterns)());
		}

		return sentences.join(" ");
	}

	/**
	 * Generate a locale-aware product benefit.
	 */
	private generateBenefit(context: GenerationContext): string {
		const { faker } = context;
		const patterns = [
			() => `${this.capitalize(faker.word.adjective())} ${faker.word.noun()}`,
			() => `${this.capitalize(faker.word.verb())} ${faker.word.adverb()}`,
			() => faker.company.buzzPhrase(),
			() =>
				`${this.capitalize(faker.word.adjective())} ${faker.word.adjective()} ${faker.word.noun()}`,
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
