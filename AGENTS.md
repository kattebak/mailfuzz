# Agent Guidelines

This document provides instructions for AI agents working on this codebase.

## Coding Standards

See [CODING_STANDARDS.md](./CODING_STANDARDS.md) for detailed coding standards including:

- Type safety rules (no `any`, no `!` assertions)
- Error handling patterns (no try/catch except at boundaries)
- Zod validation at boundaries
- Testing standards

## Development Workflow

**Never run pm2, tsx, tsc, vite, or other tools directly.** Use `npm run <script>` instead.

Run `npm run` to see all available scripts.

If a script doesn't exist, add it to package.json.

### Linting

Always run `npm run fix` to run the Biome linter and fix any errors.

### Workspace Commands

Use the `-w` flag to run scripts in specific workspaces instead of `cd`:

```bash
# Good - use workspace flag
npm test -w packages/remit-electrodb-service
npm run build -w packages/remit-mailbox-service

# Bad - don't cd into directories
cd packages/remit-electrodb-service && npm test
```
