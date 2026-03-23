# Package validation policy

This document defines how published packages under `packages/` are validated and how intentional facades fit into release expectations.

## Source of truth for publishable package directories

The list of package **folder names** that participate in `build:release-packages`, `prepare:dist-packages`, and `verify:release-packages` lives in:

- [`scripts/release-public-package-dirs.json`](../scripts/release-public-package-dirs.json)

When you add or remove a published library, update that file and keep it aligned with:

- [`nx.json`](../nx.json) → `release.groups.publicPackages.projects` (Nx project names)
- Each package’s `project.json` → `nx-release-publish.options.packageRoot` under `dist/packages/<folder>/`

CI runs the same release verification path as local publishing (see [`RELEASE.md`](../RELEASE.md)). Release verification also checks that this directory list still matches `nx.json` `release.groups.publicPackages.projects`.

## Validation by package role

| Role             | Packages                                                                        | What “good” means                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contract-like    | `contract`, `protocol`, `prompts`                                               | Types and shared constants stay stable; behavior tests where logic exists; breaking changes called out in changelog.                                                           |
| Core logic       | `runtime`, `session`, `ai-engine`                                               | Substantial unit tests on public behavior; changes go through lint, typecheck, and tests.                                                                                      |
| Facades          | `core`, `ai-core`                                                               | No business logic beyond re-exports; release smoke + consumer imports are the primary gate; treat API surface as the union of re-exported packages (high semver blast radius). |
| Integration / UI | `react`, `starter-kit`, `starter-kit-ai`, `vercel-ai-sdk-adapter`, `ai-connect` | Targeted tests for adapters and UI boundaries; peer dependencies documented; verify tarball install in release script exercises real `npm install` resolution.                 |

## Facade packages (`core`, `ai-core`)

`@continuum-dev/core` and `@continuum-dev/ai-core` are **intentional convenience facades**: they re-export multiple inner packages from a single entrypoint so apps can depend on one package for common stacks.

**Implications:**

- Any additive export from a dependency can become part of the facade’s effective public API.
- Prefer depending on leaf packages (`@continuum-dev/runtime`, `@continuum-dev/ai-engine`, etc.) when you want a smaller, clearer semver contract.
- Facades are validated by the release pipeline (tarball contents, `npm pack` checks, and ESM import smoke) plus normal monorepo lint/test/build; they do not require duplicate unit suites for re-export-only code.

This policy is descriptive for v0; tighten per-package bars as the ecosystem stabilizes.

## Adoption surface checks

When public entry guidance changes, also run the lightweight adoption checks in [ADOPTION_RELEASE_CHECKLIST.md](./ADOPTION_RELEASE_CHECKLIST.md).

Those checks keep the following reference files aligned with the docs:

- [`apps/demo/src/reference-starter-app.tsx`](../apps/demo/src/reference-starter-app.tsx)
- [`apps/demo/src/reference-headless-ai-app.tsx`](../apps/demo/src/reference-headless-ai-app.tsx)
- [`apps/demo-api/reference-headless-ai-route.mjs`](../apps/demo-api/reference-headless-ai-route.mjs)
