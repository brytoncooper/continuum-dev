# AI and contributor onboarding

This file is a navigation map for learning the `continuum-dev` monorepo as a codebase. It does not replace product philosophy, SDK reference, or integration guides elsewhere.

## How this relates to other docs

- [README.md](README.md): end-user and integrator story, adoption paths, and package overview
- [AGENTS.md](AGENTS.md): package placement rules, public-surface discipline, and repo boundary guidance
- Private documentation repository: maintainer-only deep reference and migration material
- This file: codebase map, exploration order, anchor files, and low-signal paths to ignore

Source of truth: when prose and implementation disagree, follow the order in [AGENTS.md](AGENTS.md).

## Full repository map

```text
continuum-cloud/ (sibling repo)
  apps/continuum-demo, apps/continuum-demo-api
  apps/continuum-marketing-app
  Full demos and marketing surfaces; private execution planning stays there.

packages/
  contract/                  declarative view and data contracts
  protocol/                  shared operational and wire contracts
  prompts/                   prompt-building primitives
  runtime/                   stateless reconciliation engine
  session/                   stateful continuity timeline, persistence, rewind, streaming
  core/                      convenience facade over contract + runtime + session
  react/                     headless React bindings
  angular/                   internal Angular bindings
  starter-kit/               preset React layer, primitives, styles, session tooling
  starter-kit-ai/            optional AI UI wrappers over starter-kit
  ai-engine/                 headless reference AI execution and apply helpers
  ai-connect/                provider and model integration helpers
  ai-core/                   facade over React + session + AI stack
  vercel-ai-sdk-adapter/     Vercel AI SDK bridge
  adapters/                  internal protocol adapters
  developer-documentation/   bundled docs used by external consumers such as the marketing site

docs/                        public integration guides and references
.cursor/                     workspace rules, review personas, repeatable skills
scripts/                     release and workspace tooling
eslint.config.mjs            enforced dependency boundaries
nx.json                      Nx plugins and release-group configuration
package.json                 root workspaces and release scripts
RELEASE.md                   release verification and publishing notes
```

## Package catalog

Use this table when you need to land in the right folder and know what to open first. Always confirm `package.json -> exports` for subpath entrypoints.

| Folder | npm name | Role | First open |
| --- | --- | --- | --- |
| `packages/contract` | `@continuum-dev/contract` | Declarative view and data model contracts | [packages/contract/src/index.ts](packages/contract/src/index.ts) |
| `packages/protocol` | `@continuum-dev/protocol` | Shared operational protocols for runtime, session, and streaming | [packages/protocol/src/index.ts](packages/protocol/src/index.ts) |
| `packages/prompts` | `@continuum-dev/prompts` | Prompt templates and helpers for AI view generation | [packages/prompts/src/index.ts](packages/prompts/src/index.ts) |
| `packages/runtime` | `@continuum-dev/runtime` | Deterministic reconciliation engine | [packages/runtime/src/index.ts](packages/runtime/src/index.ts) |
| `packages/session` | `@continuum-dev/session` | Session lifecycle, persistence, checkpoints, rewind, streaming coordination | [packages/session/src/index.ts](packages/session/src/index.ts) |
| `packages/core` | `@continuum-dev/core` | Convenience facade over contract, runtime, and session | [packages/core/src/index.ts](packages/core/src/index.ts) |
| `packages/react` | `@continuum-dev/react` | Headless React bindings | [packages/react/src/index.ts](packages/react/src/index.ts) |
| `packages/angular` | `@continuum-dev/angular` | Internal Angular bindings | [packages/angular/src/index.ts](packages/angular/src/index.ts) |
| `packages/starter-kit` | `@continuum-dev/starter-kit` | Preset React layer, primitives, styles, and session tooling | [packages/starter-kit/src/index.ts](packages/starter-kit/src/index.ts) |
| `packages/starter-kit-ai` | `@continuum-dev/starter-kit-ai` | Optional AI UI wrappers over starter-kit | [packages/starter-kit-ai/src/index.ts](packages/starter-kit-ai/src/index.ts) |
| `packages/ai-engine` | `@continuum-dev/ai-engine` | Headless reference AI execution, authoring, normalization, and apply helpers | [packages/ai-engine/src/index.ts](packages/ai-engine/src/index.ts) |
| `packages/ai-connect` | `@continuum-dev/ai-connect` | Provider and model connection helpers | [packages/ai-connect/src/index.ts](packages/ai-connect/src/index.ts) |
| `packages/ai-core` | `@continuum-dev/ai-core` | Facade over the core AI stack | [packages/ai-core/src/index.ts](packages/ai-core/src/index.ts) |
| `packages/vercel-ai-sdk-adapter` | `@continuum-dev/vercel-ai-sdk-adapter` | Vercel AI SDK transport and streamed-part bridge | [packages/vercel-ai-sdk-adapter/src/index.ts](packages/vercel-ai-sdk-adapter/src/index.ts) |
| `packages/adapters` | `@continuum-dev/adapters` | Internal protocol adapters | [packages/adapters/src/index.ts](packages/adapters/src/index.ts) |
| `packages/developer-documentation` | `@continuum-dev/developer-documentation` | Bundled docs corpus for external consumers | [packages/developer-documentation/src/index.ts](packages/developer-documentation/src/index.ts) |

