import type { Faker } from "@faker-js/faker";
import type { Participant } from "../types.js";

/**
 * Manages a pool of fake participants for email generation.
 * Uses seeded Faker for deterministic participant generation.
 */
export class ParticipantPool {
	private participants: Participant[] = [];
	private readonly faker: Faker;

	constructor(faker: Faker, maxParticipants: number) {
		this.faker = faker;
		this.generateParticipants(maxParticipants);
	}

	/**
	 * Generate the initial pool of participants.
	 */
	private generateParticipants(count: number): void {
		for (let i = 0; i < count; i++) {
			const firstName = this.faker.person.firstName();
			const lastName = this.faker.person.lastName();
			const email = this.faker.internet
				.email({
					firstName,
					lastName,
					provider: this.faker.helpers.arrayElement([
						"gmail.com",
						"yahoo.com",
						"outlook.com",
						"proton.me",
						"icloud.com",
						"fastmail.com",
						"hey.com",
					]),
				})
				.toLowerCase();

			this.participants.push({ firstName, lastName, email });
		}
	}

	/**
	 * Get all participants in the pool.
	 */
	getAll(): Participant[] {
		return [...this.participants];
	}

	/**
	 * Get a participant by index.
	 */
	get(index: number): Participant {
		const participant = this.participants[index % this.participants.length];
		if (!participant) {
			throw new Error(`No participant at index ${index}`);
		}
		return participant;
	}

	/**
	 * Get a random participant using the seeded Faker.
	 */
	getRandom(): Participant {
		return this.faker.helpers.arrayElement(this.participants);
	}

	/**
	 * Get a random participant excluding specific participants.
	 */
	getRandomExcluding(exclude: Participant[]): Participant {
		const excludeEmails = new Set(exclude.map((p) => p.email));
		const available = this.participants.filter(
			(p) => !excludeEmails.has(p.email),
		);

		if (available.length === 0) {
			// Fall back to any participant if all are excluded
			return this.getRandom();
		}

		return this.faker.helpers.arrayElement(available);
	}

	/**
	 * Get multiple random participants.
	 */
	getRandomMultiple(count: number, exclude: Participant[] = []): Participant[] {
		const result: Participant[] = [];
		const excludeEmails = new Set(exclude.map((p) => p.email));

		const available = this.participants.filter(
			(p) => !excludeEmails.has(p.email),
		);

		const actualCount = Math.min(count, available.length);

		// Use Fisher-Yates shuffle approach with seeded random
		const shuffled = [...available];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = this.faker.number.int({ min: 0, max: i });
			const temp = shuffled[i];
			const swapItem = shuffled[j];
			if (temp && swapItem) {
				shuffled[i] = swapItem;
				shuffled[j] = temp;
			}
		}

		for (let i = 0; i < actualCount; i++) {
			const participant = shuffled[i];
			if (participant) {
				result.push(participant);
			}
		}

		return result;
	}

	/**
	 * Get pool size.
	 */
	get size(): number {
		return this.participants.length;
	}
}
