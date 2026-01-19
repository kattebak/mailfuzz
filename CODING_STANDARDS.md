# Coding Standards

## Documentation

Use the **context7** MCP server to look up current documentation for any library before implementing.

## Type Safety

- **No `any`**: Use `unknown` and validate
- **No `!` non-null assertions**: Handle null/undefined explicitly
- **Use type guards over casting**
- **Use Zod** for complex validation at boundaries (e.g., API inputs, external events)

```typescript
// Type guard example
const isUser = (value: unknown): value is User => {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.name === "string";
};

// Zod example
const UserSchema = z.object({ id: z.string(), name: z.string() });
type User = z.infer<typeof UserSchema>;
```

## Error Handling

- **NO try/catch** except at top-level handlers (SQS, HTTP endpoints)
- **Database errors are unrecoverable** - let them throw, don't catch
- Use `.then().catch().finally()` for async cleanup
- Don't log-and-rethrow - it's redundant
- Log errors using `util.inspect` because errors don't serialize to JSON

### Bad: try-catch obscures error source

```typescript
// DON'T: Which operation failed? connect? doWork?
try {
  await connection.connect();
  await doWork(connection);
} finally {
  await connection.disconnect();
}
```

### Good: Clear error boundaries with .then/.catch/.finally

```typescript
// DO: connect throws if it fails (critical error)
await connection.connect();

// Cleanup only applies to the work, not the connection setup
await doWork(connection)
  .then((result) => log.info({ result }, "Work complete"))
  .catch((error) => {
    log.error({ error }, "Work failed");
    throw error;
  })
  .finally(() => connection.disconnect());
```

### Exception: Top-level error boundaries

Try-catch is acceptable at the top level of request handlers:

```typescript
// OK: Top-level handler needs to catch for batch failure reporting
for (const record of event.Records) {
  try {
    await processRecord(record);
  } catch (error) {
    log.error({ error }, "Processing failed");
    failures.push(record.messageId);
  }
}
```

## Code Style

- Arrow functions: `const fn = () => {}` not `function fn() {}`
- Destructure at method start: `const { client } = this.config`
- Use `.js` extension for local imports (ESM)
- Return early, avoid nested else statements
- No comments except for complex business logic or non-obvious workarounds

```typescript
// Good - return early
const getDiscount = (user: User): number => {
  if (!user.isActive) return 0;
  if (user.isPremium) return 0.2;
  if (user.ordersCount > 10) return 0.1;
  return 0.05;
};
```

### Getters

Use getters for lazy instantiation, no manual caching with `_property`.

### Naming

- ElectroDB Service getters: name after collection (e.g., `accountService` for `account` collection)
- Derive types from ElectroDB utilities (`EntityItem`, `CreateEntityItem`)

### File Naming

Use **kebab-case** for all file and directory names.

```
# Good
src/
  user-profile/
    user-profile.ts
    user-profile.test.ts
  email-validator.ts
  maildir-writer.ts

# Bad
src/
  UserProfile/
    UserProfile.ts
  emailValidator.ts
  MaildirWriter.ts
```

**Rules:**

- All lowercase letters
- Words separated by hyphens (`-`)
- Test files: `<name>.test.ts`
- Index files: `index.ts` (for module re-exports)
- No PascalCase or camelCase in file names

**Rationale:**

- Avoids cross-platform issues (macOS/Windows are case-insensitive)
- Prevents git conflicts between `MyFile.ts` and `myfile.ts`
- URL-friendly and consistent with HTML/CSS conventions
- Matches Angular, Vue, and Google style guides

**Exceptions:**

- `README.md`, `LICENSE`, `AGENTS.md`, `CODING_STANDARDS.md` (conventional uppercase)
- Configuration files with established conventions (e.g., `tsconfig.json`, `Dockerfile`)

## Data Processing

- **Flatten first, then process** - avoid nested loops
- Use `.flatMap()`, `.flat()` to normalize data structures
- Process flat arrays with `.map()`, `.filter()`, `.reduce()`

## Concurrency

- **Always limit concurrency for I/O** - never use unbounded `Promise.all()` on dynamic arrays
- Use `p-limit` for limiting concurrent function calls
- Use `p-map` for mapping over arrays with concurrency control

```typescript
import pMap from "p-map";

// Good - bounded concurrency
const results = await pMap(messages, fetchBody, { concurrency: 5 });

// Bad - unbounded parallelism
const results = await Promise.all(messages.map(fetchBody));
```

`Promise.all()` is fine for a fixed, small number of promises (e.g., 2-3 parallel API calls).

## Tests

Co-locate tests with source files:

```
src/models/account.ts
src/models/account.test.ts
```

### Test Scripts

All packages must define these npm scripts:

```json
{
  "scripts": {
    "test:typecheck": "tsc --noEmit",
    "test:run": "node --import tsx --test 'src/**/*.test.ts'",
    "test": "npm run test:typecheck && npm run test:run"
  }
}
```

Run: `npm test` (typecheck + run)

## Package Configuration

- `"type": "module"` for ESM
- Extend root `tsconfig.json` in workspace packages
- All dependencies go in `devDependencies` (code is bundled for deployment)

### Root package.json

- Define shared dependencies with specific versions
- Internal packages use `file:` paths (e.g., `"@remit/remit-ddb-entities": "file:build/ddb-entities"`)

### Workspace package.json

- Reference shared dependencies with `"*"` version

```json
{
  "devDependencies": {
    "@remit/remit-ddb-entities": "*",
    "electrodb": "*",
    "@aws-sdk/lib-dynamodb": "*"
  }
}
```
