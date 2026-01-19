import type {
	Attachment,
	EmailContent,
	EmailPlugin,
	GenerationContext,
	PluginCapabilities,
} from "../types.js";

type SpamCategory =
	| "phishing"
	| "scam"
	| "pharmaceutical"
	| "lottery"
	| "adult"
	| "malware";

interface CategoryWeight {
	category: SpamCategory;
	weight: number;
}

const DEFAULT_CATEGORY_WEIGHTS: CategoryWeight[] = [
	{ category: "phishing", weight: 0.3 },
	{ category: "scam", weight: 0.25 },
	{ category: "pharmaceutical", weight: 0.15 },
	{ category: "lottery", weight: 0.1 },
	{ category: "adult", weight: 0.1 },
	{ category: "malware", weight: 0.1 },
];

const PHISHING_BRANDS = [
	"PayPal",
	"Amazon",
	"Apple",
	"Netflix",
	"Microsoft",
	"Google",
	"Chase Bank",
	"Wells Fargo",
	"Bank of America",
	"Dropbox",
];

const SUSPICIOUS_TLDS = ["net", "info", "co", "click", "xyz", "top", "online"];

/**
 * Spam email plugin for generating realistic unsolicited email content.
 * Used for testing spam filters, email parsing, and UI handling of suspicious messages.
 */
export class SpamEmailPlugin implements EmailPlugin {
	readonly id = "spam";
	readonly name = "Spam Email";
	readonly defaultWeight = 0.3;

	readonly capabilities: PluginCapabilities = {
		canBeReply: false,
		canBeForward: false,
		canBeOriginal: true,
		supportsHtml: true,
		supportsAttachments: true,
		supportsMultipleRecipients: false,
	};

	generate(context: GenerationContext): EmailContent {
		const category = this.selectCategory(context);

		switch (category) {
			case "phishing":
				return this.generatePhishing(context);
			case "scam":
				return this.generateScam(context);
			case "pharmaceutical":
				return this.generatePharmaceutical(context);
			case "lottery":
				return this.generateLottery(context);
			case "adult":
				return this.generateAdult(context);
			case "malware":
				return this.generateMalware(context);
		}
	}

	private selectCategory(context: GenerationContext): SpamCategory {
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

		return "phishing";
	}

	private generatePhishing(context: GenerationContext): EmailContent {
		const { faker, requestHtml } = context;

		const brand = faker.helpers.arrayElement(PHISHING_BRANDS);
		const urgency = faker.helpers.arrayElement([
			"URGENT",
			"ACTION REQUIRED",
			"IMPORTANT",
			"ALERT",
			"SECURITY NOTICE",
		]);

		const subject = faker.helpers.arrayElement([
			`[${urgency}] Your ${brand} account has been limited`,
			`${brand}: Unusual sign-in activity detected`,
			`Verify your ${brand} account immediately`,
			`${brand} Security Alert - Action Required`,
			`Your ${brand} password expires today`,
			`Suspicious activity on your ${brand} account`,
		]);

		const tld = faker.helpers.arrayElement(SUSPICIOUS_TLDS);
		const fakeUrl = `https://${brand.toLowerCase().replace(/\s/g, "")}-verify.${tld}`;

		const text = `Dear Valued Customer,

We have detected unusual activity on your ${brand} account. To ensure your security, we require you to verify your identity immediately.

Click here to verify: ${fakeUrl}

If you do not verify within 24 hours, your account will be permanently suspended.

${brand} Security Team

This is an automated message. Please do not reply.`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = this.generatePhishingHtml(brand, fakeUrl, urgency);
		}

