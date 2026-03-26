# @continuum-dev/starter-kit

```bash
npm install @continuum-dev/starter-kit react react-dom
```

## Why It Exists

Continuum is intentionally headless.

That is powerful, but it also means a new React user otherwise has to assemble:

- a component map
- baseline field and layout components
- proposal and restore-review UI
- starter styling
- some session inspection tooling

`@continuum-dev/starter-kit` exists to make the fastest honest React path feel small.

It gives you a ready-to-use starter surface on top of `@continuum-dev/react` so you can render real Continuum views immediately, then customize only the parts you actually want to own.

## How It Works

- it reuses `ContinuumProvider` and `ContinuumRenderer` from `@continuum-dev/react`
- `starterKitComponentMap` maps common node `type` strings to shipped starter primitives
- those primitives read common view metadata like labels, descriptions, placeholders, options, and layout hints
- `StarterKitStyleProvider` lets you override stable style slots without rewriting the primitives
- proposal, suggestion, and restore-review UI all read from the same Continuum session state
- `StarterKitSessionWorkbench` layers timeline preview, rewind, reset, and review UI on top of the live session

### Normal Starter Kit Order

1. mount `ContinuumProvider` with `starterKitComponentMap`
2. hydrate or push the first view
3. render the active snapshot through `ContinuumRenderer`
4. optionally wrap the subtree in `StarterKitStyleProvider`
5. optionally add proposal UI or `StarterKitSessionWorkbench`
6. override individual map entries only where your app needs custom rendering

## What It Is

`@continuum-dev/starter-kit` is an opinionated React starter layer over `@continuum-dev/react` and `@continuum-dev/core`.

Import everything from the package root:

```ts
import {
  ContinuumProvider,
  ContinuumRenderer,
  starterKitComponentMap,
  useContinuumSession,
  useContinuumSnapshot,
  type ViewDefinition,
} from '@continuum-dev/starter-kit';
```

The public root export includes:

- all of `@continuum-dev/core`
- `ContinuumProvider` and `ContinuumRenderer`
- the common starter re-exported hooks
- `starterKitComponentMap`
- starter primitives
- proposal and restore-review components
- tokens and style helpers
- `StarterKitSessionWorkbench` and `useStarterKitTimeline`

There are no public subpath imports.

For lower-level React-only APIs like the advanced render contexts or the raw streaming hooks, import from `@continuum-dev/react` directly.

## Simplest Way To Use It

Most apps only need one path:

1. use `starterKitComponentMap`
2. mount `ContinuumProvider`
3. push the first `ViewDefinition` if nothing was hydrated
4. render `snapshot.view`

### Minimal Flow

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
          id: 'email',
          type: 'field',
          dataType: 'string',
          label: 'Email',
          placeholder: 'you@example.com',
        },
      ],
    },
  ],
};

function Screen() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!session.getSnapshot()) {
      // First mount: seed the session with the initial Continuum view.
      session.pushView(initialView);
    }
  }, [session]);

  if (!snapshot?.view) {
    // Nothing renders until the session has an active snapshot.
    return null;
  }

  // The starter map handles the actual field and layout primitives.
  return <ContinuumRenderer view={snapshot.view} />;
}

export function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap}>
      <Screen />
    </ContinuumProvider>
  );
}
```

### What Is Required

- React 18 or newer
- `react-dom` 18 or newer
- a `ContinuumProvider`
- `starterKitComponentMap` or your own map that starts from it
- an initial `ViewDefinition`

## Other Options

### Quick Start Guide

For the shortest copy-paste setup path, see [QUICK_START.md](./QUICK_START.md).

### Override The Default Map

You do not need to choose between "all starter kit" and "no starter kit".

You can start from the shipped map and replace only the entries you want:

```ts
const components = {
  ...starterKitComponentMap,
  field: MyField,
  action: MyActionButton,
};
```

### Starter Node Vocabulary

The default map includes these keys:

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
'default'
```

Important detail:

- `field`, `group`, `row`, `grid`, `collection`, `action`, and `presentation` line up with the standard Continuum render tree
- `select`, `toggle`, `date`, `textarea`, `radio-group`, and `slider` are starter-kit renderer conventions layered on top of Continuum

That means the starter kit can render those type strings out of the box, but they are not additional node variants defined by `@continuum-dev/contract` itself.

### Styling

Use `StarterKitStyleProvider` when you want to keep the shipped primitives but change their surface styling.

```tsx
import {
  StarterKitStyleProvider,
  starterKitComponentMap,
  ContinuumProvider,
} from '@continuum-dev/starter-kit';

export function App() {
  return (
    <StarterKitStyleProvider
      styles={{
        fieldControl: { borderRadius: 10 },
        actionButton: { background: '#0f172a' },
      }}
    >
      <ContinuumProvider components={starterKitComponentMap}>
        <Screen />
      </ContinuumProvider>
    </StarterKitStyleProvider>
  );
}
```

### Proposal And Restore UI

The package also exports ready-to-use UI helpers for:

- field-level proposals
- suggestion bars
- restore badges
- restore-review cards
- conflict banners

Use these when you want starter-kit UI around Continuum proposals and detached-value restoration instead of building that UI from scratch.

### Session Workbench And Timeline

`StarterKitSessionWorkbench` is the starter-kit debugging and review surface for:

- reset
- timeline preview
- rewind
- proposal review
- restore review

`useStarterKitTimeline()` gives you the same timeline model without the shipped panel UI.

One important reset detail:

- the workbench reset clears and reapplies the Continuum session state
- it does not clear unrelated client state outside Continuum, such as a separate chat transcript store

### Lower-Level Escape Hatches

Use the lower layers directly when you need them:

- `@continuum-dev/react`
  - for fully headless React bindings and advanced renderer hooks
- `@continuum-dev/session`
  - for lower-level session control outside the starter surface
- `@continuum-dev/starter-kit-ai`
  - for the optional AI chat UI layer on top of starter-kit

## Related Packages

- `@continuum-dev/react`
  - the headless React layer below the starter kit
- `@continuum-dev/starter-kit-ai`
  - optional AI chat UI wrappers above the starter kit
- `@continuum-dev/core`
  - the headless model, runtime, and session facade re-exported here

## Dictionary Contract

### Core Terms

- `starter map`
  - the shipped `starterKitComponentMap`
- `starter primitive`
  - one of the built-in field, layout, action, or content React components
- `style slot`
  - a named override target for `StarterKitStyleProvider`
- `session workbench`
  - the shipped timeline and review panel for the active Continuum session

### Default Component Map Keys

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
'default'
```

### `StarterKitStyleSlot`

```ts
'fieldControl'
'sliderInput'
'actionButton'
'collectionAddButton'
'itemRemoveButton'
'itemIconRemoveButton'
'conflictActionButton'
'suggestionsActionButton'
```

### Starter Kit-Specific Root Exports

```ts
starterKitComponentMap
StarterKitStyleProvider
starterKitDefaultStyles
StarterKitSessionWorkbench
useStarterKitTimeline
ActionButton
Presentation
UnknownNode
DateInput
RadioGroupInput
SelectInput
SliderInput
TextareaInput
TextInput
ToggleInput
CollectionSection
GridSection
GroupSection
RowSection
ConflictBanner
FieldProposalPlacementProvider
useFieldProposalPlacement
StarterKitFieldProposal
StarterKitFieldRestoreBadge
RestoreReviewCard
StarterKitSuggestionsBar
```

## License

MIT
