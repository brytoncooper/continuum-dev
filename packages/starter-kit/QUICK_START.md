# Starter Kit Quick Start

This is the fastest way to get Continuum rendering in React with the shipped starter components.

## 1. Install

```bash
npm install @continuum-dev/starter-kit react react-dom
```

## 2. Paste This App

```tsx
import { useEffect } from 'react';
import {
  ContinuumProvider,
  ContinuumRenderer,
  starterKitComponentMap,
  useContinuumSession,
  useContinuumSnapshot,
  type ViewDefinition,
} from '@continuum-dev/starter-kit';

const initialView: ViewDefinition = {
  viewId: 'profile',
  version: '1',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      label: 'Profile',
      children: [
        {
          id: 'name',
          type: 'field',
          dataType: 'string',
          label: 'Name',
          placeholder: 'Ada Lovelace',
        },
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          label: 'Email',
          placeholder: 'ada@example.com',
        },
      ],
    },
  ],
};

function Page() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!session.getSnapshot()) {
      session.pushView(initialView);
    }
  }, [session]);

  if (!snapshot?.view) {
    return null;
  }

  return <ContinuumRenderer view={snapshot.view} />;
}

export function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap}>
      <Page />
    </ContinuumProvider>
  );
}
```

## 3. What You Already Get

With just that setup, the starter kit already gives you:

- a default component map
- built-in field and layout primitives
- Continuum session hooks
- proposal and restore-review UI exports you can add later
- a session workbench you can add later

## 4. Starter-Friendly Node Types

The shipped map recognizes these `type` strings:

```ts
'field'
'select'
'toggle'
'date'
'textarea'
'radio-group'
'slider'
'action'
'presentation'
'group'
'row'
'grid'
'collection'
```

Two important notes:

- `field`, `group`, `row`, `grid`, `collection`, `action`, and `presentation` are the standard Continuum render types
- `select`, `toggle`, `date`, `textarea`, `radio-group`, and `slider` are starter-kit conventions that the default map understands

## 5. Two Easy Upgrades

### Add Persistence

```tsx
<ContinuumProvider
  components={starterKitComponentMap}
  persist="localStorage"
>
  <Page />
</ContinuumProvider>
```

### Add Starter Styling Overrides

```tsx
import {
  StarterKitStyleProvider,
  starterKitComponentMap,
  ContinuumProvider,
} from '@continuum-dev/starter-kit';

<StarterKitStyleProvider
  styles={{
    fieldControl: { borderRadius: 10 },
    actionButton: { background: '#0f172a' },
  }}
>
  <ContinuumProvider components={starterKitComponentMap}>
    <Page />
  </ContinuumProvider>
</StarterKitStyleProvider>;
```

## 6. Helpful Next Steps

- Add `StarterKitSessionWorkbench` when you want timeline preview, rewind, reset, and review UI.
- Replace individual entries in `starterKitComponentMap` when you want to keep most of the starter kit but own a few components yourself.
- Drop to `@continuum-dev/react` when you want a completely headless renderer surface.
