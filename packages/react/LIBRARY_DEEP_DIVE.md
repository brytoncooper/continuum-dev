# @continuum/react Deep Dive

This document is a comprehensive, implementation-level reference for the `@continuum/react` library in `packages/react`.

It is designed for:

- Humans onboarding to this package
- AI agents that need accurate package semantics
- Reviewers validating behavior and extension safety

## Scope

This covers every file currently in `packages/react`:

- `README.md`
- `package.json`
- `tsconfig.json`
- `tsconfig.lib.json`
- `vitest.config.ts`
- `src/index.ts`
- `src/lib/types.ts`
- `src/lib/context.tsx`
- `src/lib/hooks.ts`
- `src/lib/hooks.spec.tsx`
- `src/lib/renderer.tsx`
- `src/lib/fallback.tsx`
- `src/lib/error-boundary.tsx`
- `src/lib/fallback.spec.tsx`
- `src/lib/integration.spec.tsx`
- `src/lib/persistence.spec.tsx`

For source files, every exported and internal function/method is documented.

## What This Library Does

`@continuum/react` is the React binding layer for the Continuum SDK:

- Creates and owns a Continuum `Session` in React context
- Optionally hydrates/persists session data via browser storage
- Exposes React hooks that subscribe to session data and diagnostics
- Renders view-defined node trees via a node registry
- Contains safe fallbacks and error isolation for rendering failures

At a high level, it turns Continuum's session model into React-native primitives: provider, hooks, and renderer.

## Runtime Architecture

Main runtime flow:

1. `ContinuumProvider` creates or hydrates a `Session`.
2. Provider publishes `{ session, store, componentMap, wasHydrated }` in `ContinuumContext`.
3. Hooks subscribe to session events via `useSyncExternalStore` and re-render safely.
4. `ContinuumRenderer` walks `ViewDefinition.nodes` and renders each `ViewNode`.
5. State updates from node `onChange` call `session.updateState(nodeId, value)`.
6. Session persistence wiring serializes snapshots into storage (debounced) when `persist` is enabled.
7. On provider unmount, session destruction is delayed with a zero-delay timer to avoid StrictMode replay hazards.

## Public API Surface

Export barrel: `src/index.ts`

- `types` exports
- `context` exports
- `hooks` exports
- `renderer` exports
- `error-boundary` exports
- `fallback` exports

Primary public symbols:

- `ContinuumProvider`
- `ContinuumContext`, `ContinuumContextValue`
- `useContinuumSession`
- `useContinuumState`
- `useContinuumSnapshot`
- `useContinuumDiagnostics`
- `useContinuumHydrated`
- `ContinuumRenderer`
- `NodeErrorBoundary`
- `FallbackComponent`
- Type exports from `types.ts`

## File-by-File Reference

## `package.json`

Role:

- Declares package metadata and dependency contract.

Important fields:

- `name`: `@continuum/react`
- `type`: `module` (ESM)
- `main` / `types`: `./src/index.ts`
- `exports["."]`: `./src/index.ts`
- `peerDependencies.react`: `>=18`
- `dependencies`: `@continuum/contract`, `@continuum/session`
- `nx.tags`: `scope:react`

Implications:

- React is required from consumer environment, not bundled as package dependency.
- Package exposes source entrypoint directly.

## `tsconfig.json`

Role:

- Thin project-level indirection to `tsconfig.lib.json`.

Details:

- `extends`: `./tsconfig.lib.json`
- Empty `compilerOptions` override
- No project references here

Implications:

- All significant TypeScript behavior is defined in `tsconfig.lib.json`.

## `tsconfig.lib.json`

Role:

- Build config for this library.

Important compiler options:

- `jsx: react-jsx`
- `rootDir: src`
- `outDir: ../../dist/packages/react`
- `types: ["node"]`
- `lib: ["es2022", "dom"]`

File set:

- Includes `.ts` and `.tsx` in `src`
- Excludes test files matching `*.spec.ts`, `*.test.ts`

Project references:

- `../session/tsconfig.lib.json`
- `../contract/tsconfig.lib.json`

Implications:

- This library compiles against both Node and browser DOM APIs.
- It is tied to sibling Continuum packages via TS project references.

## `vitest.config.ts`

Role:

- Test runner configuration for this package.

Behavior:

- Uses Vite config wrapper (`defineConfig`)
- `environment: jsdom`
- Includes all `test/spec` JS/TS/JSX/TSX under `src`
- Coverage provider `v8`
- Coverage output: `./test-output/vitest/coverage`

