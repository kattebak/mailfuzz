import type {
	Attachment,
	EmailContent,
	EmailPlugin,
	GenerationContext,
	Participant,
	PluginCapabilities,
} from "../types.js";

type TransactionalCategory =
	| "meeting-invite"
	| "restaurant-booking"
	| "hotel-booking"
	| "appointment";

interface CategoryWeight {
	category: TransactionalCategory;
	weight: number;
}

const DEFAULT_CATEGORY_WEIGHTS: CategoryWeight[] = [
	{ category: "meeting-invite", weight: 0.4 },
	{ category: "restaurant-booking", weight: 0.2 },
	{ category: "hotel-booking", weight: 0.2 },
	{ category: "appointment", weight: 0.2 },
];

interface CalendarEvent {
	summary: string;
	location: string;
	description: string;
	start: Date;
	end: Date;
	organizer: Participant;
	attendee: Participant;
	method: "REQUEST" | "PUBLISH";
}

/**
 * Transactional email plugin for calendar-driven notifications.
 * Emits a text/calendar MIME part (meeting invites and booking confirmations)
 * so downstream classifiers recognise the message as transactional.
 */
export class TransactionalEmailPlugin implements EmailPlugin {
	readonly id = "transactional";
	readonly name = "Transactional Email";
	readonly description =
		"Calendar invites and booking confirmations with a text/calendar part";
	readonly defaultWeight = 0.2;

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
		const event = this.buildEvent(context, category);

		const subject = this.buildSubject(category, event);
		const text = this.buildText(category, event);
		const ics = this.buildCalendar(context, event);

		const attachment: Attachment = {
			filename: event.method === "REQUEST" ? "invite.ics" : "booking.ics",
			contentType: `text/calendar; charset=utf-8; method=${event.method}`,
			content: Buffer.from(ics, "utf-8"),
		};

		const result: EmailContent = {
			subject,
			text,
			sender: event.organizer,
			attachments: [attachment],
		};

		if (context.requestHtml) {
			result.html = this.buildHtml(category, event);
		}

