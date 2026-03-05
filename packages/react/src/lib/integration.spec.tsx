import { act, StrictMode, useState, type ReactElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ContinuitySnapshot, NodeValue, ViewDefinition } from '@continuum/contract';
import { createSession } from '@continuum/session';
import type { Session } from '@continuum/session';
import { describe, expect, it, vi } from 'vitest';
import { ContinuumProvider } from './context.js';
import { useContinuumConflict, useContinuumDiagnostics, useContinuumHydrated, useContinuumSession, useContinuumSnapshot, useContinuumState, useContinuumViewport } from './hooks.js';
import { ContinuumRenderer } from './renderer.js';

const viewDef: ViewDefinition = {
  viewId: 'view',
  version: '1',
  nodes: [{ id: 'field', type: 'field', dataType: 'string' }],
};

function readStringNodeValue(value: NodeValue | undefined): string {
  if (typeof value?.value === 'string') {
    return value.value;
  }
  return '';
}

const componentMap = {
  field: ({
    value,
    onChange,
  }: {
    value: NodeValue | undefined;
    onChange: (next: NodeValue) => void;
  }) => (
    <input
      data-testid="input"
      value={readStringNodeValue(value)}
      onChange={(e) => onChange({ value: e.target.value })}
    />
  ),
  default: ({ definition }: { definition: { type: string } }) => <div data-testid="default">{definition.type}</div>,
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderIntoDom(element: ReactElement) {
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

function requireSession(session: Session | null): Session {
  if (!session) {
    throw new Error('Expected session to be captured');
  }
  return session;
}

describe('react integration', () => {
  it('throws when session hook is used outside provider', () => {
    function Outside() {
      useContinuumSession();
      return null;
    }
    expect(() => renderIntoDom(<Outside />)).toThrow();
  });

  it('hydrates from localStorage and reports hydrated=true', () => {
    const seed = createSession();
    seed.pushView(viewDef);
    seed.updateState('field', { value: 'from-storage' });
    localStorage.setItem('continuum_session', JSON.stringify(seed.serialize()));

    let hydrated = false;
    let snapshot: ContinuitySnapshot | null = null;
    function Probe() {
      hydrated = useContinuumHydrated();
      snapshot = useContinuumSnapshot();
      return null;
    }

    const view = renderIntoDom(
      <ContinuumProvider components={componentMap} persist="localStorage">
        <Probe />
      </ContinuumProvider>
    );

    expect(hydrated).toBe(true);
    const hydratedSnapshot = snapshot as ContinuitySnapshot | null;
    expect(hydratedSnapshot?.data.values['field']).toEqual({ value: 'from-storage' });
    view.unmount();
  });

  it('supports state updates through useContinuumState', () => {
    function App() {
      const session = useContinuumSession();
      const [value, setValue] = useContinuumState('field');
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return (
        <button
          data-testid="button"
          onClick={() => setValue({ value: 'next' })}
        >
          {readStringNodeValue(value)}
        </button>
      );
    }

    const view = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    const button = view.container.querySelector('[data-testid="button"]') as HTMLButtonElement;
    act(() => {
      button.click();
    });
    expect(button.textContent).toBe('next');
    view.unmount();
  });

  it('supports viewport updates through useContinuumViewport', () => {
    function App() {
      const session = useContinuumSession();
      const [viewport, setViewport] = useContinuumViewport('field');
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return (
        <button
          data-testid="viewport-button"
          onClick={() =>
            setViewport({
              scrollX: 20,
              scrollY: 30,
              zoom: 1.2,
              offsetX: 4,
              offsetY: 7,
            })}
        >
          {viewport?.zoom ?? 0}
        </button>
      );
    }

    const view = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    const button = view.container.querySelector('[data-testid="viewport-button"]') as HTMLButtonElement;
    act(() => {
      button.click();
    });
    expect(button.textContent).toBe('1.2');
    view.unmount();
  });

  it('renders views and tolerates null node arrays', () => {
    const badView = { viewId: 's', version: '1', nodes: null } as unknown as ViewDefinition;
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <ContinuumRenderer view={badView} />
      </ContinuumProvider>
    );
    expect(rendered.container.querySelector('[data-continuum-view="s"]')).toBeTruthy();
    rendered.unmount();
  });

  it('does not render nodes marked hidden', () => {
    const hiddenView: ViewDefinition = {
      viewId: 'hidden-view',
      version: '1',
      nodes: [{ id: 'hidden-field', type: 'field', dataType: 'string', hidden: true }],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <ContinuumRenderer view={hiddenView} />
      </ContinuumProvider>
    );
    expect(rendered.container.querySelector('[data-continuum-id="hidden-field"]')).toBeNull();
    rendered.unmount();
  });

  it('forwards definition properties to rendered component', () => {
    let receivedPlaceholder = '';
    const propsMap = {
      field: ({ definition }: { definition: { id: string; placeholder?: string } }) => {
        receivedPlaceholder = definition.placeholder ?? '';
        return <div data-testid={`field-${definition.id}`} />;
      },
    };
    const propsView: ViewDefinition = {
      viewId: 'props-view',
      version: '1',
      nodes: [
        {
          id: 'field',
          type: 'field',
          dataType: 'string',
          placeholder: 'From props',
        },
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={propsMap}>
        <ContinuumRenderer view={propsView} />
      </ContinuumProvider>
    );
    expect(receivedPlaceholder).toBe('From props');
    rendered.unmount();
  });

  it('isolates node render errors with per-node boundary', () => {
    const errorMap = {
      field: ({ definition }: { definition: { id: string } }) => {
        if (definition.id === 'boom') {
          throw new Error('boom');
        }
        return <div data-testid={`ok-${definition.id}`}>ok</div>;
      },
    };
    const errorView: ViewDefinition = {
      viewId: 'error-view',
      version: '1',
      nodes: [
        { id: 'boom', type: 'field', dataType: 'string' },
        { id: 'safe', type: 'field', dataType: 'string' },
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={errorMap}>
        <ContinuumRenderer view={errorView} />
      </ContinuumProvider>
    );
    expect(rendered.container.querySelector('[data-continuum-render-error="boom"]')).toBeTruthy();
    expect(rendered.container.querySelector('[data-testid="ok-safe"]')).toBeTruthy();
    rendered.unmount();
  });

  it('exposes diagnostics and destroys session on unmount', () => {
    vi.useFakeTimers();
    let issuesLength = -1;
    let checkpointsLength = -1;
    let capturedSession: Session | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      const diagnostics = useContinuumDiagnostics();
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      issuesLength = diagnostics.issues.length;
      checkpointsLength = diagnostics.checkpoints.length;
      return null;
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    expect(issuesLength).toBeGreaterThanOrEqual(0);
    expect(checkpointsLength).toBeGreaterThanOrEqual(1);
    rendered.unmount();
    vi.runAllTimers();
    const finalizedSession = capturedSession as Session | null;
    expect(finalizedSession).toBeTruthy();
    if (!finalizedSession) {
      throw new Error('Expected session to be captured');
    }
    expect(finalizedSession.isDestroyed).toBe(true);
    expect(() => finalizedSession.getSnapshot()).toThrow('Session has been destroyed');
    vi.useRealTimers();
  });

  it('keeps session usable in StrictMode replay', () => {
    function App() {
      const session = useContinuumSession();
      const [value, setValue] = useContinuumState('field');
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return (
        <button
          data-testid="strict-button"
          onClick={() => setValue({ value: 'strict-next' })}
        >
          {readStringNodeValue(value)}
        </button>
      );
    }

    const rendered = renderIntoDom(
      <StrictMode>
        <ContinuumProvider components={componentMap}>
          <App />
        </ContinuumProvider>
      </StrictMode>
    );
    const button = rendered.container.querySelector('[data-testid="strict-button"]') as HTMLButtonElement;
    act(() => {
      button.click();
    });
    expect(button.textContent).toBe('strict-next');
    rendered.unmount();
  });

  it('does not re-render memoized nodes on unrelated parent renders', () => {
    const renderCounts = { field: 0 };
    const perfMap = {
      field: ({ definition }: { definition: { id: string } }) => {
        renderCounts.field += 1;
        return <div data-testid={`perf-${definition.id}`}>ok</div>;
      },
    };

    function App() {
      const session = useContinuumSession();
      const [tick, setTick] = useState(0);
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return (
        <>
          <button data-testid="parent-rerender" onClick={() => setTick((value) => value + 1)}>
            {tick}
          </button>
          <ContinuumRenderer view={viewDef} />
        </>
      );
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={perfMap}>
        <App />
      </ContinuumProvider>
    );
    const button = rendered.container.querySelector('[data-testid="parent-rerender"]') as HTMLButtonElement;
    expect(renderCounts.field).toBe(1);
    act(() => {
      button.click();
    });
    expect(renderCounts.field).toBe(1);
    rendered.unmount();
  });

  it('does not subscribe container nodes to state updates', () => {
    const nestedView: ViewDefinition = {
      viewId: 'nested',
      version: '1',
      nodes: [
        {
          id: 'group',
          type: 'group',
          children: [{ id: 'field', type: 'field', dataType: 'string' }],
        },
        { id: 'other', type: 'field', dataType: 'string' },
      ],
    };
    const renderCounts = { group: 0, field: 0, other: 0 };
    const nestedMap = {
      group: ({ children }: { children?: ReactNode }) => {
        renderCounts.group += 1;
        return <section>{children}</section>;
      },
      field: ({ definition }: { definition: { id: string } }) => {
        if (definition.id === 'other') {
          renderCounts.other += 1;
        } else {
          renderCounts.field += 1;
        }
        return <div data-testid={`nested-${definition.id}`}>field</div>;
      },
    };
    let capturedSession: Session | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(nestedView);
      }
      return <ContinuumRenderer view={nestedView} />;
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={nestedMap}>
        <App />
      </ContinuumProvider>
    );

    expect(renderCounts.group).toBe(1);
    expect(renderCounts.other).toBe(1);
    expect(capturedSession).toBeTruthy();
    const activeSession = requireSession(capturedSession);
    act(() => {
      activeSession.updateState('other', { value: 'next' });
    });
    expect(renderCounts.group).toBe(1);
    expect(renderCounts.other).toBe(2);
    rendered.unmount();
  });

  it('uses provider store fanout instead of per-node session subscriptions', () => {
    const ids = Array.from({ length: 20 }, (_, index) => `field-${index}`);
    const largeView: ViewDefinition = {
      viewId: 'large-view',
      version: '1',
      nodes: ids.map((id) => ({ id, type: 'field', dataType: 'string' })),
    };
    let capturedSession: Session | null = null;
    let onSnapshotRegistrations = 0;
    let patched = false;

    function Probe({ nodeId }: { nodeId: string }) {
      useContinuumState(nodeId);
      return null;
    }

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(largeView);
      }
      if (!patched) {
        patched = true;
        const original = session.onSnapshot.bind(session);
        (session as Session & { onSnapshot: Session['onSnapshot'] }).onSnapshot = ((listener) => {
          onSnapshotRegistrations += 1;
          return original(listener);
        }) as Session['onSnapshot'];
      }
      return (
        <>
          {ids.map((id) => (
            <Probe key={id} nodeId={id} />
          ))}
        </>
      );
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(capturedSession).toBeTruthy();
    expect(onSnapshotRegistrations).toBe(0);
    rendered.unmount();
  });

  it('keeps node value reference stable across equivalent restored values', () => {
    const renderCounts = { field: 0 };
    const map = {
      field: () => {
        renderCounts.field += 1;
        return <div data-testid="stable-value">stable</div>;
      },
    };
    let capturedSession: Session | null = null;
    let checkpointId = '';

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
        session.updateState('field', { value: 'same', isDirty: true });
        checkpointId = session.checkpoint().checkpointId;
      }
      return <ContinuumRenderer view={viewDef} />;
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );

    expect(renderCounts.field).toBe(1);
    act(() => {
      const checkpoint = capturedSession
        ?.getCheckpoints()
        .find((item) => item.checkpointId === checkpointId);
      if (!checkpoint || !capturedSession) {
        throw new Error('Expected checkpoint and session to exist');
      }
      capturedSession.restoreFromCheckpoint(checkpoint);
    });
    expect(renderCounts.field).toBe(1);
    rendered.unmount();
  });

  it('stabilizes inline component map references across parent re-renders', () => {
    const renderCounts = { field: 0 };
    const fieldComponent = () => {
      renderCounts.field += 1;
      return <div data-testid="stable-map">stable-map</div>;
    };

    function ProviderShell() {
      const [tick, setTick] = useState(0);
      return (
        <>
          <button data-testid="provider-rerender" onClick={() => setTick((value) => value + 1)}>
            {tick}
          </button>
          <ContinuumProvider components={{ field: fieldComponent }}>
            <InlineMapApp />
          </ContinuumProvider>
        </>
      );
    }

    function InlineMapApp() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return <ContinuumRenderer view={viewDef} />;
    }

    const rendered = renderIntoDom(<ProviderShell />);
    const button = rendered.container.querySelector('[data-testid="provider-rerender"]') as HTMLButtonElement;
    expect(renderCounts.field).toBe(1);
    act(() => {
      button.click();
    });
    expect(renderCounts.field).toBe(1);
    rendered.unmount();
  });

  it('supports collection add/remove and item-scoped state updates', () => {
    const collectionView: ViewDefinition = {
      viewId: 'collection-view',
      version: '1',
      nodes: [
        {
          id: 'addresses',
          type: 'collection',
          minItems: 1,
          maxItems: 3,
          template: {
            id: 'address-item',
            type: 'group',
            children: [
              {
                id: 'city',
                type: 'field',
                dataType: 'string',
                defaultValue: 'Paris',
              },
            ],
          },
        },
      ],
    };
    const collectionMap = {
      collection: ({ children }: { children?: ReactNode }) => (
        <div data-testid="collection-root">{children}</div>
      ),
      group: ({ children }: { children?: ReactNode }) => (
        <div data-testid="item-group">{children}</div>
      ),
      field: ({
        value,
        onChange,
      }: {
        value: NodeValue | undefined;
        onChange: (next: NodeValue) => void;
      }) => (
        <button
          data-testid="collection-field"
          onClick={() => onChange({ value: 'Tokyo' })}
        >
          {readStringNodeValue(value)}
        </button>
      ),
    };
    let capturedSession: Session | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(collectionView);
      }
      return <ContinuumRenderer view={collectionView} />;
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={collectionMap}>
        <App />
      </ContinuumProvider>
    );

    const initialInputs = rendered.container.querySelectorAll('[data-testid="collection-field"]');
    expect(initialInputs).toHaveLength(1);
    expect((initialInputs[0] as HTMLButtonElement).textContent).toBe('Paris');

    const addButton = rendered.container.querySelector(
      '[data-continuum-collection-add="addresses"]'
    ) as HTMLButtonElement | null;
    expect(addButton).toBeTruthy();
    if (!addButton) {
      throw new Error('Expected add button to exist');
    }
    act(() => {
      addButton.click();
    });

    const twoInputs = rendered.container.querySelectorAll('[data-testid="collection-field"]');
    expect(twoInputs).toHaveLength(2);
    act(() => {
      (twoInputs[1] as HTMLButtonElement).click();
    });

    expect(capturedSession).toBeTruthy();
    const activeSession = requireSession(capturedSession);
    const snapshot = activeSession.getSnapshot();
    const collectionNode = snapshot?.data.values['addresses'] as
      | NodeValue<{ items: Array<{ values: Record<string, NodeValue> }> }>
      | undefined;
    if (!collectionNode) {
      throw new Error('Expected collection node to exist');
    }
    expect(collectionNode.value.items).toHaveLength(2);
    expect(collectionNode.value.items[1].values['address-item/city']).toEqual({
      value: 'Tokyo',
    });

    const removeButton = rendered.container.querySelector(
      '[data-continuum-collection-remove="addresses:1"]'
    ) as HTMLButtonElement | null;
    expect(removeButton).toBeTruthy();
    if (!removeButton) {
      throw new Error('Expected remove button to exist');
    }
    act(() => {
      removeButton.click();
    });
    const addressesNode = activeSession.getSnapshot()?.data.values['addresses'] as
      | NodeValue<{ items: Array<{ values: Record<string, NodeValue> }> }>
      | undefined;
    if (!addressesNode) {
      throw new Error('Expected addresses node to exist');
    }
    expect(
      addressesNode.value.items
    ).toHaveLength(1);
    rendered.unmount();
  });

  it('passes canonical nodeId to rendered components', () => {
    const nestedView: ViewDefinition = {
      viewId: 'nested-node-id',
      version: '1',
      nodes: [
        {
          id: 'group',
          type: 'group',
          children: [{ id: 'field', type: 'field', dataType: 'string' }],
        },
      ],
    };
    const nodeIds: string[] = [];
    const map = {
      group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      field: ({ nodeId }: { nodeId?: string }) => {
        if (nodeId) {
          nodeIds.push(nodeId);
        }
        return <div data-testid="nested-node-id-field" />;
      },
    };

    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <ContinuumRenderer view={nestedView} />
      </ContinuumProvider>
    );

    expect(nodeIds).toContain('group/field');
    rendered.unmount();
  });

  it('supports accept and reject conflict actions through canonical nodeId', () => {
    let capturedSession: Session | null = null;
    const conflictMap = {
      field: ({
        value,
        onChange,
        nodeId,
      }: {
        value: { value?: string } | undefined;
        onChange: (next: { value: string; isDirty: boolean }) => void;
        nodeId?: string;
      }) => {
        const conflict = useContinuumConflict(nodeId ?? '');
        return (
          <div>
            <button data-testid="mark-dirty" onClick={() => onChange({ value: 'typed', isDirty: true })}>
              dirty
            </button>
            <span data-testid="current-value">{value?.value ?? ''}</span>
            {conflict.hasConflict ? (
              <div>
                <button data-testid="accept" onClick={conflict.accept}>Accept</button>
                <button data-testid="reject" onClick={conflict.reject}>Reject</button>
              </div>
            ) : null}
          </div>
        );
      },
    };

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return <ContinuumRenderer view={viewDef} />;
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={conflictMap}>
        <App />
      </ContinuumProvider>
    );
    const dirtyButton = rendered.container.querySelector('[data-testid="mark-dirty"]') as HTMLButtonElement;
    act(() => {
      dirtyButton.click();
    });

    const activeSession = requireSession(capturedSession);
    act(() => {
      activeSession.proposeValue('field', { value: 'ai-suggested' }, 'ai');
    });

    const acceptButton = rendered.container.querySelector('[data-testid="accept"]') as HTMLButtonElement;
    expect(acceptButton).toBeTruthy();
    act(() => {
      acceptButton.click();
    });
    const valueAfterAccept = rendered.container.querySelector('[data-testid="current-value"]') as HTMLSpanElement;
    expect(valueAfterAccept.textContent).toBe('ai-suggested');
    expect(rendered.container.querySelector('[data-testid="accept"]')).toBeNull();

    act(() => {
      activeSession.updateState('field', { value: 'typed-again', isDirty: true });
      activeSession.proposeValue('field', { value: 'ai-new' }, 'ai');
    });
    const rejectButton = rendered.container.querySelector('[data-testid="reject"]') as HTMLButtonElement;
    expect(rejectButton).toBeTruthy();
    act(() => {
      rejectButton.click();
    });

    const valueAfterReject = rendered.container.querySelector('[data-testid="current-value"]') as HTMLSpanElement;
    expect(valueAfterReject.textContent).toBe('typed-again');
    expect(rendered.container.querySelector('[data-testid="reject"]')).toBeNull();
    rendered.unmount();
  });
});
