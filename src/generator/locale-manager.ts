import { Faker, allLocales, base, en } from "@faker-js/faker";
import type { LocaleDefinition } from "@faker-js/faker";
import type { LocaleWeights } from "../types.js";

/**
 * All available Faker.js locale codes.
 * Exported for CLI validation.
 */
export const AVAILABLE_LOCALES = Object.keys(allLocales);

/**
 * Default locale configuration.
 */
const DEFAULT_FALLBACK_LOCALE = "en";
const DEFAULT_WEIGHTS: LocaleWeights = { en: 1.0 };

/**
 * Manages locale selection and Faker instance creation for multilingual email generation.
 *
 * Responsibilities:
 * - Validate locale codes against available Faker.js locales
 * - Normalize weights for weighted random selection
 * - Select locales using seeded randomness
 * - Create Faker instances with proper locale fallback chains
 */
export class LocaleManager {
	private readonly weights: LocaleWeights;
	private readonly normalizedWeights: Map<string, number>;
	private readonly fallbackLocale: string;
	private readonly sortedLocales: string[];

	/**
	 * Create a LocaleManager with weighted locales.
	 *
	 * @param weights - Locale weight configuration (e.g., { en: 0.7, de: 0.2, fr: 0.1 })
	 * @param fallbackLocale - Fallback locale for missing data (default: 'en')
	 * @throws Error if any locale code is invalid or weights are invalid
	 */
	constructor(weights?: LocaleWeights, fallbackLocale?: string) {
		this.fallbackLocale = fallbackLocale ?? DEFAULT_FALLBACK_LOCALE;
		this.weights =
			weights && Object.keys(weights).length > 0 ? weights : DEFAULT_WEIGHTS;

		// Validate all locale codes
		this.validateLocales();

		// Normalize weights and create sorted locale list for deterministic selection
		this.normalizedWeights = this.normalizeWeights();
		this.sortedLocales = Array.from(this.normalizedWeights.keys()).sort();
	}

	/**
	 * Validate that all configured locale codes are valid Faker.js locales.
	 * @throws Error if any locale code is invalid
	 */
	private validateLocales(): void {
		const invalidLocales: string[] = [];

		// Validate weights locales
		for (const locale of Object.keys(this.weights)) {
			if (!this.isValidLocale(locale)) {
				invalidLocales.push(locale);
			}
		}

		// Validate fallback locale
		if (!this.isValidLocale(this.fallbackLocale)) {
			invalidLocales.push(this.fallbackLocale);
		}

		if (invalidLocales.length > 0) {
			const available = AVAILABLE_LOCALES.slice(0, 20).join(", ");
			throw new Error(
				`Invalid locale code(s): ${invalidLocales.join(", ")}. ` +
					`Available locales include: ${available}... ` +
					`(${AVAILABLE_LOCALES.length} total)`,
			);
		}

		// Validate weights are positive
		for (const [locale, weight] of Object.entries(this.weights)) {
			if (typeof weight !== "number" || weight < 0) {
				throw new Error(
					`Invalid weight for locale '${locale}': ${weight}. Weights must be non-negative numbers.`,
				);
			}
		}

		// Ensure at least one positive weight
		const totalWeight = Object.values(this.weights).reduce(
			(sum, w) => sum + w,
			0,
		);
		if (totalWeight <= 0) {
			throw new Error("At least one locale must have a positive weight.");
		}
	}

	/**
	 * Check if a locale code is valid.
	 */
	isValidLocale(locale: string): boolean {
		return locale in allLocales;
	}

	/**
	 * Normalize weights to sum to 1.0.
	 */
	private normalizeWeights(): Map<string, number> {
		const normalized = new Map<string, number>();
		const totalWeight = Object.values(this.weights).reduce(
			(sum, w) => sum + w,
			0,
		);

		for (const [locale, weight] of Object.entries(this.weights)) {
			normalized.set(locale, weight / totalWeight);
		}

		return normalized;
	}

	/**
	 * Select a locale using weighted random selection.
	 *
	 * Uses the provided Faker instance for deterministic randomness.
	 * The selection is based on cumulative weights for even distribution.
	 *
	 * @param faker - Seeded Faker instance for random number generation
	 * @returns Selected locale code
	 */
	selectLocale(faker: Faker): string {
		// Single locale optimization
		if (this.sortedLocales.length === 1) {
			return this.sortedLocales[0] as string;
		}

		const random = faker.number.float({ min: 0, max: 1 });
		let cumulative = 0;

		for (const locale of this.sortedLocales) {
			const weight = this.normalizedWeights.get(locale);
			if (weight === undefined) continue;

			cumulative += weight;
			if (random <= cumulative) {
				return locale;
			}
		}

		// Fallback to first locale (should not happen with proper normalization)
		return this.sortedLocales[0] as string;
	}

	/**
	 * Create a Faker instance configured for the specified locale.
	 *
	 * The Faker instance is created with a fallback chain:
	 * [selectedLocale, fallbackLocale, en, base]
	 *
	 * This ensures that if the selected locale lacks data for a specific field,
	 * Faker falls back through the chain until it finds data.
	 *
	 * @param locale - The primary locale code
	 * @param seed - Optional seed for deterministic generation
	 * @returns Configured Faker instance
	 */
	createFakerInstance(locale: string, seed?: number): Faker {
		const localeChain = this.buildLocaleChain(locale);
		const faker = new Faker({ locale: localeChain });

		if (seed !== undefined) {
			faker.seed(seed);
		}

		return faker;
	}

	/**
	 * Build the locale fallback chain for a given locale.
	 *
	 * Chain order: [selectedLocale, fallbackLocale, en, base]
	 * Duplicates are removed while preserving order.
	 */
	private buildLocaleChain(locale: string): LocaleDefinition[] {
		const chain: string[] = [locale];

		// Add fallback locale if different
		if (this.fallbackLocale !== locale) {
			chain.push(this.fallbackLocale);
		}

		// Always include 'en' as secondary fallback (if not already in chain)
		if (!chain.includes("en")) {
			chain.push("en");
		}

		// Convert to LocaleDefinition objects and add base
		const localeDefinitions: LocaleDefinition[] = chain.map(
			(code) => allLocales[code as keyof typeof allLocales],
		);

		// Always end with base as final fallback
		localeDefinitions.push(base);

		return localeDefinitions;
	}

	/**
	 * Get all configured locales.
	 */
	getLocales(): string[] {
		return [...this.sortedLocales];
	}

	/**
	 * Get the weight for a specific locale.
	 * Returns the normalized weight (0-1).
	 */
	getWeight(locale: string): number {
		return this.normalizedWeights.get(locale) ?? 0;
	}

	/**
	 * Get the fallback locale.
	 */
	getFallbackLocale(): string {
		return this.fallbackLocale;
	}

	/**
	 * Get available locale codes as a formatted string for help text.
	 */
	static getAvailableLocalesHelp(): string {
		return AVAILABLE_LOCALES.join(", ");
	}
}