		return result;
	}

	private selectCategory(context: GenerationContext): TransactionalCategory {
		const { faker } = context;
		const totalWeight = DEFAULT_CATEGORY_WEIGHTS.reduce(
			(sum, w) => sum + w.weight,
			0,
		);
		const random = faker.number.float({ min: 0, max: totalWeight });

		let cumulative = 0;
		for (const { category, weight } of DEFAULT_CATEGORY_WEIGHTS) {
			cumulative += weight;
			if (random <= cumulative) {
				return category;
			}
		}

		return "meeting-invite";
	}

	private buildEvent(
		context: GenerationContext,
		category: TransactionalCategory,
	): CalendarEvent {
		const { faker, sender, recipients } = context;

		const recipient = recipients[0] ?? sender;
		const start = faker.date.soon({ days: 21 });
		const durationMinutes = faker.helpers.arrayElement([30, 60, 90, 120]);
		const end = new Date(start.getTime() + durationMinutes * 60_000);

		if (category === "meeting-invite") {
			const organizer = sender;
			return {
				summary: this.meetingSummary(context),
				location: faker.helpers.arrayElement([
					`https://meet.example.com/${faker.string.alphanumeric(10)}`,
					`Conference Room ${faker.helpers.arrayElement(["A", "B", "C"])}`,
					`Zoom: https://zoom.us/j/${faker.string.numeric(10)}`,
				]),
				description: `Agenda: ${faker.company.catchPhrase()}.`,
				start,
				end,
				organizer,
				attendee: recipient,
				method: "REQUEST",
			};
		}

		if (category === "restaurant-booking") {
			const venue = `${faker.person.lastName()}'s ${faker.helpers.arrayElement(["Bistro", "Kitchen", "Grill", "Trattoria"])}`;
			return {
				summary: `Table for ${faker.number.int({ min: 2, max: 8 })} at ${venue}`,
				location: `${venue}, ${faker.location.streetAddress()}, ${faker.location.city()}`,
				description: `Reservation confirmed under ${recipient.firstName} ${recipient.lastName}.`,
				start,
				end,
				organizer: this.serviceSender(context, "reservations", venue),
				attendee: recipient,
				method: "PUBLISH",
			};
		}

		if (category === "hotel-booking") {
			const hotel = `${faker.helpers.arrayElement(["Grand", "Royal", "Park", "Harbour"])} ${faker.helpers.arrayElement(["Hotel", "Suites", "Inn", "Residence"])}`;
			const checkout = new Date(
				start.getTime() +
					faker.number.int({ min: 1, max: 5 }) * 24 * 60 * 60_000,
			);
			return {
				summary: `Stay at ${hotel} - Confirmation ${faker.string.alphanumeric(8).toUpperCase()}`,
				location: `${hotel}, ${faker.location.city()}, ${faker.location.country()}`,
				description: `Booking confirmed for ${recipient.firstName} ${recipient.lastName}.`,
				start,
				end: checkout,
				organizer: this.serviceSender(context, "bookings", hotel),
				attendee: recipient,
				method: "PUBLISH",
			};
		}

		const clinic = `${faker.person.lastName()} ${faker.helpers.arrayElement(["Clinic", "Dental", "Practice", "Studio"])}`;
		return {
			summary: `${faker.helpers.arrayElement(["Appointment", "Check-up", "Consultation", "Session"])} at ${clinic}`,
			location: `${clinic}, ${faker.location.streetAddress()}, ${faker.location.city()}`,
			description: `Appointment confirmed for ${recipient.firstName} ${recipient.lastName}.`,
			start,
			end,
			organizer: this.serviceSender(context, "appointments", clinic),
			attendee: recipient,
			method: "PUBLISH",
		};
	}

	private serviceSender(
		context: GenerationContext,
		prefix: string,
		orgName: string,
	): Participant {
		const domain = `${orgName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
		return {
			firstName: orgName,
			lastName: "",
			email: `${prefix}@${domain}`,
		};
	}

	private meetingSummary(context: GenerationContext): string {
		const { faker } = context;
		return faker.helpers.arrayElement([
			`${faker.company.buzzNoun()} sync`,
			`Project kickoff: ${faker.commerce.productName()}`,
			`1:1 with ${faker.person.firstName()}`,
			"Weekly team standup",
			`Design review - ${faker.company.buzzPhrase()}`,
			"Quarterly planning",
		]);
	}

	private buildSubject(
		category: TransactionalCategory,
		event: CalendarEvent,
	): string {
		if (category === "meeting-invite") {
			return `Invitation: ${event.summary}`;
		}
		return `Confirmed: ${event.summary}`;
	}

	private buildText(
		category: TransactionalCategory,
		event: CalendarEvent,
	): string {
		const when = `${event.start.toUTCString()} - ${event.end.toUTCString()}`;

		if (category === "meeting-invite") {
			return `Hi ${event.attendee.firstName},

You are invited to "${event.summary}".

When: ${when}
Where: ${event.location}

${event.description}

A calendar invitation is attached. Please accept or decline.

${event.organizer.firstName}`;
		}

		return `Hi ${event.attendee.firstName},

Your booking is confirmed.

${event.summary}
When: ${when}
Where: ${event.location}

${event.description}

Add this to your calendar using the attached file.

${event.organizer.firstName}`;
	}

	private buildCalendar(
		context: GenerationContext,
		event: CalendarEvent,
	): string {
		const { faker } = context;
		const uid = `${faker.string.uuid()}@mailfuzz.local`;
		const dtstamp = this.toICalDate(new Date());

		const lines = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//Mailfuzz//Transactional//EN",
			"CALSCALE:GREGORIAN",
			`METHOD:${event.method}`,
			"BEGIN:VEVENT",
			`UID:${uid}`,
			`DTSTAMP:${dtstamp}`,
			`DTSTART:${this.toICalDate(event.start)}`,
			`DTEND:${this.toICalDate(event.end)}`,
			`SUMMARY:${this.escapeICal(event.summary)}`,
			`LOCATION:${this.escapeICal(event.location)}`,
			`DESCRIPTION:${this.escapeICal(event.description)}`,
			`ORGANIZER;CN=${this.escapeICal(event.organizer.firstName)}:mailto:${event.organizer.email}`,
			`ATTENDEE;CN=${this.escapeICal(`${event.attendee.firstName} ${event.attendee.lastName}`)};RSVP=TRUE:mailto:${event.attendee.email}`,
			"STATUS:CONFIRMED",
			"END:VEVENT",
			"END:VCALENDAR",
		];

		return `${lines.join("\r\n")}\r\n`;
	}

	private toICalDate(date: Date): string {
		return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
	}

	private escapeICal(value: string): string {
		return value
			.replace(/\\/g, "\\\\")
			.replace(/;/g, "\\;")
			.replace(/,/g, "\\,")
			.replace(/\n/g, "\\n");
	}

	private buildHtml(
		category: TransactionalCategory,
		event: CalendarEvent,
	): string {
		const heading =
			category === "meeting-invite" ? "You're invited" : "Booking confirmed";

		return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
<h2 style="margin: 0 0 10px 0;">${this.escapeHtml(heading)}</h2>
<h3 style="margin: 0 0 20px 0; color: #0066cc;">${this.escapeHtml(event.summary)}</h3>
<table style="border-collapse: collapse; width: 100%;">
<tr><td style="padding: 6px 12px 6px 0; color: #666;">When</td><td style="padding: 6px 0;">${this.escapeHtml(event.start.toUTCString())}</td></tr>
<tr><td style="padding: 6px 12px 6px 0; color: #666;">Where</td><td style="padding: 6px 0;">${this.escapeHtml(event.location)}</td></tr>
</table>
<p style="margin-top: 20px;">${this.escapeHtml(event.description)}</p>
<p style="color: #666; font-size: 12px;">A calendar file is attached to this message.</p>
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
