import { appendFileSync } from "node:fs";
import { ImapFlow } from "imapflow";

const host = process.env.IMAP_HOST || "localhost";
const port = Number(process.env.IMAP_PORT || "143");
const user = process.env.IMAP_USER || "testuser";
const pass = process.env.IMAP_PASS || "testpass";
const expectedMessages = Number(process.env.EXPECTED_MESSAGES || "0");
const githubOutput = process.env.GITHUB_OUTPUT || "";

const writeOutput = (key, value) => {
	if (!githubOutput) return;
	appendFileSync(githubOutput, `${key}=${value}\n`);
};

const fail = (message) => {
	console.error(`IMAP verification failed: ${message}`);
	writeOutput("success", "false");
	writeOutput("message-count", "0");
	process.exit(1);
};

console.log(`Connecting to IMAP server at ${host}:${port} as ${user}`);

const client = new ImapFlow({
	host,
	port,
	auth: { user, pass },
	secure: false,
	logger: false,
});

await client.connect().catch((error) => {
	fail(`Could not connect to ${host}:${port} - ${error.message}`);
});

console.log("Connected and authenticated successfully");

const mailboxes = await client.list().catch((error) => {
	fail(`Could not list mailboxes - ${error.message}`);
});

console.log("Available mailboxes:");
for (const mailbox of mailboxes) {
	console.log(`  - ${mailbox.path}`);
}

const inbox = await client.mailboxOpen("INBOX").catch((error) => {
	fail(`Could not open INBOX - ${error.message}`);
});

const messageCount = inbox.exists || 0;
console.log(`\nINBOX contains ${messageCount} message(s)`);

if (expectedMessages > 0 && messageCount < expectedMessages) {
	await client.logout().catch(() => {});
	fail(
		`Expected at least ${expectedMessages} message(s) but found ${messageCount}`,
	);
}

if (messageCount > 0) {
	const limit = Math.min(messageCount, 5);
	console.log(`\nSample of first ${limit} message(s):`);

	let index = 0;
	for await (const message of client.fetch(`1:${limit}`, {
		envelope: true,
	})) {
		const { subject, from, date } = message.envelope;
		const sender =
			from && from.length > 0
				? `${from[0].name || ""} <${from[0].address}>`
				: "unknown";
		console.log(`  [${index + 1}] Subject: ${subject}`);
		console.log(`       From: ${sender}`);
		console.log(`       Date: ${date}`);
		index++;
	}
}

await client.logout().catch(() => {});

console.log("\nIMAP verification completed successfully");
writeOutput("message-count", String(messageCount));
writeOutput("success", "true");