		return result;
	}

	private generatePhishingHtml(
		brand: string,
		fakeUrl: string,
		urgency: string,
	): string {
		return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
<table width="600" align="center" style="background-color: white; border: 1px solid #ddd;">
<tr>
<td style="background-color: #003366; color: white; padding: 20px; text-align: center;">
<h2>${this.escapeHtml(brand)} Security</h2>
</td>
</tr>
<tr>
<td style="padding: 30px;">
<p style="color: #cc0000; font-weight: bold;">${this.escapeHtml(urgency)}</p>
<p>Dear Valued Customer,</p>
<p>We have detected unusual activity on your ${this.escapeHtml(brand)} account. Your account access has been temporarily limited.</p>
<p>To restore full access, please verify your identity by clicking the button below:</p>
<p style="text-align: center; margin: 30px 0;">
<a href="${this.escapeHtml(fakeUrl)}" style="background-color: #0066cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Now</a>
</p>
<p style="color: #666; font-size: 12px;">If you do not verify within 24 hours, your account will be permanently suspended.</p>
</td>
</tr>
<tr>
<td style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 11px; color: #666;">
This is an automated security notification from ${this.escapeHtml(brand)}.
</td>
</tr>
</table>
</body>
</html>`;
	}

	private generateScam(context: GenerationContext): EmailContent {
		const { faker, requestHtml } = context;

		const scamType = faker.helpers.arrayElement([
			"inheritance",
			"business",
			"lottery",
			"charity",
		]);

		const firstName = faker.person.firstName();
		const lastName = faker.person.lastName();
		const amount = faker.number.int({ min: 1, max: 50 }) * 100000;
		const formattedAmount = new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			maximumFractionDigits: 0,
		}).format(amount);

		let subject: string;
		let text: string;

		if (scamType === "inheritance") {
			subject = faker.helpers.arrayElement([
				"URGENT BUSINESS PROPOSAL",
				"CONFIDENTIAL: Inheritance Notification",
				`From the desk of Barrister ${lastName}`,
				"RE: Your Unclaimed Inheritance",
			]);

			text = `Dear Friend,

I am Barrister ${firstName} ${lastName}, a solicitor at law. I am the personal attorney to Mr. ${faker.person.lastName()}, a national of your country who passed away recently.

Before his death, my client made a deposit of ${formattedAmount} in a bank here. I am contacting you to assist in repatriating this fund as his next of kin since you share the same surname.

You will be entitled to 40% of the total sum for your assistance.

Please reply with:
- Your full name
- Phone number
- Address

I await your urgent response.

Regards,
Barrister ${firstName} ${lastName}
Attorney at Law`;
		} else {
			subject = faker.helpers.arrayElement([
				"BUSINESS OPPORTUNITY - URGENT",
				"Partnership Proposal",
				"Investment Opportunity",
			]);

			text = `Dear Sir/Madam,

I am ${firstName} ${lastName}, a government official. Due to the political situation in my country, I need assistance transferring ${formattedAmount} to a safe account abroad.

For your assistance, you will receive 30% of the total amount. This is a legitimate and risk-free transaction.

Please contact me immediately with your:
- Full Name
- Phone Number
- Bank Details

Time is of the essence.

Best Regards,
${firstName} ${lastName}`;
		}

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Times New Roman, serif;">
${text
	.split("\n\n")
	.map((p) => `<p>${this.escapeHtml(p)}</p>`)
	.join("\n")}
</body>
</html>`;
		}

		return result;
	}

	private generatePharmaceutical(context: GenerationContext): EmailContent {
		const { faker, requestHtml } = context;

		const products = [
			{ name: "V1AGRA", claim: "enhancement" },
			{ name: "C1ALIS", claim: "enhancement" },
			{ name: "WEIGHT LOSS PILLS", claim: "lose 30 pounds in 30 days" },
			{ name: "MUSCLE BUILDER", claim: "gain 20 pounds of muscle" },
			{ name: "BRAIN BOOSTER", claim: "increase IQ by 40 points" },
		];

		const product = faker.helpers.arrayElement(products);
		const discount = faker.helpers.arrayElement([50, 60, 70, 80, 90]);

		const subject = faker.helpers.arrayElement([
			`Save ${discount}% on your prescriptions`,
			"The secret doctors don't want you to know",
			`${product.name} - Limited Time Offer`,
			"Guaranteed results or your money back",
			"Doctor approved formula - No prescription needed",
		]);

		const text = `AMAZING OFFER!!!

${product.name} - ${discount}% OFF!!!

${product.claim.toUpperCase()} GUARANTEED!

No prescription needed!
Discrete shipping!
Same day delivery!

ORDER NOW: www.${faker.internet.domainWord()}-pharmacy.${faker.helpers.arrayElement(SUSPICIOUS_TLDS)}

LIMITED TIME OFFER - ACT NOW!

To unsubscribe reply with STOP`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Comic Sans MS, cursive; background-color: #ffff00;">
<div style="text-align: center; padding: 20px;">
<h1 style="color: red; font-size: 36px;">AMAZING OFFER!!!</h1>
<h2 style="color: blue;">${this.escapeHtml(product.name)} - ${discount}% OFF!!!</h2>
<p style="font-size: 24px; color: green;">${this.escapeHtml(product.claim.toUpperCase())} GUARANTEED!</p>
<p><blink>LIMITED TIME OFFER</blink></p>
<p style="font-size: 18px;">No prescription needed! Discrete shipping!</p>
<a href="#" style="background-color: red; color: white; padding: 20px 40px; font-size: 24px; text-decoration: none;">ORDER NOW!!!</a>
</div>
</body>
</html>`;
		}

		return result;
	}

	private generateLottery(context: GenerationContext): EmailContent {
		const { faker, requestHtml } = context;

		const amount = faker.number.int({ min: 1, max: 10 }) * 1000000;
		const formattedAmount = new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			maximumFractionDigits: 0,
		}).format(amount);

		const lotteryName = faker.helpers.arrayElement([
			"International Lottery Commission",
			"Global Prize Awards",
			"European Mega Millions",
			"World Lottery Foundation",
			"Online Sweepstakes International",
		]);

		const refNumber = `${faker.string.alpha({ length: 2, casing: "upper" })}/${faker.string.numeric(4)}X${faker.string.numeric(1)}/${faker.string.numeric(2)}`;

		const subject = faker.helpers.arrayElement([
			`CONGRATULATIONS! You've been selected!`,
			`Claim your ${formattedAmount} prize`,
			`You are our lucky winner - Ref: ${refNumber}`,
			`WINNER NOTIFICATION: ${lotteryName}`,
			"Claim your prize - Final Notice",
		]);

		const text = `CONGRATULATIONS!!!

The ${lotteryName} is pleased to inform you that you have been selected as a winner in our promotional draw.

PRIZE AMOUNT: ${formattedAmount}
REFERENCE NUMBER: ${refNumber}
BATCH NUMBER: ${faker.string.numeric(6)}

To claim your prize, please contact our claims agent immediately with the following information:
- Full Name
- Address
- Phone Number
- Date of Birth

Claims Agent: ${faker.person.fullName()}
Email: claims@${faker.internet.domainWord()}-lottery.${faker.helpers.arrayElement(SUSPICIOUS_TLDS)}

NOTE: This is your FINAL NOTICE. Failure to respond within 7 days will result in forfeiture of your prize.

Congratulations once again!

${lotteryName}
"Making Dreams Come True"`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #001144; color: white; padding: 20px;">
<div style="text-align: center; border: 3px solid gold; padding: 30px; max-width: 600px; margin: 0 auto;">
<h1 style="color: gold;">CONGRATULATIONS!!!</h1>
<p style="font-size: 20px;">You have won</p>
<h2 style="color: #00ff00; font-size: 48px;">${this.escapeHtml(formattedAmount)}</h2>
<p>Reference: ${this.escapeHtml(refNumber)}</p>
<hr style="border-color: gold;">
<p>Contact our claims agent immediately to receive your prize!</p>
<p style="color: red; font-weight: bold;">FINAL NOTICE - Respond within 7 days!</p>
</div>
</body>
</html>`;
		}

		return result;
	}

	private generateAdult(context: GenerationContext): EmailContent {
		const { faker, requestHtml } = context;

		const siteName = `${faker.word.adjective()}${faker.word.noun()}`.replace(
			/\s/g,
			"",
		);

		const subject = faker.helpers.arrayElement([
			"Someone wants to meet you",
			"3 new matches in your area",
			"You have unread messages",
			`${faker.person.firstName()} viewed your profile`,
			"New connection request",
			"Your match is waiting",
		]);

		const text = `Hi there!

