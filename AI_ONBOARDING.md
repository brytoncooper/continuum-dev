# AI and contributor onboarding

This file is a **navigation map** for learning the CooperContinuum monorepo as a codebase. It does not replace product philosophy, SDK reference, or integration guides elsewhere.

## How this relates to other docs

- **[README.md](README.md)** — What Continuum is for end users and integrators, consumer-oriented reading paths, quick start samples, and the high-level architecture block.
- **[AGENTS.md](AGENTS.md)** — Default agent context: product goals, package lanes, where behavior should live, architectural boundaries, and **source-of-truth order** when docs disagree with code.
- **[CONTINUUM.md](CONTINUUM.md)** — SDK-shaped reference (types, integration patterns) for implementing against published APIs.
- **This file** — Where things live in the tree, a **maintainer reading order**, anchor files, how `.cursor/` is organized, and paths that are usually noise.

**Source of truth:** When prose and implementation disagree, follow the order in [AGENTS.md](AGENTS.md) (manifests, exports, ESLint boundaries, rules, then human docs).

## Annotated repository map

```text
apps/
  demo/          Composition root: playground, landing, Vercel AI SDK demos, reference UIs
  demo-api/      API and transport playground for streams and providers
  starter/       Slim starter app (consumer-facing template)

packages/
  contract/      View and data contract types (inner, stable)
  protocol/      Shared operational and wire-oriented contracts
  prompts/       Prompt-building primitives for AI packages
  runtime/       Stateless reconciliation engine (merge boundary)
  session/       Stateful session, persistence, checkpoints, streaming coordination
  core/          Facade over contract + runtime + session
  react/         Headless React bindings
  angular/       Angular bindings (internal)
  starter-kit/   Preset React layer and component map
  starter-kit-ai/ Optional thin AI wrappers over starter-kit
  ai-engine/     Headless AI planning, authoring, guardrails, execution helpers
  ai-connect/    Provider and model catalog helpers
  ai-core/       Facade over headless AI + React/session primitives
  vercel-ai-sdk-adapter/  Vercel AI SDK transport bridge
  adapters/      Internal protocol adapters

docs/            Integration guides, view contract notes, upgrade and migration docs
.cursor/
  rules/         Workspace rules (.mdc): architecture, clean code, public API docs
  agents/        Specialized review persona prompts (markdown)
  skills/        Repeatable workflows (SKILL.md), e.g. TDD habits, staged commits

eslint.config.mjs   @nx/enforce-module-boundaries → depConstraints (allowed import edges)
nx.json, project manifests   Nx tasks and per-project tags
RELEASE.md, CHANGELOG.md   Release and versioning process
```

## Reading order: learn the codebase (maintainers)

Use this when the goal is **how the repo is built**, not “ship my first integration” (for that, use [README.md](README.md) “Recommended reading path”).

1. **[AGENTS.md](AGENTS.md)** — Package system, placement rules, boundaries, source-of-truth order.
2. **[eslint.config.mjs](eslint.config.mjs)** — `depConstraints`: which `scope:*` tags may depend on which; this is the enforced graph.
3. **[.cursor/rules/clean-architecture-layer-mapping.mdc](.cursor/rules/clean-architecture-layer-mapping.mdc)** — Ring and tag names aligned with ESLint (conceptual map).
4. **[packages/contract/src/index.ts](packages/contract/src/index.ts)** — Public exports for the durable model (`ViewDefinition`, snapshots, etc.).
5. **[docs/VIEW_CONTRACT.md](docs/VIEW_CONTRACT.md)** — View and node shapes at the contract level (verify against code if anything looks stale).
6. **[packages/runtime/src/index.ts](packages/runtime/src/index.ts)** → **[packages/runtime/src/lib/reconcile/index.ts](packages/runtime/src/lib/reconcile/index.ts)** — Supported `reconcile` entrypoint and docstring contract.
7. **[packages/runtime/src/lib/reconcile/reconcile-core.ts](packages/runtime/src/lib/reconcile/reconcile-core.ts)** — Core transition orchestration (then follow imports into `reconciliation/*` as needed).
8. **[packages/runtime/src/lib/public-surface.spec.ts](packages/runtime/src/lib/public-surface.spec.ts)** — What the runtime package exposes to consumers.
9. **[packages/runtime/src/lib/reconcile/core.spec.ts](packages/runtime/src/lib/reconcile/core.spec.ts)** — Representative reconciliation behavior tests.
10. **[packages/session/src/index.ts](packages/session/src/index.ts)** → **[packages/session/src/lib/session.ts](packages/session/src/lib/session.ts)** — Session orchestration entry; internal layout is described in [packages/session/src/lib/session/README.md](packages/session/src/lib/session/README.md).
11. **Composition root** — Either [apps/demo/src/main.tsx](apps/demo/src/main.tsx) + [apps/demo/src/App.tsx](apps/demo/src/App.tsx) or [packages/starter-kit/src/index.ts](packages/starter-kit/src/index.ts), depending on whether you prefer a full app or the preset package surface.

