import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ViewDefinition } from '@continuum-dev/contract';
import type { Session } from '@continuum-dev/session';
import { describe, expect, it } from 'vitest';
import { ContinuumProvider } from '../context/index.js';
import { useContinuumSession } from '../hooks/provider.js';
import {
  deriveNodeBuildState,
  resolveStreamStatus,
  useStreamingMappedProps,
} from './streaming.js';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function renderIntoDom(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('renderer streaming', () => {
  it('resolves subtree statuses from the nearest streaming ancestor', () => {
    const status = resolveStreamStatus(
      {
        streamId: 'stream-1',
        targetViewId: 'profile',
        startedAt: Date.now(),
        mode: 'foreground',
        status: 'open',
        affectedNodeIds: [],
        nodeStatuses: {
          profile: {
            status: 'building',
            level: 'info',
            subtree: true,
          },
        },
      },
      'profile/name'
    );

    expect(status).toEqual({
      status: 'building',
      level: 'info',
      subtree: true,
    });
  });

  it('derives build states from status and affected node ancestry', () => {
    expect(
      deriveNodeBuildState(
        {
          streamId: 'stream-1',
          targetViewId: 'profile',
          startedAt: Date.now(),
          mode: 'foreground',
          status: 'open',
          affectedNodeIds: ['profile'],
          nodeStatuses: {},
        },
        'profile/name',
        undefined
      )
    ).toBe('building');

    expect(deriveNodeBuildState(null, 'profile/name', undefined)).toBe(
      'committed'
    );
  });

  it('adds streaming props while preserving caller mapped props', () => {
    const view: ViewDefinition = {
      viewId: 'profile',
      version: '1',
      nodes: [],
    };
    let session: Session | null = null;
    let capturedProps: Record<string, unknown> | null = null;

    function Probe() {
      const activeSession = useContinuumSession();
      session = activeSession;
      if (!activeSession.getSnapshot()) {
        activeSession.pushView(view);
      }
      capturedProps = useStreamingMappedProps('profile/name', {
        tone: 'warm',
      });
      return null;
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={{}}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      const stream = session!.beginStream({
        targetViewId: 'profile',
        mode: 'foreground',
      });
      session!.applyStreamPart(stream.streamId, {
        kind: 'node-status',
        nodeId: 'profile/name',
        status: 'ready',
        level: 'success',
      });
    });

    expect(capturedProps).toEqual({
      tone: 'warm',
      isStreaming: true,
      buildState: 'ready',
      streamStatus: {
        status: 'ready',
        level: 'success',
      },
    });

    rendered.unmount();
  });
});
