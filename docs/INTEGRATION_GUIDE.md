# Integration Guide

Advanced patterns for integrating Continuum into production applications.

---

## 1. Server-Sent Schemas

When schemas arrive from a backend via WebSocket, SSE, or polling, push them into the session on receipt.

### WebSocket Example

```typescript
import { createSession } from '@continuum/session';
import type { SchemaSnapshot } from '@continuum/contract';

const session = createSession();

const ws = new WebSocket('wss://api.example.com/agent');

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'schema_update') {
    const schema: SchemaSnapshot = message.payload;
    session.pushSchema(schema);
  }
});
```

### Server-Sent Events Example

```typescript
const source = new EventSource('/api/agent/stream');

source.addEventListener('schema', (event) => {
  const schema: SchemaSnapshot = JSON.parse(event.data);
  session.pushSchema(schema);
});
```

### With React

Inside a component wrapped by `ContinuumProvider`:

```tsx
function AgentListener({ agentUrl }: { agentUrl: string }) {
  const session = useContinuumSession();

  useEffect(() => {
    const ws = new WebSocket(agentUrl);
    ws.addEventListener('message', (event) => {
      const { schema } = JSON.parse(event.data);
      if (schema) session.pushSchema(schema);
    });
    return () => ws.close();
  }, [session, agentUrl]);

  return null;
}
```

---

## 2. Custom Migration Strategies

When a component's `hash` changes across schema versions, Continuum looks for a migration strategy to transform the old state into the new shape.

### Per-Component Override

Pass `migrationStrategies` keyed by component ID. These take priority over declarative rules.

```typescript
import { reconcile } from '@continuum/runtime';

const result = reconcile(newSchema, priorSchema, priorState, {
  migrationStrategies: {
    email: (componentId, oldDef, newDef, oldState) => {
      const old = oldState as { value: string };
      return { value: old.value.toLowerCase().trim() };
    },
  },
});
```

### Declarative Rules with Strategy Registry

Define `MigrationRule` entries on the component definition and register named strategies:

```typescript
// In your schema
const schema: SchemaSnapshot = {
  schemaId: 'form',
  version: '2.0',
  components: [
    {
      id: 'email',
      type: 'input',
      key: 'email',
      hash: 'input:v2',
      migrations: [
        { fromHash: 'input:v1', toHash: 'input:v2', strategyId: 'normalize-email' },
      ],
    },
  ],
};

// When reconciling
const result = reconcile(schema, priorSchema, priorState, {
  strategyRegistry: {
    'normalize-email': (id, oldDef, newDef, oldState) => {
      const old = oldState as { value: string };
      return { value: old.value.trim(), isDirty: false };
    },
  },
});
```

### Resolution Order

1. `migrationStrategies[componentId]` -- per-component override
2. `MigrationRule` on the definition + `strategyRegistry[rule.strategyId]`
3. Fallback: carry prior state as-is if same type
4. If all fail: state is dropped, `MIGRATION_FAILED` issue logged

### Through the Session

`createSession` currently passes `{ clock }` as options to `reconcile`. To use custom migration strategies through the session, call `reconcile` directly or extend the session options in your application layer:

```typescript
import { reconcile } from '@continuum/runtime';
import { createSession } from '@continuum/session';

const session = createSession();

function pushSchemaWithMigrations(schema: SchemaSnapshot) {
  const snapshot = session.getSnapshot();
  if (snapshot) {
    const result = reconcile(schema, snapshot.schema, snapshot.state, {
      strategyRegistry: myStrategies,
    });
    // Use result for diagnostics, then push normally
  }
  session.pushSchema(schema);
}
```

---

## 3. Building a Protocol Adapter

Transform any external schema format into Continuum's `SchemaSnapshot`.

### Step 1: Define External Types

```typescript
interface MyProtocolForm {
  formId: string;
  rev: number;
  elements: MyProtocolElement[];
}

interface MyProtocolElement {
  uid: string;
  kind: 'text' | 'checkbox' | 'picker';
  title: string;
  choices?: string[];
  nested?: MyProtocolElement[];
}
```

### Step 2: Implement the Adapter

