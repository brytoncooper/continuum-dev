# `@continuum/adapters` Deep Reference

This document explains every file and every method/function in `packages/adapters` so future engineers and AI agents can understand, maintain, and extend the library safely.

## Purpose of This Library

`@continuum/adapters` is the protocol translation layer between external UI schema formats and Continuum's core contract types from `@continuum/contract`.

Current implementation scope:

- Defines a generic adapter interface (`ProtocolAdapter`)
- Ships one production adapter: `a2uiAdapter` for Google's A2UI-style forms
- Provides value conversion helpers used by adapters (`createDefaultValueForNodeType`, `valueForType`)
- Contains behavioral tests for mapping correctness and hardening edge cases

## Package File Inventory

The package currently contains 11 files:

- `README.md`
- `package.json`
- `tsconfig.json`
- `tsconfig.lib.json`
- `vitest.config.ts`
- `src/index.ts`
- `src/lib/adapter.ts`
- `src/lib/a2ui/types.ts`
- `src/lib/a2ui/adapter.ts`
- `src/lib/a2ui/adapter.spec.ts`
- `src/lib/a2ui/adapter-hardening.spec.ts`

---

## File-by-File Reference

## `README.md`

Human-facing usage guide for consumers of `@continuum/adapters`.

What it covers:

- Package purpose and install command
- `ProtocolAdapter` interface shape
- A2UI adapter usage examples
- A2UI-to-Continuum node mapping table
- Utility export usage (`valueForType`, `resetCounter` mention)
- Custom adapter authoring example

Notes:

- README mentions `resetCounter()`, but there is no `resetCounter` export in current code. This appears to be documentation drift.
- Core mapping examples are aligned with actual implementation.

---

## `package.json`

Declares package identity and module entrypoint.

Key fields:

- `name`: `@continuum/adapters`
- `type`: `module` (ESM semantics)
- `main`/`types`/`exports["."]`: all point to `./src/index.ts`
- Dependency on `@continuum/contract` for shared view/data types
- Nx tagging: `scope:adapters`

Operational implication:

- Consumers import from root package entry and receive re-exports from `src/index.ts`.

---

## `tsconfig.json`

Thin top-level TypeScript config for this package.

Behavior:

- Extends `./tsconfig.lib.json`
- Contains no additional options beyond inherited build config

Purpose:

- Standard Nx package layout where top-level config delegates to library-specific config.

---

## `tsconfig.lib.json`

Library compile configuration.

Key settings:

- Extends repo base config: `../../tsconfig.base.json`
- `rootDir`: `src`
- `outDir`: `../../dist/packages/adapters`
- Build info cache file under `dist`
- Includes Node types
- Excludes tests (`*.spec.ts`, `*.test.ts`)
- Project reference to `packages/contract/tsconfig.lib.json`

Purpose:

- Builds production library sources only, not test files.

---

## `vitest.config.ts`

Unit test runtime configuration for this package.

Key behavior:

- `root` pinned to package directory
- Vitest cache path isolated under monorepo `node_modules/.vite/packages/adapters`
- Node test environment
- Includes tests under `src/**/*.{test,spec}.*`
- Coverage provider: V8
- Coverage output under `./test-output/vitest/coverage`

Purpose:

- Ensures package-local deterministic tests and package-local coverage artifacts.

---

## `src/index.ts`

Public API barrel for this package.

Exports:

- `./lib/adapter.js`
- `./lib/a2ui/types.js`
- `./lib/a2ui/adapter.js`

Purpose:

- Centralized import surface for consumers (`import { a2uiAdapter } from '@continuum/adapters'`).

---

## `src/lib/adapter.ts`

Defines the base protocol adapter contract used by all adapters.

### `ProtocolAdapter<TExternalSchema, TExternalData = unknown>` (interface)

Fields/methods:

- `name: string`
  - Required adapter identifier (`'a2ui'`, etc.)
- `toView(external: TExternalSchema): ViewDefinition`
  - Required conversion into Continuum view format
- `fromView?(snapshot: ViewDefinition): TExternalSchema`
  - Optional reverse conversion back to external schema format
- `toState?(externalData: TExternalData): Record<string, NodeValue<any>>`
  - Optional conversion of external data payload into Continuum node value map
- `fromState?(state: Record<string, NodeValue<any>>): TExternalData`
  - Optional reverse conversion from Continuum node value map back to external data payload

Design intent:

- Supports one-way and round-trip adapters.
- Keeps view conversion and value conversion concerns separate.

---

## `src/lib/a2ui/types.ts`

Defines input/output types for the A2UI adapter.

### `A2UIFieldType` (union type)

Supported known A2UI field kinds:

- `TextInput`
- `TextArea`
- `Dropdown`
- `SelectionInput`
- `Switch`
- `Toggle`
- `DateInput`
- `Section`
- `Card`

### `A2UIOption` (interface)

- `id: string`
- `label: string`

