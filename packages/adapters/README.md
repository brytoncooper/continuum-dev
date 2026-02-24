# @continuum/adapters

Protocol adapter layer for the Continuum SDK.

Transforms external UI schema formats into Continuum's `SchemaSnapshot`. Ships with a built-in adapter for Google's A2UI (Agent-to-User Interface) protocol.

## Installation

```bash
npm install @continuum/adapters
```

## ProtocolAdapter Interface

```typescript
interface ProtocolAdapter<TExternalSchema, TExternalData = unknown> {
  name: string;
  toSchema(external: TExternalSchema): SchemaSnapshot;
  fromSchema?(snapshot: SchemaSnapshot): TExternalSchema;
  toState?(externalData: TExternalData): Record<string, ComponentState>;
  fromState?(state: Record<string, ComponentState>): TExternalData;
}
```

| Method | Required | Description |
|---|---|---|
| `name` | yes | Identifier for this adapter (e.g. `'a2ui'`) |
| `toSchema` | yes | Convert external schema format to `SchemaSnapshot` |
| `fromSchema` | no | Convert `SchemaSnapshot` back to external format |
| `toState` | no | Convert external data to Continuum `ComponentState` records |
| `fromState` | no | Convert Continuum state back to external data format |

## Built-in: A2UI Adapter

The `a2uiAdapter` transforms Google A2UI JSON into Continuum schemas.

```typescript
import { a2uiAdapter } from '@continuum/adapters';

const schema = a2uiAdapter.toSchema({
  id: 'my-form',
  version: '1.0',
  fields: [
    { name: 'email', type: 'TextInput', label: 'Email' },
    { name: 'agree', type: 'Switch', label: 'I Agree' },
  ],
});

// Use with a session
session.pushSchema(schema);
```

### Type Mapping

| A2UI Type | Continuum Type | State Shape |
|---|---|---|
| `TextInput` | `input` | `{ value: string }` |
| `TextArea` | `textarea` | `{ value: string }` |
| `Dropdown` | `select` | `{ selectedIds: string[] }` |
| `SelectionInput` | `select` | `{ selectedIds: string[] }` |
| `Switch` | `toggle` | `{ checked: boolean }` |
| `Toggle` | `toggle` | `{ checked: boolean }` |
| `DateInput` | `date` | `{ value: string }` |
| `Section` | `container` | children only |
| `Card` | `container` | children only |
| _(unknown)_ | `default` | `{ value: string }` |

### A2UI Types

```typescript
interface A2UIForm {
  id?: string;
  version?: string;
  title?: string;
  fields: A2UIField[];
}

interface A2UIField {
  name?: string;                    // becomes the component id (auto-generated if missing)
  type: A2UIFieldType | string;    // one of the supported A2UI types
  label?: string;                  // stored as ComponentDefinition.path
  options?: A2UIOption[];          // for dropdowns/selection inputs
  fields?: A2UIField[];           // nested fields (for Section/Card)
}

interface A2UIOption {
  id: string;
  label: string;
}

type A2UIFieldType =
  | 'TextInput' | 'TextArea' | 'Dropdown' | 'SelectionInput'
  | 'Switch' | 'Toggle' | 'DateInput' | 'Section' | 'Card';
```

### Round-trip

```typescript
const form: A2UIForm = { fields: [{ name: 'email', type: 'TextInput' }] };

const schema = a2uiAdapter.toSchema(form);
const backToForm = a2uiAdapter.fromSchema(schema);

const state = a2uiAdapter.toState({ email: 'alice@example.com', agree: true });
const backToData = a2uiAdapter.fromState(state);
```

## Utility Exports

### `stateForType(type)`

Returns a default empty `ComponentState` for a given Continuum component type.

```typescript
stateForType('toggle')  // { checked: false }
stateForType('select')  // { selectedIds: [] }
stateForType('input')   // { value: '' }
```

### `resetCounter()`

Resets the internal auto-ID counter used when A2UI fields lack a `name`. Primarily for testing.

## Writing a Custom Adapter

```typescript
import type { ProtocolAdapter } from '@continuum/adapters';
import type { SchemaSnapshot, ComponentState } from '@continuum/contract';

interface MyFormat {
  widgets: { uid: string; kind: string }[];
}

export const myAdapter: ProtocolAdapter<MyFormat> = {
  name: 'my-protocol',

  toSchema(external: MyFormat): SchemaSnapshot {
    return {
      schemaId: 'my-app',
      version: '1.0',
      components: external.widgets.map((w) => ({
        id: w.uid,
        type: w.kind,
        key: w.uid,
      })),
    };
  },
};
```

## Links

- [Root README](../../README.md)
- [Integration Guide: Building a Protocol Adapter](../../docs/INTEGRATION_GUIDE.md)
