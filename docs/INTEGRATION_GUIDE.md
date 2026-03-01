# Integration Guide

Advanced patterns for integrating Continuum into production applications.

---

## 1. Server-Sent Views

When view definitions arrive from a backend via WebSocket, SSE, or polling, push them into the session on receipt.

### WebSocket Example

```typescript
import { createSession } from '@continuum/session';
import type { ViewDefinition } from '@continuum/contract';

const session = createSession();

const ws = new WebSocket('wss://api.example.com/agent');

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'view_update') {
    const view: ViewDefinition = message.payload;
    session.pushView(view);
  }
});
```

### Server-Sent Events Example

```typescript
const source = new EventSource('/api/agent/stream');

source.addEventListener('view', (event) => {
  const view: ViewDefinition = JSON.parse(event.data);
  session.pushView(view);
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
      const { view } = JSON.parse(event.data);
      if (view) session.pushView(view);
    });
    return () => ws.close();
  }, [session, agentUrl]);

  return null;
}
```

### With Angular

Inside a component in an app configured with `provideContinuum()`:

```typescript
import { Component, OnInit, inject, input, DestroyRef } from '@angular/core';
import { injectContinuumSession } from '@continuum/angular';

@Component({ selector: 'app-agent-listener', standalone: true, template: '' })
export class AgentListenerComponent implements OnInit {
  agentUrl = input.required<string>();
  private session = injectContinuumSession();
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    const ws = new WebSocket(this.agentUrl());
    ws.addEventListener('message', (event) => {
      const { view } = JSON.parse(event.data);
      if (view) this.session.pushView(view);
    });
    this.destroyRef.onDestroy(() => ws.close());
  }
}
```

---

## 2. Custom Migration Strategies

When a node's `hash` changes across view versions, Continuum looks for a migration strategy to transform the old state into the new shape.

### Per-Node Override

Pass `migrationStrategies` keyed by node ID. These take priority over declarative rules.

```typescript
import { reconcile } from '@continuum/runtime';

const result = reconcile(newView, priorView, priorData, {
  migrationStrategies: {
    email: (nodeId, oldDef, newDef, oldState) => {
      const old = oldState as { value: string };
      return { value: old.value.toLowerCase().trim() };
    },
  },
});
```

### Declarative Rules with Strategy Registry

Define `MigrationRule` entries on the node definition and register named strategies:

```typescript
const view: ViewDefinition = {
  viewId: 'form',
  version: '2.0',
  nodes: [
    {
      id: 'email',
      type: 'field',
      dataType: 'string',
      key: 'email',
      hash: 'field:v2',
      migrations: [
        { fromHash: 'field:v1', toHash: 'field:v2', strategyId: 'normalize-email' },
      ],
    },
  ],
};

const result = reconcile(view, priorView, priorData, {
  strategyRegistry: {
    'normalize-email': (id, oldDef, newDef, oldState) => {
      const old = oldState as { value: string };
      return { value: old.value.trim(), isDirty: false };
    },
  },
});
```

### Resolution Order

1. `migrationStrategies[nodeId]` -- per-node override
2. `MigrationRule` on the definition + `strategyRegistry[rule.strategyId]`
3. Fallback: carry prior state as-is if same type
4. If all fail: state is detached, `MIGRATION_FAILED` issue logged

### Through the Session

`createSession` supports reconciliation options directly via `SessionOptions.reconciliation`, so migration behavior can be configured while continuing to use `session.pushView`:

```typescript
import { createSession } from '@continuum/session';

const session = createSession({
  reconciliation: {
    strategyRegistry: myStrategies,
    migrationStrategies: {
      email: (nodeId, oldDef, newDef, oldState) => {
        const old = oldState as { value?: string };
        return { value: (old.value ?? '').trim().toLowerCase() };
      },
    },
  },
});

session.pushView(viewFromAgent);
```

---

## 3. Building a Protocol Adapter

Transform any external format into Continuum's `ViewDefinition`.

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
import type { ViewDefinition, ViewNode, FieldNode, GroupNode } from '@continuum/contract';

const DATA_TYPE_MAP: Record<string, 'string' | 'boolean'> = {
  text: 'string',
  checkbox: 'boolean',
  picker: 'string',
};

function elementToNode(el: MyProtocolElement): ViewNode {
  if (el.nested) {
    const group: GroupNode = {
      id: el.uid,
      type: 'group',
      key: el.uid,
      label: el.title,
      children: el.nested.map(elementToNode),
    };
    return group;
  }

  const node: FieldNode = {
    id: el.uid,
    type: 'field',
    key: el.uid,
    dataType: DATA_TYPE_MAP[el.kind] ?? 'string',
    label: el.title,
  };

  return node;
}

export const myAdapter: ProtocolAdapter<MyProtocolForm> = {
  name: 'my-protocol',

  toView(form: MyProtocolForm): ViewDefinition {
    return {
      viewId: form.formId,
      version: String(form.rev),
      nodes: form.elements.map(elementToNode),
    };
  },
};
```

### Step 3: Wire Into Your App

```typescript
import { myAdapter } from './my-adapter';

function handleExternalView(externalForm: MyProtocolForm) {
  const view = myAdapter.toView(externalForm);
  session.pushView(view);
}
```

---

## 4. Persistence Strategies

### localStorage (Default)

```tsx
<ContinuumProvider components={nodeMap} persist="localStorage">
```

Session is serialized to `localStorage` on every snapshot change and rehydrated on mount.

### sessionStorage

```tsx
<ContinuumProvider components={nodeMap} persist="sessionStorage">
```

Same behavior but scoped to the browser tab. Data is lost when the tab closes.

### Custom Storage Key

```tsx
<ContinuumProvider
  components={nodeMap}
  persist="localStorage"
  storageKey="my_app_session"
>
```

### No Persistence

```tsx
<ContinuumProvider components={nodeMap} persist={false}>
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
    <ContinuumProvider components={nodeMap} persist={false}>
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
- Use a `BroadcastChannel` to coordinate view pushes across tabs
- Use a server-side session store with optimistic locking

### Cleanup

Call `destroy()` when the session is no longer needed:

```typescript
const result = session.destroy();

session.pushView(view); // does nothing after destroy
```

### Handling Stale Serialized Data

`deserialize()` validates the `formatVersion` field:

- Only `formatVersion: 1` is accepted
- Missing `formatVersion` or any other value throws an error

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
