# Agent Guidelines

This document provides instructions for AI agents working on this codebase.

## Git Workflow — Worktrees and Pull Requests

**NEVER work directly on the current worktree or main branch.** All work MUST happen in isolated git worktrees that produce pull requests.

### Rules

1. **Always use worktrees**: Every piece of work — features, fixes, refactors — MUST be done in a git worktree (`isolation: "worktree"` for Agent tool calls). Never modify files in the repository root directly.
2. **Always create pull requests**: Every change MUST be delivered as a PR. Do not commit to main. Do not push directly to main.
3. **Bias toward agents**: Delegate implementation work to sub-agents running in worktrees. The main conversation coordinates and reviews — it does not implement.
4. **One PR per concern**: Each PR should address a single feature, fix, or improvement. Don't bundle unrelated changes.
5. **Monitor your PRs**: After creating a PR, watch CI checks. If they fail, fix the issues (in the same worktree/branch) and push again.

### Workflow

```
User request
  → /architect (design in main context — read-only)
  → Agent in worktree (implement the plan)
  → Push branch, create PR
  → Monitor CI, fix failures
  → Report back to user
```

### Example

```
# Good — delegate to an agent in an isolated worktree
Agent(prompt: "implement feature X", isolation: "worktree")

# Bad — editing files directly in the main worktree
Edit(file: "src/foo.ts", ...)
```

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