```typescript
import type { ProtocolAdapter } from '@continuum/adapters';
import type { SchemaSnapshot, ComponentDefinition } from '@continuum/contract';

const KIND_MAP: Record<string, string> = {
  text: 'input',
  checkbox: 'toggle',
  picker: 'select',
};

function elementToComponent(el: MyProtocolElement): ComponentDefinition {
  const def: ComponentDefinition = {
    id: el.uid,
    type: KIND_MAP[el.kind] ?? 'default',
    key: el.uid,
    path: el.title,
  };

  if (el.choices) {
    def.stateShape = el.choices.map((c, i) => ({ id: String(i), label: c }));
  }

  if (el.nested) {
    def.children = el.nested.map(elementToComponent);
  }

  return def;
}

export const myAdapter: ProtocolAdapter<MyProtocolForm> = {
  name: 'my-protocol',

  toSchema(form: MyProtocolForm): SchemaSnapshot {
    return {
      schemaId: form.formId,
      version: String(form.rev),
      components: form.elements.map(elementToComponent),
    };
  },
};
```

### Step 3: Wire Into Your App

```typescript
import { myAdapter } from './my-adapter';

function handleExternalSchema(externalForm: MyProtocolForm) {
  const schema = myAdapter.toSchema(externalForm);
  session.pushSchema(schema);
}
```

---

## 4. Persistence Strategies

### localStorage (Default)

```tsx
<ContinuumProvider components={componentMap} persist="localStorage">
```

Session is serialized to `localStorage` on every snapshot change and rehydrated on mount.

### sessionStorage

```tsx
<ContinuumProvider components={componentMap} persist="sessionStorage">
```

Same behavior but scoped to the browser tab. Data is lost when the tab closes.

### Custom Storage Key

```tsx
<ContinuumProvider
  components={componentMap}
  persist="localStorage"
  storageKey="my_app_session"
>
```

### No Persistence

```tsx
<ContinuumProvider components={componentMap} persist={false}>
```

### Custom Persistence (IndexedDB, Server, etc.)

Use the session API directly without the React provider's built-in persistence:

```typescript
import { createSession, deserialize } from '@continuum/session';

async function loadSession(): Promise<Session> {
  const blob = await fetchFromServer('/api/session/latest');
  if (blob) return deserialize(blob);
  return createSession();
}

const session = await loadSession();

session.onSnapshot(() => {
  const blob = session.serialize();
  saveToServer('/api/session', blob);
});
```

Or wrap the provider with `persist={false}` and manage persistence yourself:

```tsx
function App() {
  return (
    <ContinuumProvider components={componentMap} persist={false}>
      <CustomPersistenceLayer />
      <MyPage />
    </ContinuumProvider>
  );
}

function CustomPersistenceLayer() {
  const session = useContinuumSession();

  useEffect(() => {
    return session.onSnapshot(() => {
      indexedDB.put('sessions', session.serialize(), session.sessionId);
    });
  }, [session]);

  return null;
}
```

---

## 5. Session Lifecycle

### Multi-Tab Considerations

Each tab creates its own session. If using `localStorage` persistence, the last tab to write wins. For multi-tab coordination:

- Use `sessionStorage` instead (each tab gets its own session)
- Use a `BroadcastChannel` to coordinate schema pushes across tabs
- Use a server-side session store with optimistic locking

### Cleanup

Call `destroy()` when the session is no longer needed:

```typescript
const result = session.destroy();
// result.issues contains any final reconciliation issues

// After destroy, all methods are no-ops
session.pushSchema(schema); // does nothing
```

### Handling Stale Serialized Data

`deserialize()` validates the `formatVersion` field:

- Missing `formatVersion` -- accepted (legacy support)
- `formatVersion <= 1` -- accepted
- `formatVersion > 1` -- throws an error

If the serialized data is corrupted or incompatible, `deserialize` will throw. The React provider handles this gracefully by falling back to a fresh session:

```typescript
try {
  const session = deserialize(JSON.parse(storedBlob));
} catch {
  storage.removeItem(key);
  const session = createSession();
}
```

### Session ID

Each session gets a unique `sessionId` generated at creation time. The ID persists through serialization/deserialization. Use it for server-side correlation:

```typescript
console.log(session.sessionId); // "session_1708891234567_abc123"
```