## Repo apps versus published consumers

`continuum-dev` currently has no tracked repo app surface. Full demos now live in `continuum-cloud`.

When reasoning about consumer correctness:

- treat `dist/packages/*` after `build:release-packages`, `prepare:dist-packages`, and `verify:release-packages` as the canonical consumer contract
- do not change package exports or package-root wiring to satisfy one local composition surface
- use `continuum-cloud` demos to study end-to-end behavior, not to redefine SDK boundaries

## Root tooling and release pipeline

| Path | Role |
| --- | --- |
| [scripts/build-release-packages.mjs](scripts/build-release-packages.mjs) | Builds publishable artifacts |
| [scripts/prepare-dist-packages.mjs](scripts/prepare-dist-packages.mjs) | Prepares `dist` layout for packing |
| [scripts/verify-release-packages.mjs](scripts/verify-release-packages.mjs) | Consumer-style checks on packed output |
| [scripts/sync-workspace-entrypoints.mjs](scripts/sync-workspace-entrypoints.mjs) | Generates package-root JS re-exports into `dist` |
| [packages/developer-documentation/scripts/generate-corpus.mjs](packages/developer-documentation/scripts/generate-corpus.mjs) | Regenerates the bundled docs corpus used by external consumers |

## Dependency layers

```mermaid
flowchart TB
  T0["Tier 0: contract, protocol, prompts"]
  T1["Tier 1: runtime, session"]
  T2["Tier 2: core"]
  T3["Tier 3: react, angular, starter-kit"]
  T4["Tier 4: ai-engine, ai-connect, vercel-ai-sdk-adapter"]
  T5["Tier 5: ai-core, starter-kit-ai"]
  T6["Tier 6: downstream apps and demos"]
  T0 --> T1 --> T2 --> T3 --> T4 --> T5 --> T6
```

Treat this as a reading order and stability heuristic, not a literal import graph. The enforced graph is in [eslint.config.mjs](eslint.config.mjs).

## Exploration paths by goal

