# @continuum-dev/angular

Website: [continuumstack.dev](https://continuumstack.dev)
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

## Core Premise: The Ephemerality Gap

The Ephemerality Gap is the mismatch between ephemeral, regenerating interfaces and durable user intent.
Continuum keeps UI structure and user state separate, then uses deterministic reconciliation so user intent survives schema changes.

> ⚠️ Internal preview package.
>
> This package is not published for public use yet, APIs are unstable, and there are no compatibility guarantees. Do not use in production.

Angular bindings for the Continuum SDK.

Provides environment providers, signal-based inject APIs, a view-driven standalone renderer, and Reactive Forms / Signal Forms adapters. Handles persistence to localStorage/sessionStorage automatically.

## Availability

`@continuum-dev/angular` is currently under active development and intentionally marked private in this repository.

## Quick Start

```typescript
import { ApplicationConfig } from '@angular/core';
import type { ViewDefinition } from '@continuum-dev/contract';
import { provideContinuum } from '@continuum-dev/angular';
import { ContinuumRendererComponent } from '@continuum-dev/angular';

const componentMap = {
  input: MyInputComponent,
  select: MySelectComponent,
  toggle: MyToggleComponent,
  default: MyFallbackComponent,
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideContinuum({
      components: componentMap,
      persist: 'localStorage',
    }),
  ],
};
```

```html
<!-- In your component template -->
@if (snapshot(); as snap) {
  <continuum-renderer [view]="snap.view" />
}
```

```typescript
// In your component
snapshot = injectContinuumSnapshot();
session = injectContinuumSession();
agentView: ViewDefinition = { viewId: 'view-1', version: '1', nodes: [] };

ngOnInit() {
  this.session.pushView(this.agentView);
}
```

## API

### `provideContinuum(options)`

Configures Continuum in the application injector.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `components` | `ContinuumNodeMap` | required | Map of component type strings to Angular components |
| `persist` | `'sessionStorage' \| 'localStorage' \| false` | `false` | Where to persist session data |
| `storageKey` | `string` | `'continuum_session'` | Key used in storage |
| `maxPersistBytes` | `number` | — | Optional max serialized payload size in bytes before writes are skipped |
| `onPersistError` | `(error: ContinuumPersistError) => void` | — | Called for skipped writes (`size_limit`) and storage failures (`storage_error`) |
| `sessionOptions` | `SessionOptions` | — | Optional session configuration |

When `maxPersistBytes` is set and a snapshot exceeds the limit, persistence is skipped for that snapshot and `onPersistError` is called. If no callback is provided, a warning is logged.

### Injection APIs

All inject functions must be called from an injection context (e.g. constructor, `inject()` initialization). They throw if used outside a `provideContinuum()` provider tree.

| Function | Returns | Description |
|----------|---------|-------------|
| `injectContinuumSession()` | `Session` | The Continuum session |
| `injectContinuumSnapshot()` | `Signal<ContinuitySnapshot \| null>` | Reactive snapshot signal |
| `injectContinuumState(nodeId)` | `[Signal<...>, (value) => void]` | State signal and setter for a node |
| `injectContinuumDiagnostics()` | `Signal<{issues, diffs, resolutions, checkpoints}>` | Reconciliation diagnostics |
| `injectContinuumHydrated()` | `boolean` | Whether the session was rehydrated from storage |

### Components

| Component | Description |
|-----------|-------------|
| `<continuum-renderer>` | Renders a view. Input: `view: ViewDefinition` |
| `<continuum-fallback>` | Built-in fallback for unknown component types |
| `<continuum-children-renderer>` | Renders child definitions. Use in container components. Input: `definitions: ViewNode[]` |

### Forms

**Reactive Forms:** `bindContinuumReactiveForm(bindings, options?)` syncs `FormControl` instances with session state.

**Signal Forms:** `bindContinuumSignalForm<T>(nodeId)` returns `{ value: Signal<T>, update: (v) => void }` for signal-first binding.

## Component Map Pattern

Components in the map receive `ContinuumNodeProps`:

```typescript
interface ContinuumNodeProps<T = NodeValue> {
  value: T | undefined;
  onChange: (value: T) => void;
  definition: ViewNode;
  children?: unknown;
}
```

For containers that render children, use `<continuum-children-renderer [definitions]="definition.children" />` in your template.

## Links

- [Root README](../../README.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)
