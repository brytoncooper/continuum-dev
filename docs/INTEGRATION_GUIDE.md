# Integration Guide

React-first integration patterns for:

- `@continuum-dev/core`
- `@continuum-dev/react`
- `@continuum-dev/starter-kit`
- `@continuum-dev/prompts`
- `@continuum-dev/ai-connect`

## 0) Fastest Production Path (Starter Kit)

If you want zero-setup rendering + AI controls, start with starter-kit primitives first and customize later.

```tsx
import {
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitProviderChatBox,
  StarterKitSessionWorkbench,
  starterKitComponentMap,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit';
import { createOpenAiClient, createGoogleClient } from '@continuum-dev/ai-connect';

const providers = [
  createOpenAiClient({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, model: 'gpt-5.4' }),
  createGoogleClient({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY }),
];

function Page() {
  const snapshot = useContinuumSnapshot();
  if (!snapshot) return null;
  return <ContinuumRenderer view={snapshot.view} />;
}

function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap} persist="localStorage">
      <StarterKitProviderChatBox providers={providers} mode="evolve-view" />
      <StarterKitSessionWorkbench />
      <Page />
    </ContinuumProvider>
  );
}
```

## 1) Production Baseline in React

Use `ContinuumProvider` as the state authority and render from `useContinuumSnapshot`.

```tsx
import { ContinuumProvider, ContinuumRenderer, useContinuumSnapshot } from '@continuum-dev/react';
import type { ContinuumNodeMap } from '@continuum-dev/react';

const nodeMap: ContinuumNodeMap = {
  field: FieldComponent,
  group: GroupComponent,
  action: ActionComponent,
  presentation: PresentationComponent,
};

function App() {
  return (
    <ContinuumProvider components={nodeMap} persist="localStorage">
      <Page />
    </ContinuumProvider>
  );
}

function Page() {
  const snapshot = useContinuumSnapshot();
  if (!snapshot) return null;
  return <ContinuumRenderer view={snapshot.view} />;
}
```

## 2) Receiving Server or AI Views

Before `pushView`, validate payload shape and reject duplicate ids or keys.

```tsx
import { useEffect } from 'react';
import { useContinuumSession } from '@continuum-dev/react';
import { collectDuplicateIssues, type ViewDefinition } from '@continuum-dev/core';

function AgentListener({ agentUrl }: { agentUrl: string }) {
  const session = useContinuumSession();

  useEffect(() => {
    const ws = new WebSocket(agentUrl);

    ws.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data) as { view?: unknown };
      if (!payload.view || typeof payload.view !== 'object') return;
      const view = payload.view as ViewDefinition;
      if (!view.viewId || !view.version || !Array.isArray(view.nodes)) return;

      const issues = collectDuplicateIssues(view.nodes);
      const hasError = issues.some((issue) => issue.severity === 'error');
      if (hasError) return;

      session.pushView(view);
    });

    return () => ws.close();
  }, [agentUrl, session]);

  return null;
}
```

## 3) Prompting and Correction Loops

Use `@continuum-dev/prompts` to keep generation behavior consistent.

```typescript
import {
  assembleSystemPrompt,
  buildEvolveUserMessage,
  buildCorrectionUserMessage,
  getDefaultOutputContract,
} from '@continuum-dev/prompts';
import { createOpenAiClient } from '@continuum-dev/ai-connect';

const client = createOpenAiClient({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-5.4',
});

const systemPrompt = assembleSystemPrompt({
  mode: 'evolve-view',
  addons: ['strict-continuity'],
  outputContract: getDefaultOutputContract(),
});

const userMessage = buildEvolveUserMessage({
  currentView,
  instruction: 'Add co-borrower employment and preserve existing semantic keys.',
});

const correctionMessage = buildCorrectionUserMessage({
  currentView,
  instruction: 'Fix validation and runtime errors while preserving semantic continuity.',
  validationErrors,
  runtimeErrors,
  detachedNodeIds,
});

const result = await client.generate({
  systemPrompt,
  userMessage,
  outputContract: getDefaultOutputContract(),
});
```

Recommended loop:

1. Generate candidate view.
2. Run preflight shape and duplicate checks.
3. Call `session.pushView(view)`.
4. Inspect `issues` and `resolutions`.
5. Retry with correction mode when blocking errors appear.

Provider recommendation:

- Default to OpenAI + Google first for most apps.
- Treat Anthropic as optional and include it only when you explicitly need/test it.

## 4) Persistence Strategies

`ContinuumProvider` built-in persistence props:

- `persist`: one of `'localStorage'`, `'sessionStorage'`, or `false`
- `storageKey`
- `maxPersistBytes`
- `onPersistError`

