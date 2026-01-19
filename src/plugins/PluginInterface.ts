import type { EmailPlugin, PluginCapabilities } from "../types.js";

/**
 * Validates a plugin ID format.
 * Must be lowercase alphanumeric with hyphens, starting with a letter.
 */
export const isValidPluginId = (id: string): boolean => {
	return /^[a-z][a-z0-9-]*$/.test(id);
};

/**
 * Validates that plugin capabilities are sensible.
 * A plugin must be able to generate at least one type of email.
 */
export const validateCapabilities = (
	capabilities: PluginCapabilities,
): { valid: boolean; error?: string } => {
	const canBeOriginal = capabilities.canBeOriginal ?? true;

	if (
		!capabilities.canBeReply &&
		!capabilities.canBeForward &&
		!canBeOriginal
	) {
		return {
			valid: false,
			error: "Plugin must be able to generate at least one email type",
		};
	}

	return { valid: true };
};

/**
 * Validates a plugin at registration time.
 */
export const validatePlugin = (
	plugin: EmailPlugin,
): { valid: boolean; errors: string[] } => {
	const errors: string[] = [];

	if (!isValidPluginId(plugin.id)) {
		errors.push(
			`Invalid plugin ID: "${plugin.id}". Must be lowercase alphanumeric with hyphens, starting with a letter.`,
		);
	}

	if (!plugin.name || plugin.name.trim().length === 0) {
		errors.push("Plugin must have a non-empty name");
	}

	const capabilityValidation = validateCapabilities(plugin.capabilities);
	if (!capabilityValidation.valid && capabilityValidation.error) {
		errors.push(capabilityValidation.error);
	}

	return {
		valid: errors.length === 0,
		errors,
	};
};

/**
 * Check if a plugin can handle a given generation type.
 */
export const pluginCanHandle = (
	plugin: EmailPlugin,
	type: "original" | "reply" | "forward",
): boolean => {
	const { capabilities } = plugin;

	switch (type) {
		case "original":
			return capabilities.canBeOriginal ?? true;
		case "reply":
			return capabilities.canBeReply;
		case "forward":
			return capabilities.canBeForward;
	}
};

/**
 * Filter plugins by required capability.
 */
export const filterPluginsByCapability = (
	plugins: EmailPlugin[],
	type: "original" | "reply" | "forward",
): EmailPlugin[] => {
	return plugins.filter((plugin) => pluginCanHandle(plugin, type));
};

/**
 * Normalize weights for a subset of plugins.
 * Returns a map of plugin ID to normalized weight (0-1, summing to 1).
 */
export const normalizeWeights = (
	plugins: EmailPlugin[],
	weights: Record<string, number>,
): Map<string, number> => {
	const result = new Map<string, number>();

	// Get raw weights for active plugins
	let totalWeight = 0;
	for (const plugin of plugins) {
		const weight = weights[plugin.id] ?? 1;
		result.set(plugin.id, weight);
		totalWeight += weight;
	}

	// Normalize to sum to 1
	if (totalWeight > 0) {
		for (const [id, weight] of result) {
			result.set(id, weight / totalWeight);
		}
	}

	return result;
};

/**
 * Select a plugin based on weighted random selection.
 * @param plugins Available plugins
 * @param normalizedWeights Map of plugin ID to normalized weight
 * @param random Random number between 0 and 1 (from seeded Faker)
 */
export const selectPluginByWeight = (
	plugins: EmailPlugin[],
	normalizedWeights: Map<string, number>,
	random: number,
): EmailPlugin => {
	let cumulative = 0;

	for (const plugin of plugins) {
		const weight = normalizedWeights.get(plugin.id) ?? 0;
		cumulative += weight;

		if (random < cumulative) {
			return plugin;
		}
	}

	// Fallback to last plugin (should not happen with proper normalization)
	const lastPlugin = plugins[plugins.length - 1];
	if (!lastPlugin) {
		throw new Error("No plugins available for selection");
	}
	return lastPlugin;
};