Used for option-bearing controls like dropdown/select.

### `A2UIField` (interface)

- `name?: string`
- `type: A2UIFieldType | string`
- `label?: string`
- `options?: A2UIOption[]`
- `fields?: A2UIField[]`

Important:

- `type` allows arbitrary strings, enabling unknown/custom field types that degrade gracefully.
- `fields` supports hierarchical group composition (`Section`, `Card`).

### `A2UIForm` (interface)

- `id?: string`
- `version?: string`
- `title?: string`
- `fields: A2UIField[]`

Important:

- `fields` is modeled as required, but runtime adapter logic still guards with array checks.

---

## `src/lib/a2ui/adapter.ts`

This file contains all conversion logic between A2UI and Continuum.

## Constants and Lookup Structures

### `TYPE_MAP: Record<string, { type: string, dataType?: string }>`

A2UI field type to Continuum node type mapping:

- `TextInput -> field` (dataType: `text`)
- `TextArea -> field` (dataType: `textarea`)
- `Dropdown -> field` (dataType: `select`)
- `SelectionInput -> field` (dataType: `select`)
- `Switch -> field` (dataType: `toggle`)
- `Toggle -> field` (dataType: `toggle`)
- `DateInput -> field` (dataType: `date`)
- `Section -> group`
- `Card -> group`

Fallback for unknown keys: `field` (default dataType).

### `GROUP_TYPES: Set<string>`

Group-recognized A2UI types:

- `Section`
- `Card`

Used to determine whether nested `fields` are converted to `children`.

## Internal Functions (Not Exported Directly)

### `convertA2UIFieldToViewNode(field, nextGeneratedId): ViewNode`

Purpose:

- Converts one `A2UIField` node into Continuum `ViewNode`.

Algorithm:

1. Normalize raw type from `field.type` (fallback to `'default'` when non-string).
2. Resolve node `id`:
   - Use `field.name` when present.
   - Otherwise generate deterministic id: ``${rawType.toLowerCase()}_${nextGeneratedId()}``.
3. Resolve Continuum `type` and optional `dataType` via `TYPE_MAP` (fallback `'field'`).
4. Initialize base `ViewNode` with `{ id, type, key: id }`.
5. If `field.label` exists, set `def.label`.
6. If `field.options` exists, set `def.props = { options: field.options }`.
7. If type is group and `field.fields` is an array, recursively map children.

Behavioral details:

- Recursion preserves nested layout structure.
- ID generation order is traversal-order deterministic within one `toView` call.
- Unknown/custom type strings preserve ID prefix and map to `type: 'field'`.

### `convertViewNodeToA2UIField(def): A2UIField`

Purpose:

- Converts one Continuum `ViewNode` back to A2UI field format.

Internal reverse mapping (using `type` and `dataType`):

- `field` (dataType: `text`) -> `TextInput`
- `field` (dataType: `textarea`) -> `TextArea`
- `field` (dataType: `select`) -> `Dropdown`
- `field` (dataType: `toggle`) -> `Switch`
- `field` (dataType: `date`) -> `DateInput`
- `field` (no dataType) -> `TextInput`
- `group` -> `Section`
- unknown type fallback -> `TextInput`

Algorithm:

1. Build `field` with:
   - `name = def.id`
   - `type = reverseMap(def.type, def.dataType) ?? 'TextInput'`
   - `label = def.label ?? def.path ?? def.key ?? def.id`
2. Resolve options in priority order:
   - `def.props.options` if array
   - else `def.stateShape` if array
3. Recursively map `def.children` to `field.fields` when present/non-empty.

Behavioral details:

- Label fallback ensures round-trip still emits readable label.
- Select options can be reconstructed from either props or view metadata.
- Unknown node types lose original type identity and normalize to `TextInput`.

### `createDefaultValueForNodeType(type): NodeValue<any>`

Purpose:

- Returns empty/default `NodeValue` shape for a given Continuum node type.

Returns:

- `group -> { value: undefined }`
- any other type (field) -> `{ value: '' }`

Usage:

- Exported for utility use and alias-exported as `valueForType`.

## Exported Adapter Object

### `a2uiAdapter` (`ProtocolAdapter<A2UIForm, Record<string, unknown>>`)

Declared name:

- `name: 'a2ui'`

Implements four adapter methods:

### `toView(form: A2UIForm): ViewDefinition`

Purpose:

- Convert full A2UI form to Continuum view.

Algorithm:

1. Initialize local `generatedId` counter at 0.
2. Build `nextGeneratedId()` closure that increments counter.
3. Normalize fields with `Array.isArray(form.fields) ? form.fields : []`.
4. Return:
   - `viewId: form.id ?? 'a2ui-form'`
   - `version: form.version ?? '1.0'`
   - `nodes`: mapped via recursive field converter

Behavior contracts:

