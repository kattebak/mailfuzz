import { describe, expect, it } from "vitest";
import type { EmailPlugin, PluginCapabilities } from "../types.js";
import {
	filterPluginsByCapability,
	isValidPluginId,
	normalizeWeights,
	pluginCanHandle,
	selectPluginByWeight,
	validateCapabilities,
	validatePlugin,
} from "./PluginInterface.js";

const createMockPlugin = (
	id: string,
	capabilities: Partial<PluginCapabilities>,
): EmailPlugin => ({
	id,
	name: `Mock ${id}`,
	capabilities: {
		canBeReply: false,
		canBeForward: false,
		canBeOriginal: true,
		supportsHtml: false,
		supportsAttachments: false,
		supportsMultipleRecipients: true,
		...capabilities,
	},
	generate: () => ({ subject: "Test", text: "Test body" }),
});

describe("isValidPluginId", () => {
	it("accepts valid lowercase IDs", () => {
		expect(isValidPluginId("standard")).toBe(true);
		expect(isValidPluginId("marketing")).toBe(true);
		expect(isValidPluginId("calendar-invite")).toBe(true);
		expect(isValidPluginId("plugin123")).toBe(true);
	});

	it("rejects invalid IDs", () => {
		expect(isValidPluginId("")).toBe(false);
		expect(isValidPluginId("Standard")).toBe(false); // Uppercase
		expect(isValidPluginId("123plugin")).toBe(false); // Starts with number
		expect(isValidPluginId("plugin_test")).toBe(false); // Underscore
		expect(isValidPluginId("plugin.test")).toBe(false); // Period
	});
});

describe("validateCapabilities", () => {
	it("accepts valid capability combinations", () => {
		expect(
			validateCapabilities({
				canBeReply: true,
				canBeForward: true,
				canBeOriginal: true,
				supportsHtml: true,
				supportsAttachments: false,
			}),
		).toEqual({ valid: true });

		expect(
			validateCapabilities({
				canBeReply: false,
				canBeForward: false,
				canBeOriginal: true,
				supportsHtml: false,
				supportsAttachments: false,
			}),
		).toEqual({ valid: true });
	});

	it("rejects plugin that cannot generate any email type", () => {
		const result = validateCapabilities({
			canBeReply: false,
			canBeForward: false,
			canBeOriginal: false,
			supportsHtml: false,
			supportsAttachments: false,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toContain("at least one email type");
	});
});

describe("validatePlugin", () => {
	it("accepts valid plugin", () => {
		const plugin = createMockPlugin("standard", { canBeOriginal: true });
		const result = validatePlugin(plugin);

		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("rejects plugin with invalid ID", () => {
		const plugin = createMockPlugin("Invalid-ID", { canBeOriginal: true });
		const result = validatePlugin(plugin);

		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("Invalid plugin ID");
	});
});

describe("pluginCanHandle", () => {
	it("correctly identifies original capability", () => {
		const plugin = createMockPlugin("test", { canBeOriginal: true });
		expect(pluginCanHandle(plugin, "original")).toBe(true);
		expect(pluginCanHandle(plugin, "reply")).toBe(false);
		expect(pluginCanHandle(plugin, "forward")).toBe(false);
	});

	it("correctly identifies reply capability", () => {
		const plugin = createMockPlugin("test", {
			canBeOriginal: false,
			canBeReply: true,
		});
		expect(pluginCanHandle(plugin, "original")).toBe(false);
		expect(pluginCanHandle(plugin, "reply")).toBe(true);
	});
});

describe("filterPluginsByCapability", () => {
	it("filters plugins by original capability", () => {
		const plugins = [
			createMockPlugin("a", { canBeOriginal: true }),
			createMockPlugin("b", { canBeOriginal: false, canBeReply: true }),
		];

		const filtered = filterPluginsByCapability(plugins, "original");
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.id).toBe("a");
	});

	it("filters plugins by reply capability", () => {
		const plugins = [
			createMockPlugin("a", { canBeReply: true }),
			createMockPlugin("b", { canBeReply: false }),
			createMockPlugin("c", { canBeReply: true }),
		];

		const filtered = filterPluginsByCapability(plugins, "reply");
		expect(filtered).toHaveLength(2);
		expect(filtered.map((p) => p.id)).toEqual(["a", "c"]);
	});
});

describe("normalizeWeights", () => {
	it("normalizes weights to sum to 1", () => {
		const plugins = [createMockPlugin("a", {}), createMockPlugin("b", {})];

		const weights = normalizeWeights(plugins, { a: 3, b: 1 });

		expect(weights.get("a")).toBe(0.75);
		expect(weights.get("b")).toBe(0.25);
	});

	it("uses default weight of 1 for unspecified plugins", () => {
		const plugins = [createMockPlugin("a", {}), createMockPlugin("b", {})];

		const weights = normalizeWeights(plugins, { a: 1 });

		expect(weights.get("a")).toBe(0.5);
		expect(weights.get("b")).toBe(0.5);
	});
});

describe("selectPluginByWeight", () => {
	it("selects plugin based on random value", () => {
		const plugins = [createMockPlugin("a", {}), createMockPlugin("b", {})];

		const weights = new Map([
			["a", 0.7],
			["b", 0.3],
		]);

		// Random value 0.5 should select plugin "a" (cumulative 0.7)
		expect(selectPluginByWeight(plugins, weights, 0.5).id).toBe("a");

		// Random value 0.8 should select plugin "b" (cumulative 1.0)
		expect(selectPluginByWeight(plugins, weights, 0.8).id).toBe("b");

		// Random value 0.0 should select plugin "a"
		expect(selectPluginByWeight(plugins, weights, 0.0).id).toBe("a");
	});
});
