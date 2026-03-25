# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Breaking

- `@continuum-dev/ai-engine` **`runContinuumExecution` / `streamContinuumExecution`** (OSS) **default to full view generation** and no longer infer execution mode (patch / state / transform) from instruction text. Use **`executionMode`** or **`executionPlan`** for non-view phases (precedence: plan > mode > default view). Prompts stay **internal** and fixed per mode on the public execution surface.
- `@continuum-dev/ai-engine` **`runContinuumExecution` / `streamContinuumExecution`** no longer use the removed **reference heuristic planner** for mode selection. Automatic planner-led routing remains in private **`@continuum-cloud/ai-execution`** (inject via **`streamContinuumExecution`** on **`@continuum-dev/vercel-ai-sdk-adapter`** or your host).
- **`@continuum-dev/ai-engine` root exports** no longer re-export LLM planner functions (`buildContinuumExecutionPlannerSystemPrompt`, `resolveContinuumExecutionPlan`, etc.). The **`@continuum-dev/ai-engine/continuum-execution`** subpath now exposes **shared primitives** (for example `normalizeContinuumSemanticIdentity`, `parseJson`) for custom planners—not the premium planner prompts.
- **`apps/demo`** and **`apps/demo-api`** were **removed** from this monorepo; they now live under **continuum-cloud** as **`continuum-demo`** and **`continuum-demo-api`**.

### Added

- **`executionMode`** and **`executionPlan`** on **`@continuum-dev/vercel-ai-sdk-adapter`** `continuum` request options and server stream helpers so OSS callers can route execution explicitly.
- `@continuum-dev/ai-engine/execution-stream` subpath exporting phase runners and stream environment construction for advanced composition.
- Optional **`streamContinuumExecution`** injection on **`@continuum-dev/vercel-ai-sdk-adapter`** server helpers and route factory for wiring premium execution.
- Exported **`ContinuumExecutionMode`**, **`ContinuumExecutionPlan`**, and **`ContinuumResolvedExecutionPlan`** types from `@continuum-dev/ai-engine` root.
- Session streaming lifecycle APIs:
  - `beginStream`, `applyStreamPart`, `commitStream`, `abortStream`
  - `getStreams`, `onStreams`
  - `getCommittedSnapshot`
- React streaming consumption APIs:
  - `useContinuumCommittedSnapshot`
  - `useContinuumStreams`
  - `useContinuumStreaming`
  - renderer node props `isStreaming`, `buildState`, `streamStatus`
- Runtime state operation exports and patch helpers:
  - `state-ops` surface on runtime root export
  - `view-patch` helpers on runtime root export
  - `@continuum-dev/runtime/validator` subpath
- New `@continuum-dev/vercel-ai-sdk-adapter` package for the Continuum adapter layer on top of Vercel AI SDK streams.
- Starter-kit AI/chat additions:
  - `StarterKitVercelAiSdkChatBox`
  - `StarterKitChatBox`

### Changed

- Runtime reconciliation docs now prefer object-form `reconcile({ newView, priorView, priorData, options })`.
- Session snapshot model now distinguishes render snapshot from durable committed snapshot.
- Stream-aware integrations now route partial AI updates through session stream lifecycle semantics.

### Deprecated

- Positional `reconcile(newView, priorView, priorData, options)` usage is deprecated in favor of object-form input.

### Upgrade Notes

- Runtime migration callbacks changed from positional arguments to context object shape.
- Any durability-sensitive `getSnapshot()` or `useContinuumSnapshot()` usage should be audited and moved to committed snapshot APIs where needed.

### Docs

- Added upgrade and API delta notes (now maintained in the private Continuum documentation repository).
- Added [packages/session/STREAMING.md](packages/session/STREAMING.md)

## 0.3.0 - 2026-03-09

### Added

- **AI View Generation System**: Complete AI integration for generating and evolving views
  - View parsing with guardrails, line-DSL, and YAML formats
  - View authoring facade supporting multiple formats
  - Patch context and view patch plan for evolve-view mode
  - View generation engine orchestrating full vs patch generation
- **Multi-Provider Support**: OpenAI, Anthropic, and Google clients with structured JSON output
  - Provider policy system for patch mode decisions
  - Thin provider wrappers over ai-connect
  - Provider composer for unified provider management
- **Session Integration**: Enhanced session management for AI workflows
  - Session adapter for AI session integration
  - Session workbench model with checkpoint preview
  - Session workbench UI component
  - Provider chat controller and chat box UI
- **Data Snapshot Enhancements**:
  - `isSticky` flag for protecting user-edited values from AI overwrites
  - Refined DataSnapshot types in contract
- **Runtime Reconciliation Improvements**:
  - Collection path remapping when template structure changes
  - Enhanced isSticky handling in reconciliation
  - Improved default value handling and protected values
- **Session View Pusher**:
  - `pushView` with reconciliation, suggestion stripping, and detached-value GC
  - Auto-checkpoint and detached-value garbage collection
- **React Integration**:
  - isSticky support in hooks and renderer
- **Demo App**:
  - AI live page and worker integration

### Changed

- Package versions aligned to `0.3.0` across the monorepo
- Starter-kit refactored to modular AI components
- Provider chat box and composer simplified and modularized
- Documentation updated for AI integration workflows

## 0.2.0 - 2026-03-08

### Added

- New headless provider connector package: `@continuum-dev/ai-connect`.
- Starter-kit AI primitives for faster prototyping:
  - `StarterKitProviderChatBox`
  - `StarterKitSessionWorkbench`
  - `StarterKitProviderComposer`
- Provider-specific model catalog support in `ai-connect`.
- Session checkpoint preview/rewind UX wiring in starter-kit workbench flows.

### Changed

- Starter-kit docs updated for current primitives, style slots, and AI setup.
- Root docs updated to reflect current package layout and demo app workflow.
- AI-connect docs updated to prioritize OpenAI + Google paths and frame Anthropic as optional.
- Package versions aligned to `0.2.0` across the monorepo.

### Fixed

- Workspace version drift between package manifests that could break clean installs and CI lockfile checks.
