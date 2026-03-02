# Quick Start

Get a working Continuum integration in under 5 minutes.

## 1. Install

```bash
npm install @continuum/react @continuum/contract
```

## 2. Define Your Component Map

Create components for each type your views will use. Each receives `value`, `onChange`, `definition`, and optional `children`.

```tsx
// components.tsx
import type { NodeValue } from '@continuum/contract';
import type { ContinuumNodeProps, ContinuumNodeMap } from '@continuum/react';

function TextInput({ value, onChange, definition }: ContinuumNodeProps) {
  const text = (value as NodeValue<string> | undefined)?.value ?? '';

  return (
    <label>
      {definition.key ?? definition.id}
      <input
        value={text}
        onChange={(e) => onChange({ value: e.target.value } as NodeValue)}
      />
    </label>
  );
}

function Toggle({ value, onChange, definition }: ContinuumNodeProps) {
  const checked = Boolean((value as NodeValue<boolean> | undefined)?.value);

  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange({ value: e.target.checked } as NodeValue)}
      />
      {definition.key ?? definition.id}
    </label>
  );
}

function Select({ value, onChange, definition }: ContinuumNodeProps) {
  const selected = (value as NodeValue<string> | undefined)?.value ?? '';

  return (
    <label>
      {definition.key ?? definition.id}
      <select
        value={selected}
        onChange={(e) => onChange({ value: e.target.value } as NodeValue)}
      >
        <option value="">-- select --</option>
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </select>
    </label>
  );
}

export const componentMap: ContinuumNodeMap = {
  input: TextInput,
  toggle: Toggle,
  select: Select,
};
```

## 3. Wrap Your App

```tsx
// App.tsx
import { ContinuumProvider } from '@continuum/react';
import { componentMap } from './components';

export default function App() {
  return (
    <ContinuumProvider componentMap={componentMap} persist="localStorage">
      <MyPage />
    </ContinuumProvider>
  );
}
```

Setting `persist="localStorage"` means the session survives page refresh automatically.

## 4. Push a Schema and Render

```tsx
// MyPage.tsx
import { useEffect } from 'react';
import {
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum/react';
import type { ViewDefinition } from '@continuum/contract';

const view: ViewDefinition = {
  viewId: 'my-form',
  version: '1.0',
  nodes: [
    { id: 'name', type: 'input', key: 'name' },
    { id: 'email', type: 'input', key: 'email' },
    { id: 'agree', type: 'toggle', key: 'agree' },
  ],
};

export function MyPage() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!session.getSnapshot()) {
      session.pushView(view);
    }
  }, [session]);

  if (!snapshot?.view) return <div>Loading...</div>;

  return <ContinuumRenderer view={snapshot.view} />;
}
```

Fill in some values, then refresh the page. Your data is still there.

## 5. Push a New View Version

When your AI agent (or any other source) produces a new view, just push it:

```typescript
session.pushView({
  viewId: 'my-form',
  version: '2.0',
  nodes: [
    { id: 'full_name', type: 'input', key: 'name' },  // renamed id, same key → state carries
    { id: 'email', type: 'input', key: 'email' },      // unchanged → state carries
    { id: 'phone', type: 'input', key: 'phone' },      // new → empty state
    { id: 'agree', type: 'toggle', key: 'agree' },     // unchanged → state carries
  ],
});
```

The user's name value carries to `full_name` because they share the key `'name'`. The email and toggle values are preserved. Phone starts empty.

## 6. Add Rewind

Every `pushView` auto-creates a checkpoint. Let users rewind to any prior version:

```tsx
import { useContinuumSession, useContinuumDiagnostics } from '@continuum/react';

function RewindControls() {
  const session = useContinuumSession();
  const { checkpoints } = useContinuumDiagnostics();

  return (
    <div>
      {checkpoints.map((cp, i) => (
        <button key={cp.id} onClick={() => session.rewind(cp.id)}>
          Rewind to v{cp.snapshot.view.version}
        </button>
      ))}
    </div>
  );
}
```

## 7. Inspect What Happened

After any `pushView`, check the reconciliation results:

```typescript
const resolutions = session.getResolutions();
// [{ nodeId: 'full_name', resolution: 'carried', matchedBy: 'key', ... }]

const diffs = session.getDiffs();
// [{ nodeId: 'phone', type: 'added' }, { nodeId: 'name', type: 'removed' }]

const issues = session.getIssues();
// [{ severity: 'warning', code: 'NODE_REMOVED', nodeId: 'name', ... }]
```

Or use the `useContinuumDiagnostics()` hook for reactive updates in your UI.

## Next Steps

- [Integration Guide](INTEGRATION_GUIDE.md) -- advanced patterns (server-sent schemas, custom migrations, protocol adapters)
- [Schema Contract Reference](SCHEMA_CONTRACT.md) -- complete field reference and reconciliation rules
- [AI Integration Guide](AI_INTEGRATION.md) -- connecting an AI agent to Continuum
- [Package READMEs](../packages/) -- full API reference for each package
