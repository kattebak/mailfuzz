import { writeFileSync } from "node:fs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { MailfuzzConfigSchema } from "./schema.js";

/**
 * Generate JSON Schema from the Zod schema.
 * The generated schema enables IDE autocompletion for mailfuzz.json files.
 */
const generateJsonSchema = (): void => {
	const jsonSchema = zodToJsonSchema(MailfuzzConfigSchema, {
		name: "MailfuzzConfig",
		$refStrategy: "none",
	});

	// Add schema metadata
	const schema = {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://mailfuzz.dev/schemas/1.0.0/schema.json",
		title: "Mailfuzz Configuration",
		description: "Configuration schema for mailfuzz email generator",
		...jsonSchema,
	};

	const outputPath = new URL("./schema.json", import.meta.url).pathname;
	writeFileSync(outputPath, JSON.stringify(schema, null, "\t"));

	console.log(`Generated JSON Schema: ${outputPath}`);
};

generateJsonSchema();