You have new activity on your profile at ${siteName}.com!

- ${faker.number.int({ min: 2, max: 8 })} people viewed your profile
- ${faker.number.int({ min: 1, max: 5 })} new messages waiting
- ${faker.number.int({ min: 1, max: 3 })} matches in your area

Don't keep them waiting! Log in now to see who's interested.

Visit: www.${siteName.toLowerCase()}.${faker.helpers.arrayElement(SUSPICIOUS_TLDS)}

To stop receiving these emails, click here.`;

		const result: EmailContent = { subject, text };

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #330033; color: white; padding: 20px;">
<div style="max-width: 500px; margin: 0 auto; text-align: center;">
<h2 style="color: #ff66cc;">${this.escapeHtml(siteName)}</h2>
<p style="font-size: 18px;">You have new activity!</p>
<div style="background-color: #440044; padding: 20px; border-radius: 10px; margin: 20px 0;">
<p>Profile views: ${faker.number.int({ min: 2, max: 8 })}</p>
<p>New messages: ${faker.number.int({ min: 1, max: 5 })}</p>
<p>Local matches: ${faker.number.int({ min: 1, max: 3 })}</p>
</div>
<a href="#" style="background-color: #ff3399; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">See Who's Interested</a>
<p style="font-size: 10px; margin-top: 30px; color: #999;">Click here to unsubscribe</p>
</div>
<img src="https://tracking.${siteName.toLowerCase()}.com/pixel.gif" width="1" height="1" style="display:none;">
</body>
</html>`;
		}

		return result;
	}

	private generateMalware(context: GenerationContext): EmailContent {
		const { faker, requestHtml, pluginConfig } = context;

		// biome-ignore lint/complexity/useLiteralKeys: TypeScript noPropertyAccessFromIndexSignature requires bracket notation
		const includeAttachments = pluginConfig?.["includeAttachments"] === true;

		const invoiceNum = `INV-${faker.date.recent().getFullYear()}-${faker.string.numeric(4)}`;
		const trackingNum = faker.string.alphanumeric(12).toUpperCase();

		const templates = [
			{
				subject: `Invoice #${invoiceNum} attached`,
				filename: "invoice.pdf.exe",
				contentType: "application/octet-stream",
				text: `Please find attached invoice #${invoiceNum} for your recent order.

Payment is due within 30 days.

Best regards,
Accounts Department`,
			},
			{
				subject: "Your package could not be delivered",
				filename: "shipping_label.pdf.scr",
				contentType: "application/octet-stream",
				text: `Your package (tracking: ${trackingNum}) could not be delivered.

Please see the attached shipping label and reschedule delivery.

Delivery Services`,
			},
			{
				subject: `SCAN_${faker.date.recent().toISOString().slice(0, 10).replace(/-/g, "")}.pdf`,
				filename: `SCAN_${faker.date.recent().toISOString().slice(0, 10).replace(/-/g, "")}.pdf.exe`,
				contentType: "application/octet-stream",
				text: `Attached is the scanned document you requested.

Sent from my scanner.`,
			},
			{
				subject: "RE: Updated contract",
				filename: "contract_final_v2.docm",
				contentType: "application/vnd.ms-word.document.macroEnabled.12",
				text: `Hi,

Please review the attached updated contract and sign where indicated.

Thanks,
${faker.person.firstName()}`,
			},
		];

		const template = faker.helpers.arrayElement(templates);

		const result: EmailContent = {
			subject: template.subject,
			text: template.text,
		};

		if (requestHtml) {
			result.html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif;">
${template.text
	.split("\n\n")
	.map((p) => `<p>${this.escapeHtml(p)}</p>`)
	.join("\n")}
<p style="color: #666; font-size: 12px;">[Attachment: ${this.escapeHtml(template.filename)}]</p>
</body>
</html>`;
		}

		if (includeAttachments) {
			const randomBytes = Buffer.from(
				faker.string.alphanumeric(faker.number.int({ min: 100, max: 500 })),
			);
			const attachment: Attachment = {
				filename: template.filename,
				contentType: template.contentType,
				content: randomBytes,
			};
			result.attachments = [attachment];
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
