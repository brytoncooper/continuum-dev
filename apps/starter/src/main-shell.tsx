import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import {
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit';
import { baselineView } from './baseline-view';
import { ContinuumChatPanel } from './continuum-chat-panel';

const shellStyle: {
  layout: CSSProperties;
  formColumn: CSSProperties;
  heading: CSSProperties;
} = {
  layout: {
    display: 'grid',
    gap: 24,
    padding: 24,
    maxWidth: 1100,
    margin: '0 auto',
  },
  formColumn: {
    display: 'grid',
    gap: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: 600,
    color: '#162033',
    margin: 0,
  },
};

function SessionForm() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!snapshot) {
      session.pushView(baselineView);
    }
  }, [session, snapshot]);

  if (!snapshot?.view) {
    return null;
  }

  return <ContinuumRenderer view={snapshot.view} />;
}

export function MainShell(props: { chatResetKey: number }) {
  return (
    <div style={shellStyle.layout}>
      <div style={shellStyle.formColumn}>
        <h1 style={shellStyle.heading}>Continuum starter</h1>
        <SessionForm />
      </div>
      <ContinuumChatPanel key={props.chatResetKey} />
    </div>
  );
}