Implications:

- Tests run with DOM emulation suitable for React rendering tests.

## `README.md`

Role:

- User-facing usage guide.

Content summary:

- Installation
- Quick start provider + renderer usage
- API summaries for provider, renderer, hooks
- Node map pattern
- Internal export notes

Relationship to this deep dive:

- README is usage-first.
- This document is implementation-first and exhaustive.

## `src/index.ts`

Role:

- Public export barrel.

Statements:

- `export * from './lib/types.js';`
- `export * from './lib/context.js';`
- `export * from './lib/hooks.js';`
- `export * from './lib/renderer.js';`
- `export * from './lib/error-boundary.js';`
- `export * from './lib/fallback.js';`

Implications:

- All symbols in listed modules become package API by default.
- Any accidental export added in those files becomes externally visible unless restricted.

## `src/lib/types.ts`

Role:

- Shared React and provider type contracts.

### `interface ContinuumNodeProps<T = NodeValue<any>>`

Purpose:

- Standard prop contract for view-rendered nodes.

Fields:

- `value: T | undefined`: current node value
- `onChange: (value: T) => void`: state update callback
- `definition: ViewNode`: view metadata for this node
- `children?: React.ReactNode`: rendered child nodes for nested nodes
- `[prop: string]: unknown`: forward-compatible slot for view-provided props

Usage:

- Consumed by library renderer and by consumer node implementations.

### `type ContinuumNodeMap`

Definition:

- `Record<string, ComponentType<ContinuumNodeProps<any>>>`

Purpose:

- Registry mapping view `definition.type` strings to React components.

Resolution behavior (implemented in `renderer.tsx`):

- First try exact type key.
- Then try `'default'`.
- Then use `FallbackComponent`.

### `interface ContinuumProviderProps`

Purpose:

- Props accepted by `ContinuumProvider`.

Fields:

- `components`: node registry (required)
- `persist`: `'sessionStorage' | 'localStorage' | false` (optional)
- `storageKey`: custom storage key (optional)
- `maxPersistBytes`: persistence payload size guard (optional)
- `onPersistError`: persistence error callback (optional)
- `sessionOptions`: options forwarded to `createSession`/`deserialize` (optional)
- `children`: React subtree (required)

## `src/lib/context.tsx`

Role:

- Provider + session lifecycle + hydration + persistence integration.

### `interface ContinuumContextValue`

Fields:

- `session: Session`
- `store: ContinuumStore`
- `componentMap: ContinuumNodeMap`
- `wasHydrated: boolean`

### `const ContinuumContext = createContext<ContinuumContextValue | null>(null)`

Purpose:

- React context for all hooks and renderer internals.

Default value:

- `null`, so hooks can detect missing provider and throw explicit errors.

### `const DEFAULT_STORAGE_KEY = 'continuum_session'`

Purpose:

- Default key when persistence enabled and `storageKey` not provided.

### `resolveStorage(persist): Storage | undefined`

Type:

- Internal helper function.

Input:

- `persist` from provider props.

Behavior:

- `false`/falsy -> `undefined`
- `'sessionStorage'` -> `globalThis.sessionStorage`
- `'localStorage'` -> `globalThis.localStorage`
- any other value -> `undefined`

Notes:

- Assumes browser-like environment where `globalThis.*Storage` exists.

### `hydrateOrCreate(options?): Session`

Type:

- Imported session factory helper from `@continuum/session`.

Behavior:

1. If persistence options include storage, it attempts hydration from storage key.
2. If deserialization fails, it clears the invalid entry and creates a fresh session.
3. Without persistence options, it creates a fresh session directly.

Design intent:

- Prefer recovery and forward progress over fatal hydration errors.

### `ContinuumProvider(props)`

Type:

- Exported React function component.

Responsibility:

- Own one session instance for the provider lifetime, expose it via context, and synchronize persistence/destruction behavior.

Detailed lifecycle behavior:

1. Resolve persistence storage with `resolveStorage`.
2. Use `sessionRef` to lazily initialize session exactly once per mount cycle:
   - Hydrate from storage if possible
   - Otherwise create new session
3. Read stable `session` and `wasHydrated` from ref.
4. Manage destruction with an unmount cleanup timer:
   - On mount/effect rerun, clear any previous pending destroy timer
   - On cleanup, schedule `session.destroy()` in `setTimeout(..., 0)`
   - Then clear timer ref
