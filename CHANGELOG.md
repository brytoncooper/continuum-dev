# Changelog

All notable changes to this project will be documented in this file.

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
