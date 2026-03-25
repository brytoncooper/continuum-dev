# Integration Guide

Production-oriented patterns for integrating Continuum by layer:

- `starter-kit` for the fastest React on-ramp
- `react` plus `session` for headless React apps
- `ai-engine` plus transport adapters for gen-UI and AI systems
- `runtime` plus `session` when you want the lower-level continuity boundary

This guide assumes you already understand the basics from [Quick Start](./QUICK_START.md).

## The production mental model

Continuum works best when your app follows one simple rule:

**Treat the current view as replaceable, but treat user intent as durable.**

In practice that means:

1. render from the active session snapshot
2. accept new views from a server or model
3. push those views through `session.pushView(view)`
4. inspect issues, diffs, and resolutions after each push
5. persist and rehydrate the session across reloads

## 1. Choose your integration level

### Fastest lane: `@continuum-dev/starter-kit`

Use this when you want a polished React surface quickly and you do not need built-in AI wrappers yet.

```tsx
import {
  ContinuumProvider,
  ContinuumRenderer,
  starterKitComponentMap,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit';

function Page() {
  const snapshot = useContinuumSnapshot();
  if (!snapshot?.view) {
    return null;
  }
  return <ContinuumRenderer view={snapshot.view} />;
}

export function App() {
  return (
    <ContinuumProvider
      components={starterKitComponentMap}
      persist="localStorage"
    >
      <Page />
    </ContinuumProvider>
  );
}
```

### Headless React lane: `@continuum-dev/react`

Use this when you want Continuum's session model but your own components.

```tsx
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSnapshot,
} from '@continuum-dev/react';
import type { ContinuumNodeMap } from '@continuum-dev/react';

const nodeMap: ContinuumNodeMap = {
  field: FieldComponent,
  group: GroupComponent,
  action: ActionComponent,
  presentation: PresentationComponent,
};

function Page() {
  const snapshot = useContinuumSnapshot();
  if (!snapshot?.view) {
    return null;
  }
  return <ContinuumRenderer view={snapshot.view} />;
}

export function App() {
  return (
    <ContinuumProvider components={nodeMap} persist="localStorage">
      <Page />
    </ContinuumProvider>
  );
}
```

### AI runtime stack: `@continuum-dev/ai-engine` plus the transport layer

Use this when you already have a gen-UI or AI app and want the clearest path to Continuum as the runtime that stabilizes it.

```tsx
import { DefaultChatTransport } from 'ai';
import { useContinuumSession } from '@continuum-dev/react';
import {
  buildContinuumVercelAiSdkRequestBody,
  useContinuumVercelAiSdkChat,
} from '@continuum-dev/vercel-ai-sdk-adapter';

export function CustomChat() {
  const session = useContinuumSession();
  const chat = useContinuumVercelAiSdkChat({
    session,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () =>
        buildContinuumVercelAiSdkRequestBody({
          currentView: session.getSnapshot()?.view ?? null,
          currentData: session.getSnapshot()?.data.values ?? null,
        }),
    }),
  });

  return (
    <button
      onClick={() =>
        chat.sendMessage({ text: 'Refine the current form for mobile' })
      }
    >
      Send prompt
    </button>
  );
}
```

This explicit stack keeps the responsibilities clear:

- `@continuum-dev/react` and `@continuum-dev/session` own the live app state
- `@continuum-dev/ai-engine` owns planning, parsing, normalization, and apply behavior
- `@continuum-dev/vercel-ai-sdk-adapter` owns the Vercel AI SDK request and stream bridge
- `@continuum-dev/ai-connect` is optional when you want built-in provider clients

For server routes, keep your existing AI SDK handler and compose Continuum into the UI stream with `writeContinuumExecutionToUiMessageWriter(...)` from `@continuum-dev/vercel-ai-sdk-adapter/server`.

### Optional thin wrappers: `@continuum-dev/starter-kit-ai`

Use this when you already want `starter-kit` and you want prebuilt chat controls instead of building your own AI UI.

```tsx
import {
  createAiConnectProviders,
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitProviderChatBox,
  type ContinuumViewAuthoringFormat,
  starterKitComponentMap,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit-ai';

const providers = createAiConnectProviders({
  include: ['openai', 'google'],
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: 'gpt-5',
  },
  google: {
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  },
});

const authoringFormat: ContinuumViewAuthoringFormat = 'line-dsl';

function Page() {
  const snapshot = useContinuumSnapshot();
  if (!snapshot?.view) {
    return null;
  }
  return <ContinuumRenderer view={snapshot.view} />;
}

export function App() {
  return (
    <ContinuumProvider
      components={starterKitComponentMap}
      persist="localStorage"
    >
      <StarterKitProviderChatBox
        providers={providers}
        mode="evolve-view"
        authoringFormat={authoringFormat}
      />
      <Page />
    </ContinuumProvider>
  );
}
```

