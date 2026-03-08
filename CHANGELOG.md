# Changelog

All notable changes to this project will be documented in this file.

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
