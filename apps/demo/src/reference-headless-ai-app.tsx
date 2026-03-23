import { DefaultChatTransport } from 'ai';
import { useEffect } from 'react';
import type { NodeValue, ViewDefinition } from '@continuum-dev/contract';
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
  type ContinuumNodeMap,
  type ContinuumNodeProps,
} from '@continuum-dev/react';
import {
  buildContinuumVercelAiSdkRequestBody,
  useContinuumVercelAiSdkChat,
} from '@continuum-dev/vercel-ai-sdk-adapter';

export const headlessAiReferenceClientPackages = [
  '@continuum-dev/contract',
  '@continuum-dev/react',
  '@continuum-dev/vercel-ai-sdk-adapter',
  'ai',
  'react',
] as const;

const headlessAiReferenceNodeMap: ContinuumNodeMap = {
  field: ({ value, onChange, definition }: ContinuumNodeProps<NodeValue>) => (
    <label style={{ display: 'grid', gap: 6 }}>
      <span>
        {'label' in definition && typeof definition.label === 'string'
          ? definition.label
          : definition.id}
      </span>
      <input
        value={typeof value?.value === 'string' ? value.value : ''}
        onChange={(event) =>
          onChange({
            value: event.target.value,
            isDirty: true,
          })
        }
      />
    </label>
  ),
  group: ({ definition, children }: ContinuumNodeProps) => (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2>
        {'label' in definition && typeof definition.label === 'string'
          ? definition.label
          : definition.id}
      </h2>
      {children}
    </section>
  ),
  presentation: ({ definition }: ContinuumNodeProps) => (
    <p>
      {'content' in definition && typeof definition.content === 'string'
        ? definition.content
        : definition.id}
    </p>
  ),
};

export const headlessAiReferenceInitialView: ViewDefinition = {
  viewId: 'headless-ai-reference',
  version: '1',
  nodes: [
    {
      id: 'intake',
      type: 'group',
      label: 'Loan intake',
      children: [
        {
          id: 'intro',
          type: 'presentation',
          contentType: 'text',
          content: 'Ask the model to refine this flow while Continuum preserves user state.',
        },
        {
          id: 'name',
          type: 'field',
          dataType: 'string',
          key: 'name',
          label: 'Name',
        },
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          key: 'email',
          label: 'Email',
        },
      ],
    },
  ],
};

function HeadlessAiReferenceControls() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const chat = useContinuumVercelAiSdkChat({
    session,
    transport: new DefaultChatTransport({
      api: '/api/reference-headless-ai',
      body: () => {
        const requestSnapshot =
          session.getCommittedSnapshot() ?? session.getSnapshot();

        return buildContinuumVercelAiSdkRequestBody({
          currentView: requestSnapshot?.view ?? headlessAiReferenceInitialView,
          currentData: requestSnapshot?.data.values ?? null,
        });
      },
    }),
  });

  useEffect(() => {
    if (!snapshot) {
      session.pushView(headlessAiReferenceInitialView);
    }
  }, [session, snapshot]);

  return (
    <button
      type="button"
      onClick={() =>
        void chat.sendMessage({
          text: 'Refine the current intake flow for mobile while preserving semantic continuity.',
        })
      }
    >
      Run AI refinement
    </button>
  );
}

function HeadlessAiReferenceScreen() {
  const snapshot = useContinuumSnapshot();

  if (!snapshot?.view) {
    return null;
  }

  return <ContinuumRenderer view={snapshot.view} />;
}

export function HeadlessAiReferenceApp() {
  return (
    <ContinuumProvider
      components={headlessAiReferenceNodeMap}
      persist="localStorage"
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <HeadlessAiReferenceControls />
        <HeadlessAiReferenceScreen />
      </div>
    </ContinuumProvider>
  );
}
