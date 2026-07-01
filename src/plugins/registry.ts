import type { EmailPlugin } from "../types.js";
import { FileUploadEmailPlugin } from "./file-upload-email-plugin.js";
import { MarketingEmailPlugin } from "./marketing-email-plugin.js";
import { NewsletterEmailPlugin } from "./newsletter-email-plugin.js";
import { SpamEmailPlugin } from "./spam-email-plugin.js";
import { StandardEmailPlugin } from "./standard-email-plugin.js";
import { TransactionalEmailPlugin } from "./transactional-email-plugin.js";

/**
 * All available plugins in the system.
 * Add new plugins here to make them available in the CLI.
 */
export const ALL_PLUGINS: readonly EmailPlugin[] = [
	new StandardEmailPlugin(),
	new MarketingEmailPlugin(),
	new NewsletterEmailPlugin(),
	new SpamEmailPlugin(),
	new FileUploadEmailPlugin(),
	new TransactionalEmailPlugin(),
];

/**
 * Map of plugin ID to plugin instance for quick lookup.
 */
export const PLUGIN_BY_ID: ReadonlyMap<string, EmailPlugin> = new Map(
	ALL_PLUGINS.map((p) => [p.id, p]),
);

/**
 * Get all available plugin IDs.
 */
export const getPluginIds = (): readonly string[] => {
	return ALL_PLUGINS.map((p) => p.id);
};

/**
 * Get a plugin by its ID.
 * Returns undefined if not found.
 */
export const getPluginById = (id: string): EmailPlugin | undefined => {
	return PLUGIN_BY_ID.get(id);
};

/**
 * Get plugins by a list of IDs.
 * Throws if any ID is not found.
 */
export const getPluginsByIds = (ids: readonly string[]): EmailPlugin[] => {
	const plugins: EmailPlugin[] = [];
	for (const id of ids) {
		const plugin = getPluginById(id);
		if (!plugin) {
			const available = getPluginIds().join(", ");
			throw new Error(
				`Unknown plugin: "${id}". Available plugins: ${available}`,
			);
		}
		plugins.push(plugin);
	}
	return plugins;
};
