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

For repository layout, a maintainer-oriented reading order, anchor files for core logic, and how `.cursor/` rules, agents, and skills fit together, see [AI_ONBOARDING.md](AI_ONBOARDING.md) at the repository root.

## Repository boundary

Cloud and deployment code for Continuum belongs in the separate **continuum-cloud** Git repository only. Do not commit Cloudflare workers, cloud-only apps, or cross-repo path wiring into **continuum-dev**; downstream cloud repos should consume `@continuum-dev/*` from a registry (for example local Verdaccio), not from checked-in copies of this tree.

**OSS versus proprietary:** This repo is the **open-source** SDK. Proprietary execution planning and full product demos live in **continuum-cloud**. See the workspace root **`AGENTS.md`** and **`.cursor/rules/continuum-dev-oss-and-cloud-proprietary.mdc`** (multi-repo **`.cursor/`**).

# CooperContinuum Agent Context

## What We Are Building

CooperContinuum exists to make generated, agent-authored, and view-driven UI apps stable for real users.

The core product problem is not "render the next screen." The hard problem is preserving user intent as views
change over time. A server can send a new layout, an AI can regenerate a workflow, or a team can refactor view
structure, and the application should still behave like one coherent system instead of wiping, corrupting, or
hiding user state.

Agents working in this repo should optimize for that end-user outcome. Every package, refactor, adapter, helper,
and facade should move the system toward a future where downstream teams can adopt these packages, understand how
they fit together, and build applications without fighting hidden complexity.

## Product Goals

- Make generated UI apps stable under change.
- Preserve user intent when views, forms, and workflows evolve.
- Keep the system protocol-agnostic and flexible at the edges.
- Provide an opinionated center of gravity around `contract`, `runtime`, and `session`.
- Offer higher-level packages that make adoption faster without blurring architectural responsibility.
- Keep the package system easy for future users to reason about as one coherent toolkit.

## What Good Looks Like

Agents should treat these outcomes as the definition of success:

- A new user can understand which package lane they need without reading the whole monorepo.
- The stable, reusable logic lives in the most appropriate inner package instead of being duplicated across facades.
- Framework and vendor details stay at the outside of the system.
- Convenience packages accelerate adoption but do not become a dumping ground for core business rules.
- Public package surfaces stay intentional, coherent, and easier to use over time.
- If the repo starts feeling too convoluted to explain clearly, that is a design problem to surface, not something
  to paper over with more layers.

## Source Of Truth

Many docs in this repo may lag behind the current implementation. Agents should not assume prose docs are
authoritative.

When deciding how the system works today, prefer this order:

1. User intent stated in the current task or planning conversation.
2. `package.json`, `project.json`, package exports, and package entrypoints such as `src/index.ts`.
3. Nx tags and `@nx/enforce-module-boundaries` rules in `eslint.config.mjs`.
4. Architecture rules in `.cursor/rules/`.
5. Human-facing docs only when they still match the code.

## Package System

Think about this repo as a layered product, not as a flat collection of libraries.

### Stable center of gravity

These packages define the product's core model and continuity behavior:

| Package | Role |
| --- | --- |
| `@continuum-dev/contract` | Declarative view and data contracts. |
| `@continuum-dev/protocol` | Shared operational protocols for runtime, session, and streaming behavior. |
| `@continuum-dev/runtime` | Stateless reconciliation engine for carrying intent across view changes. |
| `@continuum-dev/session` | Stateful session lifecycle, persistence, checkpoints, rewind, and streaming coordination. |

These packages are the most important place to keep concepts clear. If behavior belongs to the durable continuity
model, it should usually live here or be shaped here first.

### Convenience core

| Package | Role |
| --- | --- |
| `@continuum-dev/core` | Convenience facade over `contract`, `runtime`, and `session`. |

`core` exists to improve ergonomics, not to replace the responsibility boundaries of the underlying packages.

### UI and fast-start adoption

| Package | Role |
| --- | --- |
| `@continuum-dev/react` | Headless React bindings over the Continuum model. |
| `@continuum-dev/starter-kit` | Opinionated React starter layer with primitives, component map, styles, and session tooling. |

These packages should help users get productive quickly while staying honest about where the real business rules
live.

### AI and generation stack

| Package | Role |
| --- | --- |
| `@continuum-dev/prompts` | Prompt-building primitives for higher-level AI packages. |
| `@continuum-dev/ai-engine` | Headless AI planning, authoring, normalization, guardrails, patching, and execution helpers. |
| `@continuum-dev/ai-connect` | Headless provider connection and model integration helpers. |
| `@continuum-dev/vercel-ai-sdk-adapter` | Adapter layer for Vercel AI SDK transport and stream integration. |
| `@continuum-dev/ai-core` | Headless facade that composes React, session, engine, and transport primitives. |
| `@continuum-dev/starter-kit-ai` | Optional starter-oriented AI facade over `starter-kit` and the AI stack. |

