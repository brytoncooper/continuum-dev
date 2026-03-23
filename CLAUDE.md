<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->

# Repo Apps Versus Library Consumers

Keep a hard boundary between repo apps and published library consumers.

- `apps/demo` and `apps/starter` are repo apps. They may consume workspace package source during local development
  and integration testing.
- `apps/demo` is a brand/demo site and composition root, not the canonical proof of npm-consumer behavior.
- `apps/starter` is an internal experiment and integration harness, not the canonical proof of npm-consumer behavior.
- The canonical proof of what downstream users get is the packed output from `dist/packages/*` after
  `build:release-packages`, `prepare:dist-packages`, and `verify:release-packages`.
- Do not change package-root entry files, `exports`, or package architecture just to satisfy one repo app's local
  Node execution path.
- If a repo app needs special Node behavior, solve that inside `apps/*` with app-local bundling, server build, or
  other app-specific wiring.
- When reasoning about package-consumer correctness, prefer the packed `dist` artifact and release verification over
  behavior observed through Vite aliases or source-only app resolution.
- Root-level `*.js` / `*.mjs` entry files under `packages/<name>/` that re-export `../../dist/packages/...` are
  **generated** by `scripts/sync-workspace-entrypoints.mjs` (run via `npm run build:release-packages` or
  `npm run sync:workspace-entrypoints`). Do not hand-edit them.
