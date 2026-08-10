import { defineConfig } from "vitest/config";

// two forks fits the smallest dev machine we run on; CI keeps the CPU-count default
const localForkBounds = { minForks: 1, maxForks: 2 };

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		pool: "forks",
		poolOptions: {
			forks: process.env.CI ? {} : localForkBounds,
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts"],
		},
		globals: false,
	},
});
