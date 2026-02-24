# Phase 3: Protocol Abstraction Layer

**Status:** Complete
**Depends on:** Phase 2 (architecture refactor)
**Goal:** Prove protocol-agnostic positioning with an A2UI adapter and establish the adapter pattern

---

## Scope

Build a protocol adapter layer that transforms external UI schema formats into Continuum's internal `SchemaSnapshot`. Ship A2UI (Google's Agent-to-User Interface) as the first adapter. Establish the pattern for future protocol support.

---

## 1. Adapter Architecture

```
External Protocol (A2UI, custom, future)
         ↓
    Protocol Adapter
         ↓
    SchemaSnapshot (Continuum canonical format)
         ↓
    Session → Reconciliation → Renderer
```

### Adapter Interface

```typescript
interface ProtocolAdapter<TExternalSchema, TExternalData = unknown> {
  name: string;
  toSchema(external: TExternalSchema): SchemaSnapshot;
  fromSchema?(snapshot: SchemaSnapshot): TExternalSchema;
  toState?(externalData: TExternalData): Record<string, ComponentState>;
  fromState?(state: Record<string, ComponentState>): TExternalData;
}
```

### Location

```
packages/adapters/
  src/
    adapter.ts        → ProtocolAdapter interface
    a2ui/
      types.ts        → A2UI type definitions
      adapter.ts      → A2UI → SchemaSnapshot transform
      adapter.spec.ts → Unit tests
    index.ts          → Public exports
```

New package: `@continuum/adapters`

---

## 2. A2UI Adapter

Google's A2UI protocol defines UIs as JSON with `FormField`, `TextInput`, `Dropdown`, etc.

### Mapping Table

| A2UI Type | Continuum Type | State Shape |
|---|---|---|
| `TextInput` | `input` | `{ value: string }` |
| `Dropdown` / `SelectionInput` | `select` | `{ selectedIds: string[] }` |
| `Switch` / `Toggle` | `toggle` | `{ checked: boolean }` |
| `DateInput` | `date` (new) | `{ value: string }` |
| `Section` / `Card` | `container` | children only |

### A2UI → SchemaSnapshot Transform

```typescript
function a2uiToSchema(a2uiForm: A2UIForm): SchemaSnapshot {
  return {
    schemaId: a2uiForm.id ?? generateId(),
    version: a2uiForm.version ?? '1.0',
    components: a2uiForm.fields.map(fieldToComponent),
  };
}
```

### Test Plan

- Unit tests for each A2UI field type → ComponentDefinition mapping
- Round-trip test: A2UI → Schema → render → state → back to A2UI data format
- Edge cases: nested sections, unknown field types (fallback), missing IDs

---

## 3. Expanded Component Types

Phase 3 requires adding component types to the playground's component map:

| Type | Component | Priority |
|---|---|---|
| `date` | Date input field | High |
| `textarea` | Multi-line text | High |
| `radio-group` | Radio button group | Medium |
| `slider` | Range slider | Medium |
| `section` | Visual grouping (header + children) | High |

Each gets a dark-theme-styled implementation in `component-map.tsx`.

---

## 4. Protocol Selector in Playground

Add a toggle to the playground demo that switches between "Native" and "A2UI" modes:

- **Native mode:** Current behavior, schemas defined directly
- **A2UI mode:** Schemas arrive as A2UI JSON, adapter transforms before pushSchema

This proves the adapter layer works end-to-end in a real UI.

---

## 5. Hallucination UX Enhancement

When hallucination mutates a schema, the current playground shows issues in the dev tools panel. Phase 3 should add visual feedback directly on the rendered components:

- Components with `dropped` trace get a red shake animation
- Components with `migrated` trace get a yellow pulse
- New `added` components get a green fade-in
- A toast notification summarizes what happened

---

## 6. Definition of Done

- [x] `@continuum/adapters` package created with ProtocolAdapter interface -- 9 lines
- [x] A2UI adapter transforms A2UI JSON → SchemaSnapshot correctly -- adapter.ts 130 lines
- [x] A2UI adapter has full unit test coverage -- 28 tests across 6 describe blocks
- [x] Playground has protocol selector toggle (Native / A2UI) -- segmented control in header
- [x] At least 3 new component types added to playground -- 5 added: date, textarea, radio-group, slider, section
- [x] Hallucination visual feedback on rendered components -- shake/pulse/fade-in CSS + toast
- [x] All existing tests still pass -- 82 runtime + 102 session + 28 adapters = 212 total
- [x] Documentation updated in CONTINUUM.md

---

## Timeline Estimate

3-5 focused days after Phase 2 completes.