5. Memoize context value from `session`, `store`, `componentMap`, `wasHydrated`.
6. Render `<ContinuumContext.Provider value={value}>{children}</ContinuumContext.Provider>`.

Why delayed destroy matters:

- React StrictMode can mount/unmount/replay trees during development.
- Zero-delay deferred destroy prevents immediate teardown that could break replay timing.

Potential edge cases:

- If storage APIs are unavailable in current runtime, direct `globalThis.localStorage/sessionStorage` access can throw before provider completes.
- `componentMap` identity changes trigger new memoized context object, causing downstream re-renders.

## `src/lib/hooks.ts`

Role:

- React hooks binding session data/diagnostics to external-store subscriptions.

### `shallowArrayEqual(left, right): boolean`

Type:

- Internal utility function.

Behavior:

- Returns false if length differs.
- Returns false on first strict inequality at any index.
- Returns true otherwise.

Usage:

- Used to stabilize diagnostics object identity in `useContinuumDiagnostics`.

### `useContinuumSession(): Session`

Type:

- Exported hook.

Behavior:

- Reads `ContinuumContext` with `useContext`.
- Throws explicit error if context missing.
- Returns `ctx.session`.

Error message:

- `'useContinuumSession must be used within a <ContinuumProvider>'`

### `useContinuumState(nodeId): [NodeValue<any> | undefined, (value) => void]`

Type:

- Exported hook.

Inputs:

- `nodeId: string`

Behavior:

1. Resolve `session` from `useContinuumSession`.
2. Build `subscribe` callback using `session.onSnapshot(onStoreChange)`.
3. Build `getSnapshot` callback:
   - `session.getSnapshot()`
   - Return `snap?.data.values?.[nodeId]`
4. Use `useSyncExternalStore(subscribe, getSnapshot, getSnapshot)` for tear-free subscription.
5. Return tuple:
   - current node value
   - setter calling `session.updateState(nodeId, next)`

Reactivity:

- Re-renders on any session snapshot, then selects one node path.

### `useContinuumSnapshot(): ContinuitySnapshot | null`

Type:

- Exported hook.

Behavior:

1. Resolve `session`.
2. Keep `snapshotCacheRef` with previous `view`, `data`, `snapshot`.
3. Subscribe to snapshots.
4. On read:
   - Get latest snapshot from session.
   - If null: clear cache and return null.
   - If both `view` and `data` references are unchanged from cache, return cached snapshot object.
   - Else update cache and return new snapshot.
5. Return external-store value.

Identity optimization:

- Avoids unnecessary downstream updates when session returns structurally same references.

### `useContinuumDiagnostics()`

Type:

- Exported hook (return type inferred).

Return shape:

- `{ issues, diffs, resolutions, checkpoints }` from session diagnostics getters.

Behavior:

1. Resolve `session`.
2. Keep diagnostics cache ref.
3. Build `getSnapshot`:
   - Pull arrays from `session.getIssues/getDiffs/getResolutions/getCheckpoints`.
   - If cached arrays are shallow-equal to new arrays, return cached object.
   - Else replace cache and return new diagnostics object.
4. Build `subscribe`:
   - Subscribe to both `session.onSnapshot` and `session.onIssues`.
   - Trigger store change on either event.
   - Cleanup both subscriptions.
5. Return `useSyncExternalStore(subscribe, getSnapshot, getSnapshot)`.

Design intent:

- Includes both structural data changes and explicit issues events.
- Caches by array element equality to keep object identity stable when diagnostics unchanged.

### `useContinuumHydrated(): boolean`

Type:

- Exported hook.

Behavior:

- Reads context directly.
- Throws if context missing.
- Returns `ctx.wasHydrated`.

Error message:

- `'useContinuumHydrated must be used within a <ContinuumProvider>'`

## `src/lib/renderer.tsx`

Role:

- View-driven React renderer.

### `NodeRenderer({ definition })`

Type:

- Internal recursive component.

Inputs:

- `definition: ViewNode`

Behavior:

1. Read context, throw if absent.
2. Resolve render component by priority:

- `componentMap[definition.type]`
- `componentMap['default']`
- `FallbackComponent`

3. Read state tuple via `useContinuumState(definition.id)`.
4. If `definition.hidden` is truthy, render `null`.
5. Recursively map `definition.children` into child `NodeRenderer`s.
6. Render wrapper:
   - `<div data-continuum-id={definition.id}>`
   - Inside wrapper, use `<NodeErrorBoundary nodeId={definition.id}>`
   - Render chosen component with:
     - `value`
     - `onChange`
     - `definition`
     - `children` as rendered child nodes

