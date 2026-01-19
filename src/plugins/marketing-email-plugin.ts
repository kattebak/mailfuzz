import type {
	EmailContent,
	EmailPlugin,
	GenerationContext,
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
}

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
			return {
				name,
				tagline: faker.company.catchPhrase(),
				domain: `${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
				industry: faker.helpers.arrayElement(INDUSTRIES),
				primaryColor: faker.color.rgb(),
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

		return {
			name,
			tagline: faker.company.catchPhrase(),
			domain: `${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
			industry,
			primaryColor: faker.color.rgb(),
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

		const discount = faker.helpers.arrayElement([20, 25, 30, 40, 50, 60, 70]);
		const urgency = faker.helpers.arrayElement([
			"Today only",
			"Ends tonight",
			"24 hours only",
			"This weekend only",
			"Limited time",
		]);

		const subject = faker.helpers.arrayElement([
			`${discount}% off everything - ${urgency}!`,
			`Your exclusive ${discount}% discount expires tonight`,
			`Flash Sale: Up to ${discount}% off select items`,
			`Don't miss out: ${discount}% off ${urgency}`,
			`${brand.name} Sale: ${discount}% off sitewide`,
		]);

		const text = `Hi ${recipient?.firstName ?? "there"},

${urgency.toUpperCase()}! Save ${discount}% on everything at ${brand.name}.

Use code SAVE${discount} at checkout.

Shop now at ${brand.domain}

${brand.tagline}

---
${brand.name}
${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}`;

		const result: EmailContent = { subject, text };

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

		const productName = `${this.capitalize(faker.word.adjective())} ${this.capitalize(faker.commerce.product())}`;
		const productFeatures = [
			faker.commerce.productDescription(),
			faker.commerce.productDescription(),
			faker.commerce.productDescription(),
		];

		const subject = faker.helpers.arrayElement([
			`Introducing the all-new ${productName}`,
			`Meet the ${productName}`,
			`You asked, we listened - ${productName} is here`,
			`First look: ${productName}`,
			`NEW: ${productName} just launched`,
		]);

		const text = `Hi ${recipient?.firstName ?? "there"},

We're excited to introduce the ${productName}!

${productFeatures.join("\n")}

Be among the first to experience ${productName}.

Learn more at ${brand.domain}

${brand.name}
${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}`;

		const result: EmailContent = { subject, text };

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

		const cartItems = [
			{
				name: faker.commerce.productName(),
				price: faker.commerce.price({ min: 20, max: 200 }),
			},
			{
				name: faker.commerce.productName(),
				price: faker.commerce.price({ min: 20, max: 200 }),
			},
		];

		const discount = faker.helpers.arrayElement([10, 15, 20]);
		const hasFreeShipping = faker.datatype.boolean();

		const subject = faker.helpers.arrayElement([
			"Did you forget something?",
			"Your cart is waiting for you",
			`Complete your order - ${discount}% off inside`,
			hasFreeShipping
				? "Still thinking about it? Here's free shipping"
				: "Your items are selling fast!",
			"We saved your cart for you",
		]);

		const itemsList = cartItems
			.map((item) => `- ${item.name} ($${item.price})`)
			.join("\n");

		const text = `Hi ${recipient?.firstName ?? "there"},

Looks like you left some items in your cart at ${brand.name}!

${itemsList}

${discount > 0 ? `Use code COMEBACK${discount} for ${discount}% off your order.` : ""}
${hasFreeShipping ? "Plus, enjoy FREE shipping on this order!" : ""}

Complete your purchase: https://${brand.domain}/cart

${brand.name}
${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}`;

		const result: EmailContent = { subject, text };

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

		const points = faker.number.int({ min: 100, max: 5000 });
		const tier = faker.helpers.arrayElement([
			"Bronze",
			"Silver",
			"Gold",
			"Platinum",
		]);
		const isBirthday = faker.datatype.boolean({ probability: 0.2 });

		let subject: string;
		let text: string;

		if (isBirthday) {
			subject = `Happy Birthday! Here's a gift from ${brand.name}`;
			text = `Happy Birthday, ${recipient?.firstName ?? "friend"}!

To celebrate your special day, here's a gift from ${brand.name}:

25% OFF your next purchase!

Use code BDAY25 at checkout.

Thank you for being a valued ${tier} member!

Your current points balance: ${points.toLocaleString()} points

${brand.name}
${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}`;
		} else {
			subject = faker.helpers.arrayElement([
				`You've earned ${points.toLocaleString()} bonus points!`,
				`Congrats! You've reached ${tier} status`,
				"Your rewards are about to expire",
				`${tier} Member Exclusive: Double points this week`,
			]);

			text = `Hi ${recipient?.firstName ?? "there"},

Great news for our ${tier} member!

Your current points balance: ${points.toLocaleString()} points

As a ${tier} member, you enjoy:
- Free shipping on all orders
- Early access to sales
- Exclusive member discounts
- Birthday rewards

Visit ${brand.domain}/rewards to see your benefits.

${brand.name}
${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}`;
		}

		const result: EmailContent = { subject, text };

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

		const discount = faker.helpers.arrayElement([20, 25, 30]);
		const timeAway = faker.helpers.arrayElement([
			"a while",
			"some time",
			"too long",
		]);

		const subject = faker.helpers.arrayElement([
			`We miss you! Come back for ${discount}% off`,
			`It's been ${timeAway} - See what's new`,
			"Is this goodbye? One last offer inside",
			"A lot has changed since you left",
			`${recipient?.firstName ?? "Friend"}, we want you back`,
		]);

		const text = `Hi ${recipient?.firstName ?? "there"},

It's been ${timeAway} since we've seen you at ${brand.name}, and we miss you!

A lot has changed since your last visit. Come back and see what's new.

As a special welcome back offer, here's ${discount}% off your next order.

Use code WEBACK${discount} at checkout.

We hope to see you soon!

The ${brand.name} Team

${compliance.address}

Unsubscribe: ${compliance.unsubscribeUrl}`;

		const result: EmailContent = { subject, text };

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

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
}