The AI packages should stay protocol-agnostic where possible and vendor-specific only where necessary. Keep the
headless engine reusable. Keep provider and transport details at the edges.

### Internal, experimental, or composition surfaces

| Package | Role |
| --- | --- |
| `@continuum-dev/adapters` | Internal protocol adapters. |
| `@continuum-dev/angular` | Internal Angular bindings. |
| Full product demo (SPA + Worker) | Lives in **continuum-cloud** (`continuum-demo`, `continuum-demo-api`); uses private `@continuum-cloud/ai-execution` for premium planning. |

These surfaces are useful, but they are not the center of the public product story.

## How Agents Should Place Work

When adding or changing behavior, choose the most stable layer that can honestly own it.

- Put durable continuity logic in `contract`, `protocol`, `runtime`, or `session`.
- Put ergonomic re-exports and consumer-friendly composition in `core`.
- Put framework-specific UI bindings in `react` or `angular`, not inner packages.
- Put starter defaults, presets, and adoption helpers in `starter-kit` or `starter-kit-ai`.
- Put AI planning, view authoring, patching, normalization, and guardrails in `ai-engine`.
- Put provider, catalog, or connection concerns in `ai-connect`.
- Put vendor transport concerns in an adapter package such as `vercel-ai-sdk-adapter`.
- Use demo apps to validate composition and developer experience, not to host reusable core logic.

If a proposed change could live in multiple places, prefer the location that:

- keeps public concepts simpler for downstream users,
- avoids duplicating policy across packages,
- preserves the inner-to-outer dependency direction,
- and makes future package adoption easier to explain.

## Complexity Check

Agents should continuously evaluate whether the package system is becoming harder to reason about.

Stop and raise a restructuring or planning discussion when you notice any of these:

- the same concept exists in multiple packages with slightly different meanings,
- a facade starts owning policy that should live deeper in the stack,
- a package cannot be explained without a long chain of caveats,
- a new feature requires callers to remember fragile sequencing or hidden orchestration,
- or a change makes the public package story more confusing for future adopters.

The goal is not to preserve every current shape forever. The goal is to keep moving toward a coherent, teachable,
easy-to-adopt system.

## Architectural Boundaries

These rules are mandatory unless the user explicitly wants a design change.

- Dependencies point inward toward more stable policy.
- Before adding a cross-package import, check the source and target `nx.tags` and confirm the edge is allowed by
  `eslint.config.mjs`.
- `packages/contract`, `packages/runtime`, and `packages/session` must stay free of React, Angular, routers, and
  vendor SDK entrypoints.
- If inner code needs the outside world, define or use an inner-friendly port and let an outer package implement it.
- Data crossing inward should be shaped for the inner package, using contract-friendly DTOs and value objects rather
  than framework or vendor types.
- Composition roots such as `starter-kit`, `starter-kit-ai`, and `apps/*` may wire concrete details together, but
  they should not quietly absorb core business rules.

## Public Surface Discipline

Agents should treat package exports as the contract consumers depend on.

- Check `package.json` `exports` and `src/index.ts` before adding or moving API surface.
- Avoid casually exporting internal implementation modules because that increases long-term support burden.
- For packages with explicit internal engines, keep that distinction intact. For example, `ai-engine` exposes
  session, execution, targets, guardrails, patching, and authoring through its public entrypoints, while some
  lower-level generation and transform internals remain non-public.
- If an exported symbol becomes part of the public package surface, it needs to be coherent, intentional, and
  documented appropriately.

## Repo Apps Versus Library Consumers

Agents must keep a hard boundary between repo apps and published library consumers.

- `apps/starter` is a repo app. It is allowed to consume workspace package source during local
  development and integration testing.
- The former `apps/demo` site now lives in **continuum-cloud**; it is not the canonical proof of npm-consumer behavior for `@continuum-dev/*`.
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

## Working Defaults

- Prefer `nx` tasks over invoking underlying tools directly.
- Use Nx workspace and project tooling when repository structure matters.
- Read the package you are changing before editing it: its manifest, public entrypoint, nearby tests, and any
  package-local architecture notes.
- Treat stale docs as helpful context, not as binding truth.
- Prefer improving existing package seams over introducing new overlapping abstractions.
- Favor plans and discussion when a change affects package boundaries, public API shape, or the mental model that
  future users will need to learn.

## Decision Filter

Before shipping a change, agents should be able to answer "yes" to most of these questions:

- Does this move CooperContinuum closer to a coherent system for stable generated UI apps?
- Will this make life better for the eventual downstream team using these packages together?
- Is this behavior living in the right package, not merely a convenient one?
- Does this preserve the protocol-agnostic and flexible posture of the overall system?
- Is the resulting package story easier to explain, or at least not harder?

If the answer is "no," slow down and propose a better shape.
