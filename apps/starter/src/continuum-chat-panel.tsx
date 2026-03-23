import { useState } from 'react';
import { DefaultChatTransport } from 'ai';
import {
  buildContinuumVercelAiSdkRequestBody,
  useContinuumVercelAiSdkChat,
} from '@continuum-dev/vercel-ai-sdk-adapter';
import type { CSSProperties } from 'react';
import { useContinuumSession } from '@continuum-dev/starter-kit';
import { baselineView } from './baseline-view';

const panelStyle: {
  wrap: CSSProperties;
  label: CSSProperties;
  textarea: CSSProperties;
  buttonRow: CSSProperties;
  button: CSSProperties;
  status: CSSProperties;
} = {
  wrap: {
    display: 'grid',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    border: '1px solid #c9c8c4',
    background: '#faf9f6',
    maxWidth: 640,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#162033',
  },
  textarea: {
    width: '100%',
    minHeight: 96,
    padding: 10,
    borderRadius: 6,
    border: '1px solid #c9c8c4',
    fontFamily: 'inherit',
    fontSize: 14,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  button: {
    padding: '8px 16px',
    borderRadius: 6,
    border: '1px solid #162033',
    background: '#162033',
    color: '#faf9f6',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
  },
  status: {
    fontSize: 12,
    color: '#5c5a54',
  },
};

export function ContinuumChatPanel() {
  const session = useContinuumSession();
  const [draft, setDraft] = useState(
    'Add a phone field under Email and keep existing values.'
  );

  const chat = useContinuumVercelAiSdkChat({
    session,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () =>
        buildContinuumVercelAiSdkRequestBody({
          currentView: session.getSnapshot()?.view ?? baselineView,
          currentData: session.getSnapshot()?.data.values ?? null,
          continuum: {
            mode: 'evolve-view',
            authoringFormat: 'line-dsl',
          },
        }),
    }),
  });

  const busy =
    chat.status === 'submitted' || chat.status === 'streaming';

  return (
    <div style={panelStyle.wrap}>
      <div style={panelStyle.label}>Prompt (Vercel AI SDK + Continuum)</div>
      <textarea
        style={panelStyle.textarea}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        disabled={busy}
        aria-label="Instruction for the model"
      />
      <div style={panelStyle.buttonRow}>
        <button
          type="button"
          style={panelStyle.button}
          disabled={busy || draft.trim().length === 0}
          onClick={() => {
            void chat.sendMessage({ text: draft.trim() });
          }}
        >
          Send
        </button>
        <span style={panelStyle.status}>
          Status: {chat.status}
          {chat.latestStatus
            ? ` · ${chat.latestStatus.status}`
            : ''}
        </span>
      </div>
    </div>
  );
}