| Goal | Start | Then |
| --- | --- | --- |
| View and snapshot model | [packages/contract/src/index.ts](packages/contract/src/index.ts) | [docs/VIEW_CONTRACT.md](docs/VIEW_CONTRACT.md), then usages in `runtime` and `session` |
| Reconciliation | [packages/runtime/src/index.ts](packages/runtime/src/index.ts) | [packages/runtime/src/lib/reconcile/reconcile-core.ts](packages/runtime/src/lib/reconcile/reconcile-core.ts), then specs under `packages/runtime/src/lib/reconcile/` |
| Session lifecycle | [packages/session/src/index.ts](packages/session/src/index.ts) | [packages/session/src/lib/session.ts](packages/session/src/lib/session.ts) and [packages/session/src/lib/session/README.md](packages/session/src/lib/session/README.md) |
| React integration | [packages/react/src/index.ts](packages/react/src/index.ts) | `lib/hooks`, `lib/context`, `lib/renderer` |
| Starter surfaces | [packages/starter-kit/src/index.ts](packages/starter-kit/src/index.ts) | [packages/starter-kit-ai/src/index.ts](packages/starter-kit-ai/src/index.ts) and `continuum-cloud` demos |
| AI authoring and execution | [packages/ai-engine/src/index.ts](packages/ai-engine/src/index.ts) | `lib/view-authoring`, `lib/execution`, `lib/continuum-execution`, `lib/view-patching` |
| Providers and models | [packages/ai-connect/src/index.ts](packages/ai-connect/src/index.ts) | `lib/clients`, `lib/registry`, `lib/model-catalog` |
| Vercel AI SDK bridge | [packages/vercel-ai-sdk-adapter/src/index.ts](packages/vercel-ai-sdk-adapter/src/index.ts) | `lib/message-application`, `lib/session-adapter`, `lib/data-parts` |
| Docs bundle | [packages/developer-documentation/src/index.ts](packages/developer-documentation/src/index.ts) | [packages/developer-documentation/scripts/generate-corpus.mjs](packages/developer-documentation/scripts/generate-corpus.mjs) |

## Maintainer reading order

1. [AGENTS.md](AGENTS.md)
2. [eslint.config.mjs](eslint.config.mjs)
3. [.cursor/rules/clean-architecture-layer-mapping.mdc](.cursor/rules/clean-architecture-layer-mapping.mdc)
4. [packages/contract/src/index.ts](packages/contract/src/index.ts)
5. [docs/VIEW_CONTRACT.md](docs/VIEW_CONTRACT.md)
6. [packages/runtime/src/index.ts](packages/runtime/src/index.ts)
7. [packages/runtime/src/lib/reconcile/reconcile-core.ts](packages/runtime/src/lib/reconcile/reconcile-core.ts)
8. [packages/runtime/src/lib/public-surface.spec.ts](packages/runtime/src/lib/public-surface.spec.ts)
9. [packages/session/src/index.ts](packages/session/src/index.ts)
10. [packages/session/src/lib/session.ts](packages/session/src/lib/session.ts)
11. [packages/starter-kit/src/index.ts](packages/starter-kit/src/index.ts) and [packages/starter-kit-ai/src/index.ts](packages/starter-kit-ai/src/index.ts)
12. `continuum-cloud` demo apps when you need end-to-end product behavior

## Anchor files

| Path | What you learn |
| --- | --- |
| [eslint.config.mjs](eslint.config.mjs) | Enforced dependency rules between libraries |
| [nx.json](nx.json) | Nx plugin setup and public release-group membership |
| [packages/contract/src/index.ts](packages/contract/src/index.ts) | Contract public surface |
| [packages/protocol/src/index.ts](packages/protocol/src/index.ts) | Operational protocol barrels |
| [packages/runtime/src/lib/reconcile/reconcile-core.ts](packages/runtime/src/lib/reconcile/reconcile-core.ts) | Heart of structural reconciliation |
| [packages/runtime/src/lib/public-surface.spec.ts](packages/runtime/src/lib/public-surface.spec.ts) | Exported API expectations for `@continuum-dev/runtime` |
| [packages/session/src/lib/session.ts](packages/session/src/lib/session.ts) | Session lifecycle orchestration |
| [packages/react/src/index.ts](packages/react/src/index.ts) | Headless React public exports |
| [packages/core/src/index.ts](packages/core/src/index.ts) | Convenience facade wiring |
| [packages/ai-engine/src/index.ts](packages/ai-engine/src/index.ts) | AI engine barrels |
| [packages/vercel-ai-sdk-adapter/src/index.ts](packages/vercel-ai-sdk-adapter/src/index.ts) | Vercel AI SDK bridge surface |
| [packages/developer-documentation/scripts/generate-corpus.mjs](packages/developer-documentation/scripts/generate-corpus.mjs) | How bundled docs are selected and ordered |

## Low-signal paths

- `.nx/cache/`
- `node_modules/`
- generated `dist/` artifacts when source files already answer the question
- workspace entrypoint stubs under `packages/<name>/*.js` or `*.mjs` that just re-export from `dist`
