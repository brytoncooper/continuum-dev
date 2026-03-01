# @continuum/angular

Angular bindings for the Continuum SDK.

Provides environment providers, signal-based inject APIs, a schema-driven standalone renderer, and Reactive Forms / Signal Forms adapters. Handles persistence to localStorage/sessionStorage automatically.

## Installation

```bash
npm install @continuum/angular @continuum/contract
```

Peer dependencies: `@angular/core`, `@angular/common`, `@angular/forms` >= 20.

## Quick Start

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideContinuum } from '@continuum/angular';
import { ContinuumRendererComponent } from '@continuum/angular';

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
  <continuum-renderer [schema]="snap.schema" />
}
```

```typescript
// In your component
snapshot = injectContinuumSnapshot();
session = injectContinuumSession();

ngOnInit() {
  this.session.pushSchema(schemaFromAgent);
}
```

## API

### `provideContinuum(options)`

Configures Continuum in the application injector.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `components` | `ContinuumComponentMap` | required | Map of component type strings to Angular components |
| `persist` | `'sessionStorage' \| 'localStorage' \| false` | `false` | Where to persist session data |
| `storageKey` | `string` | `'continuum_session'` | Key used in storage |
| `sessionOptions` | `SessionOptions` | — | Optional session configuration |

### Injection APIs

All inject functions must be called from an injection context (e.g. constructor, `inject()` initialization). They throw if used outside a `provideContinuum()` provider tree.

| Function | Returns | Description |
|----------|---------|-------------|
| `injectContinuumSession()` | `Session` | The Continuum session |
| `injectContinuumSnapshot()` | `Signal<ContinuitySnapshot \| null>` | Reactive snapshot signal |
| `injectContinuumState(componentId)` | `[Signal<...>, (value) => void]` | State signal and setter for a component |
| `injectContinuumDiagnostics()` | `Signal<{issues, diffs, trace, checkpoints}>` | Reconciliation diagnostics |
| `injectContinuumHydrated()` | `boolean` | Whether the session was rehydrated from storage |

### Components

| Component | Description |
|-----------|-------------|
| `<continuum-renderer>` | Renders a schema. Input: `schema: SchemaSnapshot` |
| `<continuum-fallback>` | Built-in fallback for unknown component types |
| `<continuum-children-renderer>` | Renders child definitions. Use in container components. Input: `definitions: ComponentDefinition[]` |

### Forms

**Reactive Forms:** `bindContinuumReactiveForm(bindings, options?)` syncs `FormControl` instances with session state.

**Signal Forms:** `bindContinuumSignalForm<T>(componentId, options?)` returns `{ value: Signal<T>, update: (v) => void }` for signal-first binding.

## Component Map Pattern

Components in the map receive `ContinuumComponentProps`:

```typescript
interface ContinuumComponentProps<T = ComponentState> {
  value: T | undefined;
  onChange: (value: T) => void;
  definition: ComponentDefinition;
  children?: unknown;
}
```

For containers that render children, use `<continuum-children-renderer [definitions]="definition.children" />` in your template.

## Links

- [Root README](../../README.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)