- Auto-generated IDs reset per invocation, so repeated calls for same input produce same IDs.
- Missing/non-array fields produce empty node list.
- Supports deep nested sections/cards.

### `fromView(snapshot: ViewDefinition): A2UIForm`

Purpose:

- Convert Continuum view back into A2UI form model.

Return structure:

- `id = snapshot.viewId`
- `version = snapshot.version`
- `fields = snapshot.nodes.map(convertViewNodeToA2UIField)`

Behavior contracts:

- Preserves nested node tree via recursive child mapping.
- Converts select options from view props/data metadata when present.

### `toState(externalData: Record<string, unknown>): Record<string, NodeValue<any>>`

Purpose:

- Convert loose external payload into typed Continuum `NodeValue` records.

Per-key conversion rules:

- boolean -> `{ value: boolean }`
- array -> `{ value: string[] }` (stringifies each item)
- everything else -> `{ value: string }` (`null`/`undefined` become empty string)

Behavior contracts:

- Mixed-type objects are supported in one pass.
- Numeric and other primitive values normalize to string-valued node values.

### `fromState(state: Record<string, NodeValue<any>>): Record<string, unknown>`

Purpose:

- Convert Continuum node values back to plain external values.

Per-key extraction:

- Extracts the `value` field from each `NodeValue<T>` entry.
- If value is `null`/`undefined`, passthrough as-is.

Behavior contracts:

- Unknown value shapes are preserved instead of dropped.
- Supports round-trip after `toState` for supported value shapes.

## Named Exports at End of File

- `createDefaultValueForNodeType`
- `valueForType` (alias of `createDefaultValueForNodeType`)

---

## `src/lib/a2ui/adapter.spec.ts`

Main behavioral test suite for A2UI adapter.

Coverage themes:

- `toView` type mapping for each major A2UI field type
- Nested group conversion (`Section`, `Card`)
- Unknown field type fallback (`field`)
- Deterministic generated IDs for unnamed fields
- Form-level defaulting for missing `id`/`version`
- Multi-field mixed forms and deep nesting
- `fromView` round-trip and options mapping
- `toState` and `fromState` shape conversions
- End-to-end lifecycle round-trip assertion:
  - A2UI form -> Continuum view -> Continuum node values -> external payload + back-to-form

What this establishes:

- Conversion semantics in `adapter.ts` are intentionally contract-tested, not incidental.

---

## `src/lib/a2ui/adapter-hardening.spec.ts`

Defensive test suite for edge-case resilience and regressions.

Checks include:

- Adapter name stability (`'a2ui'`)
- `toView` handling when `fields` is runtime-invalid
- Non-string field type behavior during generated ID/type fallback
- `fromState` null handling
- `toState` string normalization for mixed arrays
- Explicit default value for `group`
- Unknown view node type fallback on reverse mapping

What this establishes:

- Library is expected to remain robust under malformed or partial input, not only ideal input.

---

## Method Catalog (Quick Lookup)

All methods/functions defined in this package, with where they live:

- `toView` (`ProtocolAdapter` interface) - `src/lib/adapter.ts`
- `fromView` (`ProtocolAdapter` interface, optional) - `src/lib/adapter.ts`
- `toState` (`ProtocolAdapter` interface, optional) - `src/lib/adapter.ts`
- `fromState` (`ProtocolAdapter` interface, optional) - `src/lib/adapter.ts`
- `convertA2UIFieldToViewNode` - `src/lib/a2ui/adapter.ts`
- `convertViewNodeToA2UIField` - `src/lib/a2ui/adapter.ts`
- `createDefaultValueForNodeType` - `src/lib/a2ui/adapter.ts`
- `a2uiAdapter.toView` - `src/lib/a2ui/adapter.ts`
- `a2uiAdapter.fromView` - `src/lib/a2ui/adapter.ts`
- `a2uiAdapter.toState` - `src/lib/a2ui/adapter.ts`
- `a2uiAdapter.fromState` - `src/lib/a2ui/adapter.ts`
- `valueForType` (alias export) - `src/lib/a2ui/adapter.ts`

---

## Data Flow Summary

Primary view flow:

1. External A2UI JSON (`A2UIForm`)
2. `a2uiAdapter.toView`
3. Continuum `ViewDefinition`

Primary value flow:

1. External data map (`Record<string, unknown>`)
2. `a2uiAdapter.toState`
3. Continuum per-node value records
4. `a2uiAdapter.fromState`
5. External data map

Round-trip caveats:

- Unknown Continuum node types do not preserve original type on reverse mapping (`TextInput` fallback).
- Unknown A2UI types map to Continuum `field`.

---

## Maintenance Notes

If extending this package:

- Add or change field mappings in both forward and reverse maps.
- Add tests for both happy-path and hardening edge cases.
- Preserve deterministic unnamed ID behavior unless intentionally changing compatibility.
- Keep `src/index.ts` exports aligned with intended public surface.
- Keep README aligned with actual exports to avoid API drift.