These wrappers stay intentionally thin. The runtime behavior still lives in `@continuum-dev/ai-engine`, `@continuum-dev/react`, `@continuum-dev/session`, and the transport layer underneath.

### Convenience facades: `@continuum-dev/core` and `@continuum-dev/ai-core`

Use these only when one dependency edge matters more than learning the leaf packages directly.

- `@continuum-dev/core` re-exports the lower-level continuity spine
- `@continuum-dev/ai-core` re-exports the headless AI stack

They are useful for package ergonomics, but they are not the clearest place to learn the architecture.

## 2. Accepting views from a server or model

Before calling `pushView`, validate the basics:

- the payload is an object
- `viewId` exists
- `version` exists
- `nodes` is an array
- duplicate node ids or semantic continuity mistakes are rejected

```tsx
import { useEffect } from 'react';
import { useContinuumSession } from '@continuum-dev/react';
import {
  collectDuplicateIssues,
  type ViewDefinition,
} from '@continuum-dev/core';

export function AgentListener({ agentUrl }: { agentUrl: string }) {
  const session = useContinuumSession();

  useEffect(() => {
    const ws = new WebSocket(agentUrl);

    ws.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data) as { view?: unknown };
      if (!payload.view || typeof payload.view !== 'object') {
        return;
      }

      const view = payload.view as ViewDefinition;
      if (!view.viewId || !view.version || !Array.isArray(view.nodes)) {
        return;
      }

      const issues = collectDuplicateIssues(view.nodes);
      const hasBlockingIssue = issues.some(
        (issue) => issue.severity === 'error'
      );
      if (hasBlockingIssue) {
        return;
      }

      session.pushView(view);
    });

    return () => ws.close();
  }, [agentUrl, session]);

  return null;
}
```

## 3. Persistence strategy

For most React apps, start with provider-managed storage:

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

Built-in behavior today:

- writes are debounced
- rehydration is automatic
- `localStorage` syncs across tabs through `storage` events

Use custom serialization only when you need:

- server persistence
- encrypted storage
- cross-device resume
- explicit session snapshot transport

```ts
import { createSession, deserialize } from '@continuum-dev/session';

const session = createSession();
const blob = session.serialize();
const restored = deserialize(blob);

restored.destroy();
```

## 4. Migrations for schema evolution

If shapes evolve but values should survive in transformed form, define migration strategies.

```ts
import { createSession } from '@continuum-dev/session';

const session = createSession({
  reconciliation: {
    migrationStrategies: {
      email: ({ priorValue }) => {
        const old = priorValue as { value?: string };
        return { value: (old.value ?? '').trim().toLowerCase() };
      },
    },
    strategyRegistry: {
      'normalize-phone': ({ priorValue }) => {
        const old = priorValue as { value?: string };
        return { value: (old.value ?? '').replace(/\D/g, '') };
      },
    },
  },
});
```

## 5. Actions and intent execution

Action handlers can read the current snapshot and update session state as part of a workflow.

```ts
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

## 6. Conflict handling and proposals

When AI or remote systems suggest values while the user is editing, prefer proposals over direct overwrite.

```tsx
import {
  useContinuumConflict,
  useContinuumSession,
} from '@continuum-dev/react';

export function EmailConflictBanner() {
  const session = useContinuumSession();
  const conflict = useContinuumConflict('email');

  function propose() {
    session.proposeValue(
      'email',
      { value: 'ai_guess@example.com' },
      'ai-agent'
    );
  }

  return (
    <div>
      <button onClick={propose}>Suggest email</button>
      {conflict.hasConflict ? (
        <div>
          <button onClick={conflict.accept}>Accept</button>
          <button onClick={conflict.reject}>Reject</button>
        </div>
      ) : null}
    </div>
  );
}
```

## 7. Diagnostics and operational visibility

Inspect diagnostics after every view push:

```tsx
import { useContinuumDiagnostics } from '@continuum-dev/react';

export function DiagnosticsPanel() {
  const { issues, resolutions, diffs, checkpoints } = useContinuumDiagnostics();

  return (
    <pre>
      {JSON.stringify(
        {
          issueCount: issues.length,
          detachedCount: resolutions.filter(
            (item) => item.resolution === 'detached'
          ).length,
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

## 8. Production checklist

1. Keep `viewId` stable for a logical workflow.
2. Change `version` when the structure changes.
3. Keep semantic continuity metadata stable when meaning is unchanged.
4. Validate payload shape before `pushView`.
5. Reject duplicate ids and blocking structural issues.
6. Inspect issues and resolutions after every push.
7. Use proposals for AI-suggested values instead of overwriting active edits.
8. Persist sessions so users can survive refresh and long-running workflows.
9. Add migration strategies only where shape changes truly need transformation.

## 9. Related guides

- [Quick Start](./QUICK_START.md)
- [AI Integration Guide](./AI_INTEGRATION.md)
- [View Contract Reference](./VIEW_CONTRACT.md)

Reference app walkthroughs and migration guides live in the private Continuum documentation repository.
