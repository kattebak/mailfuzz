import { Faker, en } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { AVAILABLE_LOCALES, LocaleManager } from "./locale-manager.js";

describe("LocaleManager", () => {
	describe("construction", () => {
		it("creates with default configuration", () => {
			const manager = new LocaleManager();
			expect(manager.getLocales()).toEqual(["en"]);
			expect(manager.getFallbackLocale()).toBe("en");
		});

		it("creates with single locale", () => {
			const manager = new LocaleManager({ de: 1.0 });
			expect(manager.getLocales()).toEqual(["de"]);
		});

		it("creates with multiple locales", () => {
			const manager = new LocaleManager({ en: 0.7, de: 0.2, fr: 0.1 });
			expect(manager.getLocales().sort()).toEqual(["de", "en", "fr"]);
		});

		it("creates with custom fallback locale", () => {
			const manager = new LocaleManager({ de: 1.0 }, "en_US");
			expect(manager.getFallbackLocale()).toBe("en_US");
		});

		it("throws for invalid locale code", () => {
			expect(() => new LocaleManager({ invalid_locale: 1.0 })).toThrow(
				/Invalid locale code/,
			);
		});

		it("throws for invalid fallback locale", () => {
			expect(() => new LocaleManager({ en: 1.0 }, "not_a_locale")).toThrow(
				/Invalid locale code/,
			);
		});

		it("throws for negative weight", () => {
			expect(() => new LocaleManager({ en: -0.5 })).toThrow(
				/must be non-negative/,
			);
		});

		it("throws for zero total weight", () => {
			expect(() => new LocaleManager({ en: 0, de: 0 })).toThrow(
				/at least one locale must have a positive weight/i,
			);
		});
	});

	describe("locale validation", () => {
		it("validates existing locales correctly", () => {
			const manager = new LocaleManager();
			expect(manager.isValidLocale("en")).toBe(true);
			expect(manager.isValidLocale("de")).toBe(true);
			expect(manager.isValidLocale("fr")).toBe(true);
			expect(manager.isValidLocale("de_AT")).toBe(true);
			expect(manager.isValidLocale("zh_CN")).toBe(true);
		});

		it("rejects invalid locales", () => {
			const manager = new LocaleManager();
			expect(manager.isValidLocale("invalid")).toBe(false);
			expect(manager.isValidLocale("xyz")).toBe(false);
			expect(manager.isValidLocale("")).toBe(false);
		});
	});

	describe("weight normalization", () => {
		it("normalizes weights to sum to 1.0", () => {
			const manager = new LocaleManager({ en: 2.0, de: 2.0 });
			expect(manager.getWeight("en")).toBeCloseTo(0.5);
			expect(manager.getWeight("de")).toBeCloseTo(0.5);
		});

		it("handles unequal weights", () => {
			const manager = new LocaleManager({ en: 3.0, de: 1.0 });
			expect(manager.getWeight("en")).toBeCloseTo(0.75);
			expect(manager.getWeight("de")).toBeCloseTo(0.25);
		});

		it("returns 0 for unlisted locale", () => {
			const manager = new LocaleManager({ en: 1.0 });
			expect(manager.getWeight("fr")).toBe(0);
		});
	});

	describe("selectLocale", () => {
		it("returns single locale when only one configured", () => {
			const manager = new LocaleManager({ de: 1.0 });
			const faker = new Faker({ locale: [en] });
			faker.seed(12345);

			const locale = manager.selectLocale(faker);
			expect(locale).toBe("de");
		});

		it("returns deterministic results with same seed", () => {
			const manager = new LocaleManager({ en: 0.5, de: 0.5 });

			const faker1 = new Faker({ locale: [en] });
			faker1.seed(42);
			const result1 = manager.selectLocale(faker1);

			const faker2 = new Faker({ locale: [en] });
			faker2.seed(42);
			const result2 = manager.selectLocale(faker2);

			expect(result1).toBe(result2);
		});

		it("distributes selections according to weights (statistical test)", () => {
			const manager = new LocaleManager({ en: 0.7, de: 0.3 });
			const faker = new Faker({ locale: [en] });
			faker.seed(12345);

			const counts: Record<string, number> = { en: 0, de: 0 };
			const iterations = 1000;

			for (let i = 0; i < iterations; i++) {
				const locale = manager.selectLocale(faker);
				counts[locale] = (counts[locale] ?? 0) + 1;
			}

			// With 1000 iterations and 70/30 split, we expect roughly 700/300
			// Allow 10% tolerance
			const enRatio = (counts.en ?? 0) / iterations;
			const deRatio = (counts.de ?? 0) / iterations;

			expect(enRatio).toBeGreaterThan(0.6);
			expect(enRatio).toBeLessThan(0.8);
			expect(deRatio).toBeGreaterThan(0.2);
			expect(deRatio).toBeLessThan(0.4);
		});
	});

	describe("createFakerInstance", () => {
		it("creates Faker instance for valid locale", () => {
			const manager = new LocaleManager();
			const faker = manager.createFakerInstance("de");

			// Faker should work and produce German names
			const firstName = faker.person.firstName();
			expect(typeof firstName).toBe("string");
			expect(firstName.length).toBeGreaterThan(0);
		});

		it("creates seeded Faker instance", () => {
			const manager = new LocaleManager();
			const faker1 = manager.createFakerInstance("en", 42);
			const faker2 = manager.createFakerInstance("en", 42);

			const name1 = faker1.person.firstName();
			const name2 = faker2.person.firstName();

			expect(name1).toBe(name2);
		});

		it("creates Faker with fallback chain", () => {
			const manager = new LocaleManager({ de: 1.0 }, "en");
			const faker = manager.createFakerInstance("de");

			// Should be able to generate content even if de lacks some data
			const company = faker.company.name();
			expect(typeof company).toBe("string");
		});
	});

	describe("AVAILABLE_LOCALES", () => {
		it("exports non-empty list of locales", () => {
			expect(Array.isArray(AVAILABLE_LOCALES)).toBe(true);
			expect(AVAILABLE_LOCALES.length).toBeGreaterThan(50);
		});

		it("includes common locales", () => {
			expect(AVAILABLE_LOCALES).toContain("en");
			expect(AVAILABLE_LOCALES).toContain("de");
			expect(AVAILABLE_LOCALES).toContain("fr");
			expect(AVAILABLE_LOCALES).toContain("es");
			expect(AVAILABLE_LOCALES).toContain("ja");
			expect(AVAILABLE_LOCALES).toContain("zh_CN");
		});
	});

	describe("getAvailableLocalesHelp", () => {
		it("returns comma-separated list", () => {
			const help = LocaleManager.getAvailableLocalesHelp();
			expect(typeof help).toBe("string");
			expect(help).toContain("en");
			expect(help).toContain(",");
		});
	});
});
