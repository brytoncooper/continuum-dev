# Integration Guide

Use this guide when you want the broader production picture around Continuum package choices, session flow, persistence, and AI integration.

If you only need the shortest path:

- existing Vercel AI SDK app: [AI Integration Guide](./AI_INTEGRATION.md)
- smallest honest local setup: [Quick Start](./QUICK_START.md)
- continuity semantics in product terms: [How Continuity Decisions Work](./HOW_CONTINUITY_DECISIONS_WORK.md)

## Start By Choosing The Shallowest Lane

| If you need | Start with | Why |
| --- | --- | --- |
| Existing Vercel AI SDK app with Continuum continuity | `@continuum-dev/vercel-ai-sdk-adapter` | keep your current transport and route shape |
| Fastest React session with AI | `@continuum-dev/starter-kit-ai` | quickest shipped path with a renderer, session, and chat surface |
| Custom React UI with Continuum session semantics | `@continuum-dev/react` plus `@continuum-dev/session` | clearest headless React lane |
| Direct control over reconciliation and snapshot contracts | `@continuum-dev/runtime` plus `@continuum-dev/session` | lowest-level continuity boundary |

## The Normal Application Order

Most successful Continuum apps follow this order:

1. create or rehydrate a Continuum session
2. mount the first view if no snapshot exists yet
3. render from the current session snapshot
4. accept new views or AI-generated changes through the same session
5. inspect diagnostics and persist the session

That is the main mental model: render from session state, and feed changes back through the session.

## 1. Existing Vercel AI SDK Lane

Use this when your app already has, or should have, a server-backed Vercel AI SDK route.

The public pattern is:

- send the current Continuum snapshot from the client
- run Continuum execution on the server
- let the client hook apply streamed Continuum parts back into session state

Client:

```tsx
import { DefaultChatTransport } from 'ai';
import { useContinuumSession } from '@continuum-dev/react';
import {
  buildContinuumVercelAiSdkRequestBody,
  useContinuumVercelAiSdkChat,
} from '@continuum-dev/vercel-ai-sdk-adapter';

export function ContinuumChat() {
  const session = useContinuumSession();

  const chat = useContinuumVercelAiSdkChat({
    session,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => {
        const snapshot = session.getSnapshot();
        return buildContinuumVercelAiSdkRequestBody({
          currentView: snapshot?.view ?? null,
          currentData: snapshot?.data.values ?? null,
        });
      },
    }),
  });

  return (
    <button
      onClick={() =>
        chat.sendMessage({ text: 'Refine the current form for mobile.' })
      }
    >
      Send prompt
    </button>
  );
}
```

Server:

```ts
import { openai } from '@ai-sdk/openai';
import {
  createContinuumVercelAiSdkRouteHandler,
  createVercelAiSdkContinuumExecutionAdapter,
} from '@continuum-dev/vercel-ai-sdk-adapter/server';

export const POST = createContinuumVercelAiSdkRouteHandler({
  adapter: createVercelAiSdkContinuumExecutionAdapter({
    model: openai(process.env.OPENAI_MODEL ?? 'gpt-4o-mini'),
  }),
  defaultAuthoringFormat: 'line-dsl',
});
```

Use the full walkthrough in [AI Integration Guide](./AI_INTEGRATION.md) when you want the complete lane explanation.

## 2. Fastest Shipped Lane: `@continuum-dev/starter-kit-ai`

Use this when you want the easiest path to a renderable Continuum app with AI and you are comfortable with a direct provider-backed browser path.

The recommended starting point is [Quick Start](./QUICK_START.md), which includes the provider setup and the initial view seed. The key shape is:

```tsx
import {
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitProviderChatBox,
  createAiConnectProviders,
  starterKitComponentMap,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit-ai';

const providers = createAiConnectProviders({
  include: ['openai'],
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini',
  },
});

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
      <StarterKitProviderChatBox providers={providers} />
      <Page />
    </ContinuumProvider>
  );
}
```

Use the Vercel lane instead when you want a server-backed transport or provider credentials off the client.

## 3. Headless React Lane: `@continuum-dev/react`

Use this when you want Continuum session behavior but your own component map and UI.

```tsx
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSnapshot,
  type ContinuumNodeMap,
} from '@continuum-dev/react';

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

This is the right lane when you want React bindings and session semantics without starter-kit UI decisions.

## 4. Accept New Views Through The Session

Whether the next view comes from a server, a tool, or an AI result, push it through the same Continuum session.

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

The important rule is consistent across all lanes: if the structure changed, let the session reconcile it.

## 5. Persistence Strategy

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
- explicit snapshot transport

```ts
import { createSession, deserialize } from '@continuum-dev/session';

const session = createSession();
const blob = session.serialize();
const restored = deserialize(blob);

restored.destroy();
```

## 6. Use Proposals For Suggested Values

When AI or remote systems suggest values while the user is editing, prefer proposals over blind overwrite.

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

That preserves user intent better than treating AI output as authoritative state.

## 7. Inspect Diagnostics

Inspect diagnostics after every important view update:

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

If continuity is part of your product promise, these diagnostics are part of your product surface too.

## 8. Production Checklist

1. Keep `viewId` stable for one logical workflow.
2. Change `version` when the structure changes.
3. Keep continuity metadata stable when meaning is unchanged.
4. Always feed structural changes back through the session.
5. Validate incoming views before `pushView(...)`.
6. Persist sessions so users survive refresh and long-running work.
7. Use proposals for AI-suggested values.
8. Inspect issues, resolutions, and diffs after important updates.

## Related Guides

- [How Continuity Decisions Work](./HOW_CONTINUITY_DECISIONS_WORK.md)
- [AI Integration Guide](./AI_INTEGRATION.md)
- [Quick Start](./QUICK_START.md)
- [View Contract Reference](./VIEW_CONTRACT.md)
