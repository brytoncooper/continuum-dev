# `@continuum-dev/ai-engine` — source layout

**Navigate by folders first.** Each `lib/<area>/index.ts` is the contract for that area. The package entry is [`../index.ts`](../index.ts) (what consumers import).

## Public vs internal

| Exported from `src/index.ts` | Area |
|------------------------------|------|
| Yes | `session`, `execution`, `execution-targets`, `continuum-execution`, `view-guardrails`, `view-patching`, `view-authoring` (line-dsl + yaml + view-json + facade) |
| No (internal engines) | `view-generation`, `view-transforms` — used by `execution` / `patching` / `transforms` paths |

## `lib/*` capabilities

| Folder | Purpose |
|--------|---------|
| `session/` | `ContinuumSessionAdapter` port for apply and streaming. |
| `execution-targets/` | `catalog/`, `parser/`, `coercion/`; `types.ts` + `shared.ts` at area root. |
| `continuum-execution/` | Prebuilt planner (`.mjs` + `.d.ts`), not a normal TS layout. |
| `execution/` | `streamContinuumExecution`, session apply/context; `session-api/`, `stream/`, `stream/phases/`, `stream/trace|preview|instruction/`. |
| `view-guardrails/` | `definition/`, `json/`, `normalize/`, `structure/`, `runtime-errors/`. |
| `view-patching/` | `truncate/`, `prompts/`, `normalize/`, `apply/`, `context/`, `detached-fields/`; `types.ts` at root. |
| `view-authoring/` | `line-dsl/`, `yaml/`, `view-json/` (structured ViewDefinition JSON); root `index.ts` picks `authoringFormat`. Shared Continuum layout, continuity, and collection rules live in `shared/continuum-view-authoring-guidance.ts` and are composed into each format’s system prompt (`view-json` appends them after `assembleSystemPrompt` + `VIEW_DEFINITION_OUTPUT_CONTRACT`). |
| `view-generation/` | Internal merge/apply pipeline: `normalize/`, `apply/`. |
| `view-transforms/` | Surgical transform planning (internal to execution flow). |

## Typical request flow

1. Host builds **context** (`buildContinuumExecutionContext` → `session`).
2. **Planner** (`continuum-execution`) chooses mode using **targets** (`execution-targets` catalogs).
3. **Execution** (`execution/stream`) runs **phases**: state, patch, transform, or full view.
4. View paths use **authoring**, **patching**, **guardrails**, **generation**, **transforms** as needed.
5. **Apply** (`applyContinuumExecutionFinalResult` → `session-api`) updates the session.

```mermaid
flowchart TB
  entry[src/index.ts]
  session[lib/session]
  targets[lib/execution-targets]
  planner[lib/continuum-execution]
  exec[lib/execution]
  guard[lib/view-guardrails]
  author[lib/view-authoring]
  patch[lib/view-patching]
  gen[lib/view-generation]
  xf[lib/view-transforms]

  entry --> session
  entry --> targets
  entry --> planner
  entry --> exec
  entry --> guard
  entry --> author
  entry --> patch
  exec --> planner
  exec --> targets
  exec --> author
  exec --> patch
  exec --> guard
  exec --> gen
  patch --> guard
  author --> guard
  exec --> xf
```

## Conventions

- **Subfolder names** = pipeline stage or artifact (`json/`, `normalize/`, `apply/`, `phases/`), not generic `support/`.
- **Cross-area imports**: prefer `../<other-area>/index.js`.
- **Depth**: one implementation level under an area unless there is a strong reason to go deeper.
