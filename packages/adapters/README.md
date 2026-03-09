# @continuum-dev/adapters

Website: [continuumstack.dev](https://continuumstack.dev)
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

## Core Premise: The Ephemerality Gap

The Ephemerality Gap is the mismatch between ephemeral, regenerating interfaces and durable user intent.
Continuum keeps UI structure and user state separate, then uses deterministic reconciliation so user intent survives schema changes.

> ⚠️ Internal preview package.
>
> This package is not published for public use yet, APIs are unstable, and there are no compatibility guarantees. Do not use in production.

Protocol adapter layer for the Continuum SDK.

Transforms external UI schema formats into Continuum's `ViewDefinition` and `NodeValue` shapes. Ships with a built-in adapter for Google's A2UI (Agent-to-User Interface) protocol.

## Availability

`@continuum-dev/adapters` is currently under active development and intentionally marked private in this repository.

## ProtocolAdapter Interface

```typescript
interface ProtocolAdapter<TExternalView, TExternalData = unknown> {
  name: string;
  toView(external: TExternalView): ViewDefinition;
  fromView?(snapshot: ViewDefinition): TExternalView;
  toState?(externalData: TExternalData): Record<string, NodeValue>;
  fromState?(state: Record<string, NodeValue>): TExternalData;
}
```

| Method | Required | Description |
|---|---|---|
| `name` | yes | Identifier for this adapter (for example, `a2ui`) |
| `toView` | yes | Convert external view format into a `ViewDefinition` |
| `fromView` | no | Convert a `ViewDefinition` back to external format |
| `toState` | no | Convert external data payload into Continuum `NodeValue` map |
| `fromState` | no | Convert Continuum state map back to external data format |

## Built-in: A2UI Adapter

`a2uiAdapter` transforms Google A2UI JSON into Continuum nodes.

```typescript
import { a2uiAdapter } from '@continuum-dev/adapters';

const view = a2uiAdapter.toView({
  id: 'my-form',
  version: '1.0',
  fields: [
    { name: 'email', type: 'TextInput', label: 'Email' },
    { name: 'agree', type: 'Switch', label: 'I Agree' },
  ],
});

// Use with a session
session.pushView(view);
```

### Type Mapping

| A2UI Type | Continuum Node Type | `dataType` |
|---|---|---|
| `TextInput` | `field` | `string` |
| `TextArea` | `field` | `string` |
| `Dropdown` | `field` | `string` |
| `SelectionInput` | `field` | `string` |
| `Switch` | `field` | `boolean` |
| `Toggle` | `field` | `boolean` |
| `DateInput` | `field` | `string` |
| `Section` | `group` | n/a |
| `Card` | `group` | n/a |
| unknown | `field` | `string` |

### A2UI Types

```typescript
interface A2UIForm {
  id?: string;
  version?: string;
  title?: string;
  fields: A2UIField[];
}

interface A2UIField {
  name?: string;
  type: A2UIFieldType | string;
  label?: string;
  options?: A2UIOption[];
  fields?: A2UIField[];
}

interface A2UIOption {
  id: string;
  label: string;
}

type A2UIFieldType =
  | 'TextInput'
  | 'TextArea'
  | 'Dropdown'
  | 'SelectionInput'
  | 'Switch'
  | 'Toggle'
  | 'DateInput'
  | 'Section'
  | 'Card';
```

### Round-trip

```typescript
const form: A2UIForm = { fields: [{ name: 'email', type: 'TextInput' }] };

const view = a2uiAdapter.toView(form);
const backToForm = a2uiAdapter.fromView(view);

const state = a2uiAdapter.toState({ email: 'alice@example.com', agree: true });
const backToData = a2uiAdapter.fromState(state);
```

## Utility Exports

### `createDefaultNodeValue(dataType)`

Returns a default `NodeValue` value for the provided data type.

```typescript
createDefaultNodeValue('boolean'); // { value: false }
createDefaultNodeValue('number'); // { value: 0 }
createDefaultNodeValue('string'); // { value: '' }
createDefaultNodeValue('any-unknown'); // { value: '' }
```

### `valueForDataType`

Alias for `createDefaultNodeValue`.

```typescript
const defaultValue = valueForDataType('number');
```

## Writing a Custom Adapter

```typescript
import type { ProtocolAdapter } from '@continuum-dev/adapters';
import type { ViewDefinition, NodeValue } from '@continuum-dev/contract';

interface MyFormat {
  widgets: { uid: string; kind: string }[];
}

export const myAdapter: ProtocolAdapter<MyFormat> = {
  name: 'my-protocol',

  toView(external: MyFormat): ViewDefinition {
    return {
      viewId: 'my-app',
      version: '1.0',
      nodes: external.widgets.map((w) => ({
        id: w.uid,
        type: 'field',
        key: w.uid,
        dataType: 'string',
      })),
    };
  },
};
```

## Links

- [Root README](../../README.md)
- [Integration Guide: Building a Protocol Adapter](../../docs/INTEGRATION_GUIDE.md)
