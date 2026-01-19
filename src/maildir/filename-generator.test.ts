import { describe, expect, it } from "vitest";
import { FilenameGenerator, validateFlagOrder } from "./filename-generator.js";

describe("FilenameGenerator", () => {
	describe("generate", () => {
		it("generates a valid filename", () => {
			const generator = new FilenameGenerator();
			const timestamp = 1705594200;
			const size = 4096;

			const filename = generator.generate(timestamp, size);

			expect(filename).toMatch(/^1705594200\.M\d+P\d+Q\d+\.[^,]+,S=4096$/);
		});

		it("generates filename with flags", () => {
			const generator = new FilenameGenerator();
			const timestamp = 1705594200;
			const size = 4096;

			const filename = generator.generate(timestamp, size, ["S", "R"]);

			// Flags should be sorted alphabetically
			expect(filename).toMatch(/,S=4096:2,RS$/);
		});

		it("generates unique filenames", () => {
			const generator = new FilenameGenerator();
			const timestamp = 1705594200;
			const size = 1000;

			const filenames = new Set<string>();
			for (let i = 0; i < 100; i++) {
				filenames.add(generator.generate(timestamp, size));
			}

			// All filenames should be unique
			expect(filenames.size).toBe(100);
		});
	});

	describe("generateTmpFilename", () => {
		it("generates filename without size suffix", () => {
			const generator = new FilenameGenerator();
			const timestamp = 1705594200;

			const filename = generator.generateTmpFilename(timestamp);

			expect(filename).not.toContain(",S=");
			expect(filename).not.toContain(":2,");
		});
	});

	describe("addSizeAndFlags", () => {
		it("adds size suffix to filename", () => {
			const generator = new FilenameGenerator();
			const tmpFilename = "1705594200.M123456P789Q1.localhost";

			const result = generator.addSizeAndFlags(tmpFilename, 4096);

			expect(result).toBe(`${tmpFilename},S=4096`);
		});

		it("adds size and flags suffix", () => {
			const generator = new FilenameGenerator();
			const tmpFilename = "1705594200.M123456P789Q1.localhost";

			const result = generator.addSizeAndFlags(tmpFilename, 4096, ["S", "F"]);

			// Flags should be sorted
			expect(result).toBe(`${tmpFilename},S=4096:2,FS`);
		});
	});

	describe("parse", () => {
		it("parses timestamp from filename", () => {
			const generator = new FilenameGenerator();
			const result = generator.parse("1705594200.M123456P789.localhost,S=4096");

			expect(result.timestamp).toBe(1705594200);
		});

		it("parses size from filename", () => {
			const generator = new FilenameGenerator();
			const result = generator.parse("1705594200.M123456P789.localhost,S=4096");

			expect(result.size).toBe(4096);
		});

		it("parses flags from filename", () => {
			const generator = new FilenameGenerator();
			const result = generator.parse(
				"1705594200.M123456P789.localhost,S=4096:2,FRS",
			);

			expect(result.flags).toEqual(["F", "R", "S"]);
		});

		it("handles filename without flags", () => {
			const generator = new FilenameGenerator();
			const result = generator.parse("1705594200.M123456P789.localhost,S=4096");

			expect(result.flags).toEqual([]);
		});
	});
});

describe("validateFlagOrder", () => {
	it("validates correct alphabetical order", () => {
		expect(validateFlagOrder("")).toBe(true);
		expect(validateFlagOrder("S")).toBe(true);
		expect(validateFlagOrder("FS")).toBe(true);
		expect(validateFlagOrder("DFPRST")).toBe(true);
	});

	it("rejects incorrect order", () => {
		expect(validateFlagOrder("SF")).toBe(false);
		expect(validateFlagOrder("BA")).toBe(false);
		expect(validateFlagOrder("TSRPFD")).toBe(false);
	});

	it("rejects duplicate flags", () => {
		expect(validateFlagOrder("SS")).toBe(false);
		expect(validateFlagOrder("FSS")).toBe(false);
	});
});