Important semantics:

- Every visible node gets a stable `data-continuum-id`.
- Per-node error boundary isolates render failures by node id.
- `definition` is passed directly, and props are not spread onto the component.

### `ContinuumRenderer({ view })`

Type:

- Exported function component.

Inputs:

- `view: ViewDefinition`

Behavior:

- Renders root wrapper `<div data-continuum-view={view.viewId}>`.
- Iterates `(view.nodes ?? [])` and renders each top-level `NodeRenderer`.
- Accepts `null` nodes list defensively by falling back to empty array.

## `src/lib/fallback.tsx`

Role:

- Built-in fallback UI for unknown node types.

### `FallbackComponent({ value, onChange, definition })`

Type:

- Exported function component.

Behavior:

1. Coerce incoming `value` to `NodeValue<any> | undefined`.
2. Derive text input value:
   - if `raw.value` is string or number, use `String(raw.value)`
   - else empty string
3. Derive display labels:
   - `displayName = definition.label ?? definition.id`
   - `placeholder = definition.placeholder ?? \`Enter value for "${displayName}"\``
4. Render warning UI with red-dashed visual style.
5. Render `<input>`:
   - Controlled by `textValue`
   - On change, calls `onChange({ value: e.target.value } as NodeValue<string>)`
6. Render `<details>` block with pretty-printed full view `definition`.

Purpose:

- Makes unsupported view node types visible and editable rather than silently failing.
- Provides diagnostic visibility by showing raw definition JSON.

## `src/lib/error-boundary.tsx`

Role:

- Per-node render error isolation.

### `interface NodeErrorBoundaryProps`

Fields:

- `nodeId: string`
- `children: ReactNode`

### `interface NodeErrorBoundaryState`

Fields:

- `hasError: boolean`
- `message: string`

### `class NodeErrorBoundary extends Component<Props, State>`

Exported class component with two methods:

#### `static getDerivedStateFromError(error): NodeErrorBoundaryState`

Behavior:

- Converts any thrown render error into boundary state:
  - `hasError: true`
  - `message`: `error.message` if `Error`, else `String(error)`

#### `render()`

Behavior:

- If `hasError`, render:
  - `<div data-continuum-render-error={nodeId}>`
  - text: `Node render failed: {nodeId} ({message})`
- Otherwise return normal `children`.

Scope:

- Boundary catches rendering/lifecycle errors in subtree node rendering phase.

## `src/lib/fallback.spec.tsx`

Role:

- Unit-level sanity check for fallback component return shape.

Test suite: `describe('FallbackComponent', ...)`

### Test: "returns a renderable React element for unknown node types"

Asserts:

- Calling `FallbackComponent(...)` returns a defined React element.
- Root element type is `div`.
- Element has children.
- Placeholder prop on input child equals provided placeholder.

What this protects:

- Base renderability and expected prop plumbing for unknown type fallback path.

## `src/lib/integration.spec.tsx`

Role:

- End-to-end integration tests across provider, hooks, renderer, hydration, diagnostics, and lifecycle.

Supporting definitions:

- `view`: simple one-node view fixture
- `componentMap`: field + default node fixtures
- global test flag: `IS_REACT_ACT_ENVIRONMENT = true`

### Helper function: `renderIntoDom(element)`

Purpose:

- Mounts React element into a real `document` container using `createRoot` and `act`.

Returns:

- `container` (DOM node)
- `unmount()` helper that calls `root.unmount()` inside `act` and removes container

### Test: "throws when session hook is used outside provider"

Verifies:

- `useContinuumSession` enforces provider boundary with thrown error.

### Test: "hydrates from localStorage and reports hydrated=true"

Setup:

- Create seed session
- Push view and state
- Serialize to `localStorage` at default key

Verifies:

- Provider with `persist="localStorage"` hydrates data
- `useContinuumHydrated()` returns `true`
- Snapshot contains stored node value

### Test: "supports state updates through useContinuumState"

Verifies:

- Hook setter updates session state
- UI reflects update (`button.textContent` becomes `next`)

### Test: "renders views and tolerates null node arrays"

Verifies:

- Renderer does not crash when `view.nodes` is `null`.
- Root view data attribute is rendered.

### Test: "does not render nodes marked hidden"