```tsx
<ContinuumProvider
  components={nodeMap}
  persist="localStorage"
  storageKey="my_app_session"
  maxPersistBytes={4_500_000}
  onPersistError={(error) => {
    if (error.reason === 'size_limit') {
      reportTelemetry('continuum_persist_size_limit', error);
    }
  }}
>
  <Page />
</ContinuumProvider>
```

Current behavior:

- writes are debounced by 200ms
- rehydration happens automatically
- `localStorage` syncs across tabs with `storage` events

## 5) Migration Strategies for Schema Evolution

When node hashes evolve, configure migration behavior in session reconciliation options.

```typescript
import { createSession } from '@continuum-dev/session';

const session = createSession({
  reconciliation: {
    migrationStrategies: {
      email: (_nodeId, _priorNode, _newNode, priorValue) => {
        const old = priorValue as { value?: string };
        return { value: (old.value ?? '').trim().toLowerCase() };
      },
    },
    strategyRegistry: {
      'normalize-phone': (_nodeId, _priorNode, _newNode, priorValue) => {
        const old = priorValue as { value?: string };
        return { value: (old.value ?? '').replace(/\D/g, '') };
      },
    },
  },
});
```

Resolution order:

1. `migrationStrategies[nodeId]`
2. node `migrations` rules and `strategyRegistry`
3. carry state as-is when type is unchanged
4. detach and emit `MIGRATION_FAILED` when migration fails

## 6) Action Execution

Register action handlers at session creation or at runtime. Handlers receive an `ActionContext` with a session reference for post-action mutations.

```typescript
import { createSession } from '@continuum-dev/session';

const session = createSession({
  actions: {
    submit_form: {
      registration: { label: 'Submit Form' },
      handler: async (context) => {
        const res = await fetch('/api/submit', {
          method: 'POST',
          body: JSON.stringify(context.snapshot.values),
        });
        const data = await res.json();
        context.session.updateState('status', { value: 'submitted' });
        return { success: true, data };
      },
    },
  },
});
```

`dispatchAction` returns a `Promise<ActionResult>` and catches handler errors:

```typescript
const result = await session.dispatchAction('submit_form', 'btn_submit');
if (!result.success) {
  console.error('Action failed:', result.error);
}
```

For an audited lifecycle that bridges the intent queue and action dispatch:

```typescript
const result = await session.executeIntent({
  nodeId: 'btn_submit',
  intentName: 'submit_form',
  payload: {},
});
```

`executeIntent` submits a pending intent, dispatches the action, and marks the intent as `validated` on success or `cancelled` on failure.

If no handler is registered for a dispatched `intentId`, a console warning is emitted and `{ success: false }` is returned.
## 7) Conflict Handling in React

When AI proposes values while users are editing, use proposals instead of direct overwrites.

```tsx
import { useContinuumConflict, useContinuumSession } from '@continuum-dev/react';

function EmailConflictBanner() {
  const session = useContinuumSession();
  const conflict = useContinuumConflict('email');

  function propose() {
    session.proposeValue('email', { value: 'ai_guess@example.com' }, 'ai-agent');
  }

  return (
    <div>
      <button onClick={propose}>Suggest email</button>
      {conflict.hasConflict && (
        <div>
          <button onClick={conflict.accept}>Accept</button>
          <button onClick={conflict.reject}>Reject</button>
        </div>
      )}
    </div>
  );
}
```

## 8) Diagnostics and Ops

Use runtime diagnostics after each push and track core metrics.

```tsx
import { useContinuumDiagnostics } from '@continuum-dev/react';

function DiagnosticsPanel() {
  const { issues, resolutions, diffs, checkpoints } = useContinuumDiagnostics();
  return (
    <pre>
      {JSON.stringify(
        {
          issueCount: issues.length,
          detachedCount: resolutions.filter((r) => r.resolution === 'detached').length,
          diffCount: diffs.length,
          checkpointCount: checkpoints.length,
        },
        null,
        2
      )}
    </pre>
  );
}
```

Track at minimum:

- error issue count per push
- detached resolution count per push
- correction retries before success
- persistence errors (`size_limit`, `storage_error`)

## 9) Lifecycle and Serialization

Use serialization for custom persistence backends, and call `destroy` when done.

```typescript
import { createSession, deserialize } from '@continuum-dev/session';

const session = createSession();

const blob = session.serialize();
const restored = deserialize(blob);

restored.destroy();
```

`deserialize` accepts payloads with `formatVersion: 1` and compatible legacy payloads without `formatVersion`.