Deep references you can branch to when needed: [packages/runtime/README.md](packages/runtime/README.md), [packages/session/README.md](packages/session/README.md), [CONTINUUM.md](CONTINUUM.md).

## Anchor files

| Path | What you learn |
| --- | --- |
| [eslint.config.mjs](eslint.config.mjs) | Enforced dependency rules between libraries (`depConstraints`). |
| [packages/contract/src/index.ts](packages/contract/src/index.ts) | Contract public surface re-exports. |
| [packages/runtime/src/lib/reconcile/reconcile-core.ts](packages/runtime/src/lib/reconcile/reconcile-core.ts) | Heart of view transition reconciliation. |
| [packages/runtime/src/lib/public-surface.spec.ts](packages/runtime/src/lib/public-surface.spec.ts) | Exported API expectations for `@continuum-dev/runtime`. |
| [packages/session/src/lib/session.ts](packages/session/src/lib/session.ts) | Session lifecycle orchestration. |
| [packages/react/src/index.ts](packages/react/src/index.ts) | Headless React public exports. |
| [packages/core/src/index.ts](packages/core/src/index.ts) | Convenience facade wiring contract + runtime + session. |

## Walkthrough: change reconciliation behavior in `runtime`

1. **Confirm the edge** — `runtime` must not import outer frameworks or vendors. Check [eslint.config.mjs](eslint.config.mjs) for which packages `runtime` may depend on (tags).
2. **Locate behavior** — Start at [packages/runtime/src/lib/reconcile/reconcile-core.ts](packages/runtime/src/lib/reconcile/reconcile-core.ts) and follow into `reconciliation/*` or `reconcile/*` submodules as needed.
3. **Tests** — Add or extend specs under [packages/runtime/src/lib/reconcile/](packages/runtime/src/lib/reconcile/) (or the specific submodule you touch). Prefer proving behavior through the public `reconcile` API or stable internal seams already covered by tests.
4. **Public API** — If you add or change an **exported** symbol, update [packages/runtime/src/index.ts](packages/runtime/src/index.ts) (and package `exports` in `package.json` if required), add TSDoc per [.cursor/rules/public-api-docs.mdc](.cursor/rules/public-api-docs.mdc), and extend [packages/runtime/src/lib/public-surface.spec.ts](packages/runtime/src/lib/public-surface.spec.ts) if the public surface changes.
5. **Downstream** — Search consumers in `session`, `core`, `react`, and apps; run targeted Nx tests for affected projects.

## `.cursor/` workspace model

- **Rules** — [`.cursor/rules/*.mdc`](.cursor/rules) are editor/workspace constraints. Some are always applied; others apply when relevant. They encode architecture, naming, tests, TypeScript exhaustiveness, and public API documentation policy. They are not executed like a build step; they guide agents and humans in this repo.
- **Agents** — [`.cursor/agents/*.md`](.cursor/agents) are **specialized review prompts** (for example boundary audits, API shape review). They do not auto-run on every change unless your tooling or you explicitly invoke that review. Use them when you want a focused pass on a concern they describe.
- **Skills** — [`.cursor/skills/*/SKILL.md`](.cursor/skills) describe **repeatable workflows** (for example investigation habits or staged commits). They apply when a task matches the skill’s description.

**Summary:** Rules constrain; skills teach procedures; agent markdown files describe optional review personas—not a hidden scheduler.

## Low-signal paths (usually skip for reconnaissance)

- `.nx/cache/` — Nx task outputs and artifacts
- `node_modules/`
- Per-package `dist/` or generated `.js` siblings if present next to sources in your checkout
- Large generated or cached bundles under `.nx/` unless you are debugging the build itself

## Review or research prompt template

Paste and fill in when asking an agent to review or explore without relying on diffs alone:

```text
Goal: (e.g. learn reconciliation, review public API of session)
Non-goals: (e.g. do not compare to main; ignore release scripts)
Scope: (branch name or “current workspace”)
Start here: (2–5 paths from this doc or your feature)
Focus: (e.g. boundaries, naming, tests, docs)
Ignore for now: (e.g. demo-only UI polish, .nx/cache)
Questions: (specific decisions you want answered)
```