Verifies:

- Node with `hidden: true` is not rendered into DOM.

### Test: "forwards definition to rendered component"

Verifies:

- `definition` reaches node implementation.

### Test: "isolates node render errors with per-node boundary"

Verifies:

- Throwing node shows per-id error boundary output.
- Sibling nodes continue rendering.

### Test: "exposes diagnostics and destroys session on unmount"

Setup:

- `vi.useFakeTimers()` to control deferred destroy.

Verifies:

- Diagnostics hook returns arrays with expected non-negative lengths.
- After unmount and timer flush, session snapshot becomes `null` (destroyed).

### Test: "keeps session usable in StrictMode replay"

Verifies:

- Provider/session remains functional under `StrictMode` mount/replay behavior.
- State updates continue to work.

## Internal Behavior Notes and Contracts

## Session Ownership Contract

- A provider owns one session instance through its mount lifecycle.
- Session creation is lazy and ref-backed, not state-backed.
- Destroy is deferred to avoid premature disposal during StrictMode replay.

## Persistence Contract

- Storage hydration is best effort.
- Corrupt storage is deleted automatically.
- Persistence writes are debounced and silent-fail on storage exceptions.

## Rendering Contract

- Hidden definitions render as `null`.
- Unknown type resolution: specific type -> `default` -> `FallbackComponent`.
- Every rendered node is wrapped with both id marker and error boundary.

## Hook Safety Contract

- Hooks requiring provider throw clear errors when outside provider.
- Store subscriptions are created via `useSyncExternalStore` to align with React external-store guarantees.

## Dependency and Integration Map

Direct package dependencies:

- `@continuum/contract`: shared view/data types
- `@continuum/session`: runtime session engine
- `react`: runtime peer dependency

Inferred runtime dependency graph:

- `context.tsx` depends on `@continuum/session`, `types.ts`
- `hooks.ts` depends on `context.tsx`, session API
- `renderer.tsx` depends on `context.tsx`, `hooks.ts`, fallback + error boundary
- `fallback.tsx` depends on `types.ts`
- tests exercise integrated surface across all runtime modules

## Known Tradeoffs and Extension Guidance

Current tradeoffs:

- Silent persistence errors favor availability over observability.
- `definition` is provided directly and is easier to reason about than blind spread.
- Storage access assumes browser globals.

Safe extension points:

- Add new hooks in `hooks.ts` using same `useSyncExternalStore` pattern.
- Add renderer behavior by extending `NodeRenderer` resolution and wrappers.
- Replace fallback style/behavior in `FallbackComponent` without changing API.

Change-risk hot spots:

- Provider lifecycle (`context.tsx`) because hydration, persistence, and destroy timing intersect there.
- Hook caching logic (`useContinuumSnapshot`, `useContinuumDiagnostics`) because identity stability affects render frequency.
- Recursive rendering (`NodeRenderer`) because prop spread and error boundaries affect all node types.

## Testing and Verification Commands

Use Nx tasks for this package:

- `nx test @continuum/react`
- `nx lint @continuum/react`
- `nx build @continuum/react`
- `nx typecheck @continuum/react`

Project metadata (from Nx MCP `nx_project_details`):

- project: `@continuum/react`
- type: `library`
- root: `packages/react`
- tags: `scope:react`
- project dependencies: `contract`, `@continuum/session`

## Quick Index of Functions and Methods

For fast AI/human lookup, this is every function/method currently present in source and tests:

- `resolveStorage` (`context.tsx`)
- `createContinuumStore` (`context.tsx`)
- `ContinuumProvider` (`context.tsx`)
- `shallowArrayEqual` (`hooks.ts`)
- `useContinuumSession` (`hooks.ts`)
- `useContinuumState` (`hooks.ts`)
- `useContinuumSnapshot` (`hooks.ts`)
- `useContinuumDiagnostics` (`hooks.ts`)
- `useContinuumHydrated` (`hooks.ts`)
- `NodeRenderer` (`renderer.tsx`)
- `ContinuumRenderer` (`renderer.tsx`)
- `FallbackComponent` (`fallback.tsx`)
- `NodeErrorBoundary.getDerivedStateFromError` (`error-boundary.tsx`)
- `NodeErrorBoundary.render` (`error-boundary.tsx`)
- `renderIntoDom` (`integration.spec.tsx`)

---

If this package grows, update this file whenever a new source file, exported symbol, or hook/renderer lifecycle behavior is added.
