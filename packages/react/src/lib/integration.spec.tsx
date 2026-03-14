import React, {
  act,
  StrictMode,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import type {
  ContinuitySnapshot,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import { createSession } from '@continuum-dev/session';
import type { Session } from '@continuum-dev/session';
import { describe, expect, it, vi } from 'vitest';
import { ContinuumContext, ContinuumProvider } from './context.js';
import {
  NodeStateScopeContext,
  useContinuumAction,
  useContinuumConflict,
  useContinuumDiagnostics,
  useContinuumHydrated,
  useContinuumSession,
  useContinuumSnapshot,
  useContinuumState,
  useContinuumSuggestions,
  useContinuumViewport,
} from './hooks.js';
import type { ViewportState } from '@continuum-dev/contract';
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
  default: ({ definition }: { definition: { type: string } }) => (
    <div data-testid="default">{definition.type}</div>
  ),
};

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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
    expect(hydratedSnapshot?.data.values['field']).toEqual({
      value: 'from-storage',
    });
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

    const button = view.container.querySelector(
      '[data-testid="button"]'
    ) as HTMLButtonElement;
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
            })
          }
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

    const button = view.container.querySelector(
      '[data-testid="viewport-button"]'
    ) as HTMLButtonElement;
    act(() => {
      button.click();
    });
    expect(button.textContent).toBe('1.2');
    view.unmount();
  });

  it('renders views and tolerates null node arrays', () => {
    const badView = {
      viewId: 's',
      version: '1',
      nodes: null,
    } as unknown as ViewDefinition;
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <ContinuumRenderer view={badView} />
      </ContinuumProvider>
    );
    expect(rendered.container.childElementCount).toBe(0);
    rendered.unmount();
  });

  it('does not render nodes marked hidden', () => {
    const hiddenView: ViewDefinition = {
      viewId: 'hidden-view',
      version: '1',
      nodes: [
        { id: 'hidden-field', type: 'field', dataType: 'string', hidden: true },
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <ContinuumRenderer view={hiddenView} />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="input"]')
    ).toBeNull();
    rendered.unmount();
  });

  it('forwards definition properties to rendered component', () => {
    let receivedPlaceholder = '';
    const propsMap = {
      field: ({
        definition,
      }: {
        definition: { id: string; placeholder?: string };
      }) => {
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
    expect(
      rendered.container.querySelector('[data-continuum-render-error="boom"]')
    ).toBeTruthy();
    expect(
      rendered.container.querySelector('[data-testid="ok-safe"]')
    ).toBeTruthy();
    rendered.unmount();
  });

  it('recovers node error boundary after rerender', () => {
    let shouldThrow = true;
    let capturedSession: Session | null = null;
    const view: ViewDefinition = {
      viewId: 'recover-view',
      version: '1',
      nodes: [{ id: 'field', type: 'field', dataType: 'string' }],
    };
    const map = {
      field: () => {
        if (shouldThrow) {
          throw new Error('first');
        }
        return <div data-testid="recovered-node">ok</div>;
      },
    };

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(view);
      }
      return <ContinuumRenderer view={view} />;
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-continuum-render-error="field"]')
    ).toBeTruthy();

    shouldThrow = false;
    act(() => {
      requireSession(capturedSession).updateState('field', {
        value: 'trigger',
      });
    });

    expect(
      rendered.container.querySelector('[data-continuum-render-error="field"]')
    ).toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="recovered-node"]')
    ).toBeTruthy();
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
    expect(() => finalizedSession.getSnapshot()).toThrow(
      'Session has been destroyed'
    );
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
    const button = rendered.container.querySelector(
      '[data-testid="strict-button"]'
    ) as HTMLButtonElement;
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
          <button
            data-testid="parent-rerender"
            onClick={() => setTick((value) => value + 1)}
          >
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
    const button = rendered.container.querySelector(
      '[data-testid="parent-rerender"]'
    ) as HTMLButtonElement;
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
        (
          session as Session & { onSnapshot: Session['onSnapshot'] }
        ).onSnapshot = ((listener) => {
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
          <button
            data-testid="provider-rerender"
            onClick={() => setTick((value) => value + 1)}
          >
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
    const button = rendered.container.querySelector(
      '[data-testid="provider-rerender"]'
    ) as HTMLButtonElement;
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
      collection: ({
        children,
        onAdd,
        canAdd,
      }: {
        children?: ReactNode;
        onAdd?: () => void;
        canAdd?: boolean;
      }) => (
        <div data-testid="collection-root">
          {children}
          <button
            data-testid="collection-add"
            onClick={onAdd}
            disabled={!canAdd}
          >
            add
          </button>
        </div>
      ),
      group: ({
        children,
        onRemove,
        canRemove,
      }: {
        children?: ReactNode;
        onRemove?: () => void;
        canRemove?: boolean;
      }) => (
        <div data-testid="item-group">
          {children}
          {canRemove ? (
            <button data-testid="collection-remove" onClick={onRemove}>
              remove
            </button>
          ) : null}
        </div>
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

    const initialInputs = rendered.container.querySelectorAll(
      '[data-testid="collection-field"]'
    );
    expect(initialInputs).toHaveLength(1);
    expect((initialInputs[0] as HTMLButtonElement).textContent).toBe('Paris');

    const addButton = rendered.container.querySelector(
      '[data-testid="collection-add"]'
    ) as HTMLButtonElement | null;
    expect(addButton).toBeTruthy();
    if (!addButton) {
      throw new Error('Expected add button to exist');
    }
    act(() => {
      addButton.click();
      addButton.click();
    });

    const twoInputs = rendered.container.querySelectorAll(
      '[data-testid="collection-field"]'
    );
    expect(twoInputs).toHaveLength(3);
    act(() => {
      (twoInputs[2] as HTMLButtonElement).click();
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
    expect(collectionNode.value.items).toHaveLength(3);
    expect(collectionNode.value.items[2].values['address-item/city']).toEqual({
      value: 'Tokyo',
    });

    const removeButton = rendered.container.querySelector(
      '[data-testid="collection-remove"]'
    ) as HTMLButtonElement | null;
    expect(removeButton).toBeTruthy();
    if (!removeButton) {
      throw new Error('Expected remove button to exist');
    }
    act(() => {
      removeButton.click();
    });
    const addressesNode = activeSession.getSnapshot()?.data.values[
      'addresses'
    ] as
      | NodeValue<{ items: Array<{ values: Record<string, NodeValue> }> }>
      | undefined;
    if (!addressesNode) {
      throw new Error('Expected addresses node to exist');
    }
    expect(addressesNode.value.items).toHaveLength(2);
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
            <button
              data-testid="mark-dirty"
              onClick={() => onChange({ value: 'typed', isDirty: true })}
            >
              dirty
            </button>
            <span data-testid="current-value">{value?.value ?? ''}</span>
            {conflict.hasConflict ? (
              <div>
                <button data-testid="accept" onClick={conflict.accept}>
                  Accept
                </button>
                <button data-testid="reject" onClick={conflict.reject}>
                  Reject
                </button>
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
    const dirtyButton = rendered.container.querySelector(
      '[data-testid="mark-dirty"]'
    ) as HTMLButtonElement;
    act(() => {
      dirtyButton.click();
    });

    const activeSession = requireSession(capturedSession);
    act(() => {
      activeSession.proposeValue('field', { value: 'ai-suggested' }, 'ai');
    });

    const acceptButton = rendered.container.querySelector(
      '[data-testid="accept"]'
    ) as HTMLButtonElement;
    expect(acceptButton).toBeTruthy();
    act(() => {
      acceptButton.click();
    });
    const valueAfterAccept = rendered.container.querySelector(
      '[data-testid="current-value"]'
    ) as HTMLSpanElement;
    expect(valueAfterAccept.textContent).toBe('ai-suggested');
    expect(
      rendered.container.querySelector('[data-testid="accept"]')
    ).toBeNull();

    act(() => {
      activeSession.updateState('field', {
        value: 'typed-again',
        isDirty: true,
      });
      activeSession.proposeValue('field', { value: 'ai-new' }, 'ai');
    });
    const rejectButton = rendered.container.querySelector(
      '[data-testid="reject"]'
    ) as HTMLButtonElement;
    expect(rejectButton).toBeTruthy();
    act(() => {
      rejectButton.click();
    });

    const valueAfterReject = rendered.container.querySelector(
      '[data-testid="current-value"]'
    ) as HTMLSpanElement;
    expect(valueAfterReject.textContent).toBe('typed-again');
    expect(
      rendered.container.querySelector('[data-testid="reject"]')
    ).toBeNull();
    rendered.unmount();
  });

  it('isolates nested collection state between parent collection items', () => {
    let clickCount = 0;
    const nestedCollectionView: ViewDefinition = {
      viewId: 'nested-collection-view',
      version: '1',
      nodes: [
        {
          id: 'weeks',
          type: 'collection',
          minItems: 0,
          template: {
            id: 'week_item',
            type: 'group',
            children: [
              {
                id: 'days',
                type: 'collection',
                minItems: 1,
                template: {
                  id: 'day_item',
                  type: 'group',
                  children: [
                    {
                      id: 'day_name',
                      type: 'field',
                      dataType: 'string',
                      defaultValue: 'Untitled',
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };
    const nestedMap = {
      collection: ({
        children,
        onAdd,
        canAdd,
      }: {
        children?: ReactNode;
        onAdd?: () => void;
        canAdd?: boolean;
      }) => (
        <div>
          {children}
          <button data-testid="nested-add" onClick={onAdd} disabled={!canAdd}>
            add
          </button>
        </div>
      ),
      group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      field: ({
        value,
        onChange,
      }: {
        value: NodeValue | undefined;
        onChange: (next: NodeValue) => void;
      }) => (
        <button
          data-testid="nested-field"
          onClick={() => {
            clickCount += 1;
            onChange({ value: `Edited-${clickCount}`, isDirty: true });
          }}
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
        session.pushView(nestedCollectionView);
      }
      return <ContinuumRenderer view={nestedCollectionView} />;
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={nestedMap}>
        <App />
      </ContinuumProvider>
    );

    const activeSession = requireSession(capturedSession);

    const weeksAddButton = rendered.container.querySelector(
      '[data-testid="nested-add"]'
    ) as HTMLButtonElement;
    expect(weeksAddButton).toBeTruthy();

    act(() => {
      weeksAddButton.click();
    });
    act(() => {
      weeksAddButton.click();
    });

    const buttons = rendered.container.querySelectorAll(
      '[data-testid="nested-field"]'
    );
    expect(buttons).toHaveLength(2);

    const week1DayButton = buttons[0] as HTMLButtonElement;
    const week2DayButton = buttons[1] as HTMLButtonElement;
    expect(week1DayButton.textContent).toBe('Untitled');
    expect(week2DayButton.textContent).toBe('Untitled');

    act(() => {
      week1DayButton.click();
    });

    const buttonsAfterEdit = rendered.container.querySelectorAll(
      '[data-testid="nested-field"]'
    );
    expect((buttonsAfterEdit[0] as HTMLButtonElement).textContent).toBe(
      'Edited-1'
    );
    expect((buttonsAfterEdit[1] as HTMLButtonElement).textContent).toBe(
      'Untitled'
    );

    act(() => {
      (buttonsAfterEdit[1] as HTMLButtonElement).click();
    });

    const buttonsAfterBothEdits = rendered.container.querySelectorAll(
      '[data-testid="nested-field"]'
    );
    expect((buttonsAfterBothEdits[0] as HTMLButtonElement).textContent).toBe(
      'Edited-1'
    );
    expect((buttonsAfterBothEdits[1] as HTMLButtonElement).textContent).toBe(
      'Edited-2'
    );

    const snapshot = activeSession.getSnapshot();
    const weeksNode = snapshot?.data.values['weeks'] as
      | NodeValue<{ items: Array<{ values: Record<string, NodeValue> }> }>
      | undefined;
    expect(weeksNode).toBeDefined();
    if (!weeksNode) throw new Error('Expected weeks node');
    expect(weeksNode.value.items).toHaveLength(2);

    rendered.unmount();
  });

  it('deep-clones nested collection defaults so siblings never share references', () => {
    let clickCount = 0;
    const deepNestedView: ViewDefinition = {
      viewId: 'deep-nested-view',
      version: '1',
      nodes: [
        {
          id: 'weeks',
          type: 'collection',
          minItems: 2,
          template: {
            id: 'week_item',
            type: 'group',
            children: [
              {
                id: 'days',
                type: 'collection',
                minItems: 1,
                template: {
                  id: 'day_item',
                  type: 'group',
                  children: [
                    {
                      id: 'task',
                      type: 'field',
                      dataType: 'string',
                      defaultValue: '',
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };

    const deepMap = {
      collection: ({
        children,
        onAdd,
        canAdd,
        definition,
      }: {
        children?: ReactNode;
        onAdd?: () => void;
        canAdd?: boolean;
        definition: { id: string };
      }) => (
        <div data-collection={definition.id}>
          {children}
          <button
            data-testid={`add-${definition.id}`}
            onClick={onAdd}
            disabled={!canAdd}
          >
            add
          </button>
        </div>
      ),
      group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      field: ({
        value,
        onChange,
      }: {
        value: NodeValue | undefined;
        onChange: (next: NodeValue) => void;
      }) => (
        <button
          data-testid="task-field"
          onClick={() => {
            clickCount += 1;
            onChange({ value: `Task-${clickCount}`, isDirty: true });
          }}
        >
          {readStringNodeValue(value)}
        </button>
      ),
    };

    function DeepApp() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) {
        session.pushView(deepNestedView);
      }
      return <ContinuumRenderer view={deepNestedView} />;
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={deepMap}>
        <DeepApp />
      </ContinuumProvider>
    );

    const taskFields = rendered.container.querySelectorAll(
      '[data-testid="task-field"]'
    );
    expect(taskFields).toHaveLength(2);

    act(() => {
      (taskFields[0] as HTMLButtonElement).click();
    });

    const fieldsAfter = rendered.container.querySelectorAll(
      '[data-testid="task-field"]'
    );
    expect((fieldsAfter[0] as HTMLButtonElement).textContent).toBe('Task-1');
    expect((fieldsAfter[1] as HTMLButtonElement).textContent).toBe('');

    const addDaysButtons = rendered.container.querySelectorAll(
      '[data-testid="add-days"]'
    );
    expect(addDaysButtons.length).toBeGreaterThanOrEqual(2);
    act(() => {
      (addDaysButtons[0] as HTMLButtonElement).click();
    });

    const fieldsAfterAdd = rendered.container.querySelectorAll(
      '[data-testid="task-field"]'
    );
    expect(fieldsAfterAdd).toHaveLength(3);
    expect((fieldsAfterAdd[0] as HTMLButtonElement).textContent).toBe('Task-1');
    expect((fieldsAfterAdd[1] as HTMLButtonElement).textContent).toBe('');
    expect((fieldsAfterAdd[2] as HTMLButtonElement).textContent).toBe('');

    rendered.unmount();
  });

  it('maintains independent state across 30-deep nested collections', () => {
    const DEPTH = 30;
    let clickCount = 0;

    function buildNestedView(depth: number): ViewNode {
      if (depth === 0) {
        return {
          id: 'leaf',
          type: 'field' as const,
          dataType: 'string',
          defaultValue: '',
        } as ViewNode;
      }
      return {
        id: `col_${depth}`,
        type: 'collection' as const,
        minItems: 1,
        template: {
          id: `item_${depth}`,
          type: 'group' as const,
          children: [buildNestedView(depth - 1)],
        },
      } as ViewNode;
    }

    const deepView: ViewDefinition = {
      viewId: 'deep-30-view',
      version: '1',
      nodes: [buildNestedView(DEPTH)],
    };

    const deepMap = {
      collection: ({
        children,
        onAdd,
        canAdd,
        definition,
      }: {
        children?: ReactNode;
        onAdd?: () => void;
        canAdd?: boolean;
        definition: { id: string };
      }) => (
        <div data-col={definition.id}>
          {children}
          <button
            data-testid={`add-${definition.id}`}
            onClick={onAdd}
            disabled={!canAdd}
          >
            +
          </button>
        </div>
      ),
      group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      field: ({
        value,
        onChange,
      }: {
        value: NodeValue | undefined;
        onChange: (next: NodeValue) => void;
      }) => (
        <button
          data-testid="deep-leaf"
          onClick={() => {
            clickCount += 1;
            onChange({ value: `v${clickCount}`, isDirty: true });
          }}
        >
          {readStringNodeValue(value)}
        </button>
      ),
    };

    function DeepApp() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) {
        session.pushView(deepView);
      }
      return <ContinuumRenderer view={deepView} />;
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={deepMap}>
        <DeepApp />
      </ContinuumProvider>
    );

    const singleLeaf = rendered.container.querySelectorAll(
      '[data-testid="deep-leaf"]'
    );
    expect(singleLeaf).toHaveLength(1);
    expect((singleLeaf[0] as HTMLButtonElement).textContent).toBe('');

    act(() => {
      (singleLeaf[0] as HTMLButtonElement).click();
    });

    const leafAfterEdit = rendered.container.querySelectorAll(
      '[data-testid="deep-leaf"]'
    );
    expect((leafAfterEdit[0] as HTMLButtonElement).textContent).toBe('v1');

    const topCollectionAdd = rendered.container.querySelector(
      `[data-testid="add-col_${DEPTH}"]`
    ) as HTMLButtonElement;
    expect(topCollectionAdd).toBeTruthy();
    act(() => {
      topCollectionAdd.click();
    });

    const leavesAfterAdd = rendered.container.querySelectorAll(
      '[data-testid="deep-leaf"]'
    );
    expect(leavesAfterAdd).toHaveLength(2);
    expect((leavesAfterAdd[0] as HTMLButtonElement).textContent).toBe('v1');
    expect((leavesAfterAdd[1] as HTMLButtonElement).textContent).toBe('');

    act(() => {
      (leavesAfterAdd[1] as HTMLButtonElement).click();
    });

    const leavesFinal = rendered.container.querySelectorAll(
      '[data-testid="deep-leaf"]'
    );
    expect((leavesFinal[0] as HTMLButtonElement).textContent).toBe('v1');
    expect((leavesFinal[1] as HTMLButtonElement).textContent).toBe('v2');

    rendered.unmount();
  });

  it('does not render suggestion for regular key cross-level top-to-collection migration', () => {
    const priorView: ViewDefinition = {
      viewId: 'suggestion-view',
      version: '1',
      nodes: [
        { id: 'status', type: 'field', key: 'status', dataType: 'string' },
        {
          id: 'items',
          type: 'collection',
          template: {
            id: 'row',
            type: 'group',
            children: [{ id: 'title', type: 'field', dataType: 'string' }],
          },
        },
      ],
    };
    const nextView: ViewDefinition = {
      viewId: 'suggestion-view',
      version: '2',
      nodes: [
        {
          id: 'items',
          type: 'collection',
          minItems: 1,
          template: {
            id: 'row',
            type: 'group',
            children: [
              {
                id: 'status_in_item',
                type: 'field',
                key: 'status',
                dataType: 'string',
              },
              { id: 'title', type: 'field', dataType: 'string' },
            ],
          },
        },
      ],
    };

    const map = {
      collection: ({ children }: { children?: ReactNode }) => (
        <div>{children}</div>
      ),
      group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      field: ({ value }: { value: NodeValue | undefined }) => (
        <div data-testid="suggestion-field">{`${String(value?.value)}|${String(
          value?.suggestion
        )}`}</div>
      ),
    };

    function App() {
      const session = useContinuumSession();
      const [step, setStep] = useState(0);
      if (!session.getSnapshot()) {
        session.pushView(priorView);
        session.updateState('status', { value: 'archived', isDirty: true });
      }
      return (
        <div>
          <button
            data-testid="next-step"
            onClick={() => {
              if (step === 0) {
                session.pushView(nextView);
                setStep(1);
              }
            }}
          >
            next
          </button>
          <ContinuumRenderer view={step === 0 ? priorView : nextView} />
        </div>
      );
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );

    const nextButton = rendered.container.querySelector(
      '[data-testid="next-step"]'
    ) as HTMLButtonElement;
    act(() => {
      nextButton.click();
    });

    const fields = rendered.container.querySelectorAll(
      '[data-testid="suggestion-field"]'
    );
    expect(fields.length).toBeGreaterThanOrEqual(1);
    expect((fields[0] as HTMLDivElement).textContent).toBe(
      'undefined|undefined'
    );

    rendered.unmount();
  });

  it('accepting suggestion updates value and clears suggestion via useContinuumSuggestions', () => {
    const suggestionView: ViewDefinition = {
      viewId: 'accept-suggestion-view',
      version: '1',
      nodes: [
        { id: 'title', type: 'field', dataType: 'string' },
        { id: 'author', type: 'field', dataType: 'string' },
      ],
    };

    let capturedSession: Session | null = null;
    let hasSuggestions = false;
    let acceptAll: (() => void) | null = null;

    const map = {
      field: ({
        value,
        definition,
      }: {
        value: NodeValue | undefined;
        definition: { id: string };
      }) => (
        <div
          data-testid={`field-${definition.id}`}
          data-value={String(value?.value ?? '')}
          data-suggestion={String(value?.suggestion ?? '')}
        />
      ),
    };

    function App() {
      const session = useContinuumSession();
      const suggestions = useContinuumSuggestions();
      capturedSession = session;
      hasSuggestions = suggestions.hasSuggestions;
      acceptAll = suggestions.acceptAll;
      if (!session.getSnapshot()) {
        session.pushView(suggestionView);
        session.updateState('title', { value: 'Old Title', isDirty: true });
        session.updateState('author', { value: 'Old Author', isDirty: true });
      }
      return <ContinuumRenderer view={suggestionView} />;
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );

    expect(hasSuggestions).toBe(false);

    act(() => {
      requireSession(capturedSession).updateState('title', {
        value: 'Old Title',
        suggestion: 'New Title',
        isDirty: true,
      });
      requireSession(capturedSession).updateState('author', {
        value: 'Old Author',
        suggestion: 'New Author',
        isDirty: true,
      });
    });

    expect(hasSuggestions).toBe(true);

    const titleEl = rendered.container.querySelector(
      '[data-testid="field-title"]'
    ) as HTMLElement;
    const authorEl = rendered.container.querySelector(
      '[data-testid="field-author"]'
    ) as HTMLElement;
    expect(titleEl.getAttribute('data-value')).toBe('Old Title');
    expect(titleEl.getAttribute('data-suggestion')).toBe('New Title');

    act(() => {
      acceptAll!();
    });

    expect(hasSuggestions).toBe(false);
    const snapshot = requireSession(capturedSession).getSnapshot();
    expect(
      (snapshot?.data.values['title'] as NodeValue | undefined)?.value
    ).toBe('New Title');
    expect(
      (snapshot?.data.values['title'] as NodeValue | undefined)?.suggestion
    ).toBeUndefined();
    expect(
      (snapshot?.data.values['author'] as NodeValue | undefined)?.value
    ).toBe('New Author');
    expect(
      (snapshot?.data.values['author'] as NodeValue | undefined)?.suggestion
    ).toBeUndefined();

    rendered.unmount();
  });

  it('renders direct value for semanticKey top-to-collection migration', () => {
    const priorView: ViewDefinition = {
      viewId: 'semantic-view',
      version: '1',
      nodes: [
        {
          id: 'owner',
          type: 'field',
          semanticKey: 'task.owner',
          dataType: 'string',
        },
      ],
    };
    const nextView: ViewDefinition = {
      viewId: 'semantic-view',
      version: '2',
      nodes: [
        {
          id: 'tasks',
          type: 'collection',
          minItems: 1,
          template: {
            id: 'row',
            type: 'group',
            children: [
              {
                id: 'owner',
                type: 'field',
                semanticKey: 'task.owner',
                dataType: 'string',
              },
            ],
          },
        },
      ],
    };
    const map = {
      collection: ({ children }: { children?: ReactNode }) => (
        <div>{children}</div>
      ),
      group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      field: ({ value }: { value: NodeValue | undefined }) => (
        <div data-testid="semantic-field">{`${String(value?.value)}|${String(
          value?.suggestion
        )}`}</div>
      ),
    };
    function App() {
      const session = useContinuumSession();
      const [step, setStep] = useState(0);
      if (!session.getSnapshot()) {
        session.pushView(priorView);
        session.updateState('owner', { value: 'Casey', isDirty: true });
      }
      return (
        <div>
          <button
            data-testid="next-step-semantic"
            onClick={() => {
              if (step === 0) {
                session.pushView(nextView);
                setStep(1);
              }
            }}
          >
            next
          </button>
          <ContinuumRenderer view={step === 0 ? priorView : nextView} />
        </div>
      );
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    const nextButton = rendered.container.querySelector(
      '[data-testid="next-step-semantic"]'
    ) as HTMLButtonElement;
    act(() => {
      nextButton.click();
    });
    const fields = rendered.container.querySelectorAll(
      '[data-testid="semantic-field"]'
    );
    expect(fields.length).toBeGreaterThanOrEqual(1);
    expect((fields[0] as HTMLDivElement).textContent).toBe('Casey|undefined');
    rendered.unmount();
  });

  it('deep nested collection does not receive suggestion at leaf component', () => {
    const priorView: ViewDefinition = {
      viewId: 'deep-suggestion-view',
      version: '1',
      nodes: [
        { id: 'status', type: 'field', key: 'status', dataType: 'string' },
      ],
    };
    const nextView: ViewDefinition = {
      viewId: 'deep-suggestion-view',
      version: '2',
      nodes: [
        {
          id: 'level_2',
          type: 'collection',
          minItems: 1,
          template: {
            id: 'item_2',
            type: 'group',
            children: [
              {
                id: 'level_1',
                type: 'collection',
                minItems: 1,
                template: {
                  id: 'item_1',
                  type: 'group',
                  children: [
                    {
                      id: 'leaf',
                      type: 'field',
                      key: 'status',
                      dataType: 'string',
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };
    const map = {
      collection: ({ children }: { children?: ReactNode }) => (
        <div>{children}</div>
      ),
      group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      field: ({ value }: { value: NodeValue | undefined }) => (
        <div data-testid="deep-suggestion">{`${String(value?.value)}|${String(
          value?.suggestion
        )}`}</div>
      ),
    };
    function App() {
      const session = useContinuumSession();
      const [step, setStep] = useState(0);
      if (!session.getSnapshot()) {
        session.pushView(priorView);
        session.updateState('status', { value: 'ready', isDirty: true });
      }
      return (
        <div>
          <button
            data-testid="next-step-deep"
            onClick={() => {
              if (step === 0) {
                session.pushView(nextView);
                setStep(1);
              }
            }}
          >
            next
          </button>
          <ContinuumRenderer view={step === 0 ? priorView : nextView} />
        </div>
      );
    }

    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    const nextButton = rendered.container.querySelector(
      '[data-testid="next-step-deep"]'
    ) as HTMLButtonElement;
    act(() => {
      nextButton.click();
    });
    const fields = rendered.container.querySelectorAll(
      '[data-testid="deep-suggestion"]'
    );
    expect(fields.length).toBeGreaterThanOrEqual(1);
    expect((fields[0] as HTMLDivElement).textContent).toBe(
      'undefined|undefined'
    );
    rendered.unmount();
  });
});

describe('provider lifecycle integration', () => {
  const componentMap = {
    field: ({
      value,
      definition,
    }: {
      value: NodeValue | undefined;
      definition: { id: string };
    }) => (
      <div data-testid={`field-${definition.id}`}>
        {typeof value?.value === 'string' ? value.value : ''}
      </div>
    ),
  };

  const simpleView: ViewDefinition = {
    viewId: 'lifecycle-view',
    version: '1',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
  };

  it('creates a new session when no storage provided', () => {
    let session: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      session = useContinuumSession();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(session).not.toBeNull();
    expect(typeof requireSession(session).pushView).toBe('function');
    rendered.unmount();
  });

  it('session is the same object across re-renders of provider', () => {
    const sessions: ReturnType<typeof useContinuumSession>[] = [];
    function App() {
      sessions.push(useContinuumSession());
      return null;
    }
    function Shell() {
      const [, setTick] = useState(0);
      return (
        <div>
          <button data-testid="tick" onClick={() => setTick((t) => t + 1)} />
          <ContinuumProvider components={componentMap}>
            <App />
          </ContinuumProvider>
        </div>
      );
    }
    const rendered = renderIntoDom(<Shell />);
    act(() => {
      (
        rendered.container.querySelector(
          '[data-testid="tick"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions[0]).toBe(sessions[sessions.length - 1]);
    rendered.unmount();
  });

  it('destroys session after unmount (with timer flush)', () => {
    vi.useFakeTimers();
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const sess = requireSession(capturedSession);
    expect(sess.isDestroyed).toBe(false);
    rendered.unmount();
    vi.runAllTimers();
    expect(sess.isDestroyed).toBe(true);
    vi.useRealTimers();
  });

  it('session is not immediately destroyed after unmount (deferred)', () => {
    vi.useFakeTimers();
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    rendered.unmount();
    expect(requireSession(capturedSession).isDestroyed).toBe(false);
    vi.runAllTimers();
    expect(requireSession(capturedSession).isDestroyed).toBe(true);
    vi.useRealTimers();
  });

  it('wasHydrated is false when no storage key present', () => {
    localStorage.clear();
    let wasHydrated = true;
    function App() {
      wasHydrated = useContinuumHydrated();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={componentMap}
        persist="localStorage"
        storageKey="no-such-key"
      >
        <App />
      </ContinuumProvider>
    );
    expect(wasHydrated).toBe(false);
    rendered.unmount();
  });

  it('wasHydrated is true when storage key exists', () => {
    const seed = createSession();
    seed.pushView(simpleView);
    seed.updateState('f1', { value: 'persisted-val' });
    localStorage.setItem(
      'provider-lifecycle-key',
      JSON.stringify(seed.serialize())
    );
    let wasHydrated = false;
    function App() {
      wasHydrated = useContinuumHydrated();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={componentMap}
        persist="localStorage"
        storageKey="provider-lifecycle-key"
      >
        <App />
      </ContinuumProvider>
    );
    expect(wasHydrated).toBe(true);
    localStorage.removeItem('provider-lifecycle-key');
    rendered.unmount();
  });

  it('restores correct state from localStorage on hydration', () => {
    const seed = createSession();
    seed.pushView(simpleView);
    seed.updateState('f1', { value: 'from-ls' });
    localStorage.setItem(
      'hydration-test-key',
      JSON.stringify(seed.serialize())
    );
    let snapshot: ContinuitySnapshot | null = null;
    function App() {
      snapshot = useContinuumSnapshot();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={componentMap}
        persist="localStorage"
        storageKey="hydration-test-key"
      >
        <App />
      </ContinuumProvider>
    );
    expect((snapshot?.data.values['f1'] as NodeValue | undefined)?.value).toBe(
      'from-ls'
    );
    localStorage.removeItem('hydration-test-key');
    rendered.unmount();
  });

  it('restores correct state from sessionStorage on hydration', () => {
    const seed = createSession();
    seed.pushView(simpleView);
    seed.updateState('f1', { value: 'from-ss' });
    sessionStorage.setItem(
      'ss-hydration-key',
      JSON.stringify(seed.serialize())
    );
    let snapshot: ContinuitySnapshot | null = null;
    function App() {
      snapshot = useContinuumSnapshot();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={componentMap}
        persist="sessionStorage"
        storageKey="ss-hydration-key"
      >
        <App />
      </ContinuumProvider>
    );
    expect((snapshot?.data.values['f1'] as NodeValue | undefined)?.value).toBe(
      'from-ss'
    );
    sessionStorage.removeItem('ss-hydration-key');
    rendered.unmount();
  });

  it('does not write to storage when persist is false', () => {
    vi.useFakeTimers();
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={componentMap}
        persist={false}
        storageKey="no-persist-key"
      >
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'should-not-persist',
      });
      vi.runAllTimers();
    });
    expect(localStorage.getItem('no-persist-key')).toBeNull();
    expect(sessionStorage.getItem('no-persist-key')).toBeNull();
    rendered.unmount();
    vi.useRealTimers();
  });

  it('persists state to localStorage after timer fires', () => {
    vi.useFakeTimers();
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={componentMap}
        persist="localStorage"
        storageKey="persist-timer-key"
      >
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'written-val',
      });
      vi.runAllTimers();
    });
    expect(localStorage.getItem('persist-timer-key')).not.toBeNull();
    localStorage.removeItem('persist-timer-key');
    rendered.unmount();
    vi.useRealTimers();
  });

  it('two providers are independent sessions', () => {
    let sessionA: ReturnType<typeof useContinuumSession> | null = null;
    let sessionB: ReturnType<typeof useContinuumSession> | null = null;
    function AppA() {
      sessionA = useContinuumSession();
      return null;
    }
    function AppB() {
      sessionB = useContinuumSession();
      return null;
    }
    const renderedA = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <AppA />
      </ContinuumProvider>
    );
    const renderedB = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <AppB />
      </ContinuumProvider>
    );
    expect(requireSession(sessionA)).not.toBe(requireSession(sessionB));
    act(() => {
      requireSession(sessionA).pushView(simpleView);
      requireSession(sessionA).updateState('f1', { value: 'session-a' });
    });
    expect(requireSession(sessionB).getSnapshot()).toBeNull();
    renderedA.unmount();
    renderedB.unmount();
  });

  it('provider exposes session via useContinuumSession from any depth', () => {
    let deepSession: ReturnType<typeof useContinuumSession> | null = null;
    function Deep() {
      deepSession = useContinuumSession();
      return null;
    }
    function Middle() {
      return (
        <div>
          <Deep />
        </div>
      );
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <div>
          <div>
            <Middle />
          </div>
        </div>
      </ContinuumProvider>
    );
    expect(deepSession).not.toBeNull();
    rendered.unmount();
  });

  it('snapshot starts null before pushView', () => {
    let snapshot: ContinuitySnapshot | null = undefined as unknown as null;
    function App() {
      snapshot = useContinuumSnapshot();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(snapshot).toBeNull();
    rendered.unmount();
  });

  it('snapshot becomes non-null after pushView', () => {
    let snapshot: ContinuitySnapshot | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      snapshot = useContinuumSnapshot();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(snapshot).toBeNull();
    act(() => {
      requireSession(capturedSession).pushView(simpleView);
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot?.view.viewId).toBe('lifecycle-view');
    rendered.unmount();
  });

  it('snapshot becomes null again after reset', () => {
    let snapshot: ContinuitySnapshot | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let hasPushed = false;
    function App() {
      capturedSession = useContinuumSession();
      if (!hasPushed) {
        capturedSession.pushView(simpleView);
        hasPushed = true;
      }
      snapshot = useContinuumSnapshot();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(snapshot).not.toBeNull();
    act(() => {
      requireSession(capturedSession).reset();
    });
    expect(snapshot).toBeNull();
    rendered.unmount();
  });

  it('useContinuumSession throws with clear message outside provider', () => {
    function Orphan() {
      useContinuumSession();
      return null;
    }
    expect(() => renderIntoDom(<Orphan />)).toThrow('<ContinuumProvider>');
  });

  it('useContinuumSnapshot throws with clear message outside provider', () => {
    function Orphan() {
      useContinuumSnapshot();
      return null;
    }
    expect(() => renderIntoDom(<Orphan />)).toThrow('<ContinuumProvider>');
  });

  it('useContinuumHydrated throws with clear message outside provider', () => {
    function Orphan() {
      useContinuumHydrated();
      return null;
    }
    expect(() => renderIntoDom(<Orphan />)).toThrow('<ContinuumProvider>');
  });

  it('useContinuumDiagnostics throws outside provider', () => {
    function Orphan() {
      useContinuumDiagnostics();
      return null;
    }
    expect(() => renderIntoDom(<Orphan />)).toThrow('<ContinuumProvider>');
  });

  it('componentMap updates trigger context value change', () => {
    const maps: object[] = [];
    const compA = () => <div data-testid="comp-a" />;
    const compB = () => <div data-testid="comp-b" />;
    function App() {
      const ctx = React.useContext(ContinuumContext);
      if (ctx) maps.push(ctx.componentMap);
      return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <ContinuumProvider components={{ field: compA }}>
          <App />
        </ContinuumProvider>
      );
    });
    act(() => {
      root.render(
        <ContinuumProvider components={{ field: compB }}>
          <App />
        </ContinuumProvider>
      );
    });
    expect(maps.length).toBeGreaterThanOrEqual(2);
    expect(maps[0]).not.toBe(maps[maps.length - 1]);
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('identical componentMap does not create a new context value reference', () => {
    const maps: object[] = [];
    const fieldComp = () => <div />;
    function App() {
      const ctx = React.useContext(ContinuumContext);
      if (ctx) maps.push(ctx.componentMap);
      return null;
    }
    function Shell() {
      const [, setTick] = useState(0);
      return (
        <div>
          <button data-testid="tick" onClick={() => setTick((t) => t + 1)} />
          <ContinuumProvider components={{ field: fieldComp }}>
            <App />
          </ContinuumProvider>
        </div>
      );
    }
    const rendered = renderIntoDom(<Shell />);
    act(() => {
      (
        rendered.container.querySelector(
          '[data-testid="tick"]'
        ) as HTMLButtonElement
      ).click();
    });
    const unique = new Set(maps);
    expect(unique.size).toBe(1);
    rendered.unmount();
  });

  it('sessionOptions.actions are registered and callable', async () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    const actionView: ViewDefinition = {
      viewId: 'action-view',
      version: '1',
      nodes: [
        { id: 'btn', type: 'action', intentId: 'say_hello', label: 'Go' },
      ],
    };
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(actionView);
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={{
          ...componentMap,
          action: () => <button data-testid="action-btn" />,
        }}
        sessionOptions={{
          actions: {
            say_hello: {
              registration: { label: 'Hello' },
              handler: () => ({ success: true, data: 'hello' }),
            },
          },
        }}
      >
        <App />
      </ContinuumProvider>
    );
    const result = await act(async () =>
      requireSession(capturedSession).dispatchAction('say_hello', 'btn')
    );
    expect(result.success).toBe(true);
    expect(result.data).toBe('hello');
    rendered.unmount();
  });
});

describe('renderer node routing integration', () => {
  const fieldMap = {
    field: ({
      value,
      definition,
      nodeId,
    }: {
      value: NodeValue | undefined;
      definition: { id: string };
      nodeId?: string;
    }) => (
      <div data-testid={`field-${definition.id}`} data-nodeid={nodeId}>
        {typeof value?.value === 'string' ? value.value : ''}
      </div>
    ),
    group: ({
      children,
      nodeId,
    }: {
      children?: ReactNode;
      nodeId?: string;
    }) => (
      <div data-testid={`group-${nodeId ?? 'unknown'}`} data-nodeid={nodeId}>
        {children}
      </div>
    ),
    default: ({ definition }: { definition: { type: string; id: string } }) => (
      <div
        data-testid={`default-${definition.id}`}
        data-type={definition.type}
      />
    ),
  };

  it('renders leaf field node', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [{ id: 'name', type: 'field', dataType: 'string' } as ViewNode],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="field-name"]')
    ).toBeTruthy();
    rendered.unmount();
  });

  it('renders group node with children', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        {
          id: 'section',
          type: 'group',
          children: [{ id: 'inner', type: 'field', dataType: 'string' }],
        } as ViewNode,
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="field-inner"]')
    ).toBeTruthy();
    rendered.unmount();
  });

  it('passes correct canonical nodeId for top-level field', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [{ id: 'top', type: 'field', dataType: 'string' } as ViewNode],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    const el = rendered.container.querySelector('[data-testid="field-top"]');
    expect(el?.getAttribute('data-nodeid')).toBe('top');
    rendered.unmount();
  });

  it('passes correct canonical nodeId for nested field', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        {
          id: 'parent',
          type: 'group',
          children: [{ id: 'child', type: 'field', dataType: 'string' }],
        } as ViewNode,
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    const el = rendered.container.querySelector('[data-testid="field-child"]');
    expect(el?.getAttribute('data-nodeid')).toBe('parent/child');
    rendered.unmount();
  });

  it('passes correct canonical nodeId for deeply nested field', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        {
          id: 'a',
          type: 'group',
          children: [
            {
              id: 'b',
              type: 'group',
              children: [{ id: 'c', type: 'field', dataType: 'string' }],
            },
          ],
        } as ViewNode,
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    const el = rendered.container.querySelector('[data-testid="field-c"]');
    expect(el?.getAttribute('data-nodeid')).toBe('a/b/c');
    rendered.unmount();
  });

  it('does not render hidden leaf field', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        {
          id: 'hidden-f',
          type: 'field',
          dataType: 'string',
          hidden: true,
        } as ViewNode,
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="field-hidden-f"]')
    ).toBeNull();
    rendered.unmount();
  });

  it('does not render hidden group node or its children', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        {
          id: 'hidden-g',
          type: 'group',
          hidden: true,
          children: [
            { id: 'child-of-hidden', type: 'field', dataType: 'string' },
          ],
        } as ViewNode,
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="field-child-of-hidden"]')
    ).toBeNull();
    rendered.unmount();
  });

  it('renders multiple sibling nodes', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        { id: 'f1', type: 'field', dataType: 'string' } as ViewNode,
        { id: 'f2', type: 'field', dataType: 'string' } as ViewNode,
        { id: 'f3', type: 'field', dataType: 'string' } as ViewNode,
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="field-f1"]')
    ).toBeTruthy();
    expect(
      rendered.container.querySelector('[data-testid="field-f2"]')
    ).toBeTruthy();
    expect(
      rendered.container.querySelector('[data-testid="field-f3"]')
    ).toBeTruthy();
    rendered.unmount();
  });

  it('uses FallbackComponent when type not in componentMap', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        {
          id: 'widget',
          type: 'custom_widget',
          dataType: 'string',
        } as unknown as ViewNode,
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={{}}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector(
        '[data-continuum-fallback="custom_widget"]'
      )
    ).toBeTruthy();
    rendered.unmount();
  });

  it('uses default component when type not in map but default provided', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        {
          id: 'mystery',
          type: 'custom_type',
          dataType: 'string',
        } as unknown as ViewNode,
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    const el = rendered.container.querySelector(
      '[data-testid="default-mystery"]'
    );
    expect(el).toBeTruthy();
    expect(el?.getAttribute('data-type')).toBe('custom_type');
    rendered.unmount();
  });

  it('renders view with null nodes gracefully', () => {
    const view = {
      viewId: 'v',
      version: '1',
      nodes: null,
    } as unknown as ViewDefinition;
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(rendered.container.childElementCount).toBe(0);
    rendered.unmount();
  });

  it('renders empty view without errors', () => {
    const view: ViewDefinition = { viewId: 'v', version: '1', nodes: [] };
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(rendered.container.childElementCount).toBe(0);
    rendered.unmount();
  });

  it('leaf node reads state from session via useContinuumState', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [{ id: 'val', type: 'field', dataType: 'string' } as ViewNode],
    };
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(view);
      return <ContinuumRenderer view={view} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('val', { value: 'hello' });
    });
    expect(
      rendered.container.querySelector('[data-testid="field-val"]')?.textContent
    ).toBe('hello');
    rendered.unmount();
  });

  it('leaf node onChange calls session.updateState', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [{ id: 'editme', type: 'field', dataType: 'string' } as ViewNode],
    };
    const map = {
      field: ({
        onChange,
        definition,
      }: {
        onChange: (v: NodeValue) => void;
        definition: { id: string };
      }) => (
        <button
          data-testid={`btn-${definition.id}`}
          onClick={() => onChange({ value: 'clicked', isDirty: true })}
        >
          click
        </button>
      ),
    };
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(view);
      return <ContinuumRenderer view={view} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      (
        rendered.container.querySelector(
          '[data-testid="btn-editme"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      requireSession(capturedSession).getSnapshot()?.data.values['editme']
    ).toEqual({ value: 'clicked', isDirty: true });
    rendered.unmount();
  });

  it('container node receives undefined value and noop onChange', () => {
    let receivedValue: unknown = 'unset';
    let receivedOnChange: unknown = null;
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        {
          id: 'grp',
          type: 'group',
          children: [{ id: 'f', type: 'field', dataType: 'string' }],
        } as ViewNode,
      ],
    };
    const map = {
      group: ({
        value,
        onChange,
        children,
      }: {
        value: unknown;
        onChange: unknown;
        children?: ReactNode;
      }) => {
        receivedValue = value;
        receivedOnChange = onChange;
        return <div>{children}</div>;
      },
      field: () => <div />,
    };
    renderIntoDom(
      <ContinuumProvider components={map}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(receivedValue).toBeUndefined();
    expect(typeof receivedOnChange).toBe('function');
  });

  it('definition props are forwarded to rendered component', () => {
    let capturedPlaceholder = '';
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        {
          id: 'ph',
          type: 'field',
          dataType: 'string',
          placeholder: 'Enter here',
        } as unknown as ViewNode,
      ],
    };
    const map = {
      field: ({ definition }: { definition: { placeholder?: string } }) => {
        capturedPlaceholder = definition.placeholder ?? '';
        return <div />;
      },
    };
    renderIntoDom(
      <ContinuumProvider components={map}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(capturedPlaceholder).toBe('Enter here');
  });

  it('view can be swapped and new nodes render correctly', () => {
    const viewA: ViewDefinition = {
      viewId: 'va',
      version: '1',
      nodes: [{ id: 'fa', type: 'field', dataType: 'string' } as ViewNode],
    };
    const viewB: ViewDefinition = {
      viewId: 'vb',
      version: '1',
      nodes: [{ id: 'fb', type: 'field', dataType: 'string' } as ViewNode],
    };
    function App() {
      const [step, setStep] = useState(0);
      return (
        <div>
          <button data-testid="swap" onClick={() => setStep(1)} />
          <ContinuumRenderer view={step === 0 ? viewA : viewB} />
        </div>
      );
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <App />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="field-fa"]')
    ).toBeTruthy();
    act(() => {
      (
        rendered.container.querySelector(
          '[data-testid="swap"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      rendered.container.querySelector('[data-testid="field-fa"]')
    ).toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="field-fb"]')
    ).toBeTruthy();
    rendered.unmount();
  });

  it('multiple ContinuumRenderer instances in same provider render independently', () => {
    const viewA: ViewDefinition = {
      viewId: 'va',
      version: '1',
      nodes: [{ id: 'r1', type: 'field', dataType: 'string' } as ViewNode],
    };
    const viewB: ViewDefinition = {
      viewId: 'vb',
      version: '1',
      nodes: [{ id: 'r2', type: 'field', dataType: 'string' } as ViewNode],
    };
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(viewA);
      return (
        <div>
          <ContinuumRenderer view={viewA} />
          <ContinuumRenderer view={viewB} />
        </div>
      );
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <App />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="field-r1"]')
    ).toBeTruthy();
    expect(
      rendered.container.querySelector('[data-testid="field-r2"]')
    ).toBeTruthy();
    rendered.unmount();
  });

  it('hidden node mixed with visible siblings only hides the hidden one', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        { id: 'visible', type: 'field', dataType: 'string' } as ViewNode,
        {
          id: 'invisible',
          type: 'field',
          dataType: 'string',
          hidden: true,
        } as ViewNode,
        { id: 'also-visible', type: 'field', dataType: 'string' } as ViewNode,
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={fieldMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="field-visible"]')
    ).toBeTruthy();
    expect(
      rendered.container.querySelector('[data-testid="field-invisible"]')
    ).toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="field-also-visible"]')
    ).toBeTruthy();
    rendered.unmount();
  });

  it('throws when ContinuumRenderer used outside provider', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [{ id: 'f', type: 'field', dataType: 'string' } as ViewNode],
    };
    expect(() => renderIntoDom(<ContinuumRenderer view={view} />)).toThrow(
      '<ContinuumProvider>'
    );
  });
});

describe('collection integration', () => {
  type CollectionValue = NodeValue<{
    items: Array<{ values: Record<string, NodeValue> }>;
  }>;

  function makeColMap(overrides?: Record<string, React.ComponentType<any>>) {
    return {
      collection: ({
        children,
        onAdd,
        onRemove,
        canAdd,
        canRemove,
        definition,
      }: {
        children?: ReactNode;
        onAdd?: () => void;
        onRemove?: (i: number) => void;
        canAdd?: boolean;
        canRemove?: boolean;
        definition: { id: string };
      }) => (
        <div data-testid={`col-${definition.id}`}>
          {children}
          <button
            data-testid={`add-${definition.id}`}
            onClick={onAdd}
            disabled={!canAdd}
          >
            add
          </button>
          <span data-testid={`can-add-${definition.id}`}>{String(canAdd)}</span>
          <span data-testid={`can-remove-${definition.id}`}>
            {String(canRemove)}
          </span>
        </div>
      ),
      group: ({
        children,
        onRemove,
        canRemove,
        itemIndex,
      }: {
        children?: ReactNode;
        onRemove?: () => void;
        canRemove?: boolean;
        itemIndex?: number;
      }) => (
        <div data-testid="item-group" data-item-index={itemIndex}>
          {children}
          {canRemove && (
            <button data-testid="remove-item" onClick={onRemove}>
              remove
            </button>
          )}
        </div>
      ),
      field: ({
        value,
        onChange,
        definition,
      }: {
        value: NodeValue | undefined;
        onChange: (v: NodeValue) => void;
        definition: { id: string };
      }) => (
        <div data-testid={`field-${definition.id}`}>
          <span data-testid={`val-${definition.id}`}>
            {typeof value?.value === 'string' ? value.value : ''}
          </span>
          <button
            data-testid={`set-${definition.id}`}
            onClick={() =>
              onChange({ value: `edited-${definition.id}`, isDirty: true })
            }
          >
            set
          </button>
        </div>
      ),
      ...overrides,
    };
  }

  function makeColView(opts: {
    id?: string;
    min?: number;
    max?: number;
    fieldId?: string;
    defaultVal?: string;
  }) {
    const { id = 'items', min, max, fieldId = 'name', defaultVal } = opts;
    return {
      viewId: 'col-view',
      version: '1',
      nodes: [
        {
          id,
          type: 'collection',
          ...(min !== undefined ? { minItems: min } : {}),
          ...(max !== undefined ? { maxItems: max } : {}),
          template: {
            id: 'row',
            type: 'group',
            children: [
              {
                id: fieldId,
                type: 'field',
                dataType: 'string',
                ...(defaultVal !== undefined
                  ? { defaultValue: defaultVal }
                  : {}),
              },
            ],
          },
        },
      ],
    } as ViewDefinition;
  }

  function renderColApp(view: ViewDefinition) {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(view);
      return <ContinuumRenderer view={view} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={makeColMap()}>
        <App />
      </ContinuumProvider>
    );
    return { rendered, getSession: () => requireSession(capturedSession) };
  }

  it('renders minItems items on initial render', () => {
    const { rendered } = renderColApp(makeColView({ min: 3, defaultVal: 'x' }));
    expect(
      rendered.container.querySelectorAll('[data-testid="item-group"]')
    ).toHaveLength(3);
    rendered.unmount();
  });

  it('renders 0 items when minItems is 0', () => {
    const { rendered } = renderColApp(makeColView({ min: 0 }));
    expect(
      rendered.container.querySelectorAll('[data-testid="item-group"]')
    ).toHaveLength(0);
    rendered.unmount();
  });

  it('renders 0 items when minItems is undefined', () => {
    const { rendered } = renderColApp(makeColView({}));
    expect(
      rendered.container.querySelectorAll('[data-testid="item-group"]')
    ).toHaveLength(0);
    rendered.unmount();
  });

  it('adds item when add button clicked', () => {
    const { rendered } = renderColApp(makeColView({ min: 1 }));
    act(() => {
      (
        rendered.container.querySelector(
          '[data-testid="add-items"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      rendered.container.querySelectorAll('[data-testid="item-group"]')
    ).toHaveLength(2);
    rendered.unmount();
  });

  it('new item shows template default value', () => {
    const { rendered } = renderColApp(
      makeColView({ min: 0, defaultVal: 'my-default' })
    );
    act(() => {
      (
        rendered.container.querySelector(
          '[data-testid="add-items"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      rendered.container.querySelector('[data-testid="val-name"]')?.textContent
    ).toBe('my-default');
    rendered.unmount();
  });

  it('add button is disabled when maxItems reached', () => {
    const { rendered } = renderColApp(makeColView({ min: 2, max: 2 }));
    const addBtn = rendered.container.querySelector(
      '[data-testid="add-items"]'
    ) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
    expect(
      rendered.container.querySelector('[data-testid="can-add-items"]')
        ?.textContent
    ).toBe('false');
    rendered.unmount();
  });

  it('add button is enabled when below maxItems', () => {
    const { rendered } = renderColApp(makeColView({ min: 1, max: 3 }));
    const addBtn = rendered.container.querySelector(
      '[data-testid="add-items"]'
    ) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(false);
    expect(
      rendered.container.querySelector('[data-testid="can-add-items"]')
        ?.textContent
    ).toBe('true');
    rendered.unmount();
  });

  it('add stops at maxItems', () => {
    const { rendered } = renderColApp(makeColView({ min: 0, max: 2 }));
    const addBtn = rendered.container.querySelector(
      '[data-testid="add-items"]'
    ) as HTMLButtonElement;
    act(() => {
      addBtn.click();
      addBtn.click();
      addBtn.click();
    });
    expect(
      rendered.container.querySelectorAll('[data-testid="item-group"]')
    ).toHaveLength(2);
    rendered.unmount();
  });

  it('remove button is absent when at minItems', () => {
    const { rendered } = renderColApp(makeColView({ min: 2 }));
    expect(
      rendered.container.querySelector('[data-testid="remove-item"]')
    ).toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="can-remove-items"]')
        ?.textContent
    ).toBe('false');
    rendered.unmount();
  });

  it('remove button appears when above minItems', () => {
    const { rendered } = renderColApp(makeColView({ min: 1 }));
    act(() => {
      (
        rendered.container.querySelector(
          '[data-testid="add-items"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      rendered.container.querySelector('[data-testid="remove-item"]')
    ).toBeTruthy();
    rendered.unmount();
  });

  it('clicking remove removes the correct item', () => {
    const { rendered, getSession } = renderColApp(makeColView({ min: 0 }));
    const addBtn = rendered.container.querySelector(
      '[data-testid="add-items"]'
    ) as HTMLButtonElement;
    act(() => {
      addBtn.click();
      addBtn.click();
      addBtn.click();
    });
    const setBtns = rendered.container.querySelectorAll(
      '[data-testid="set-name"]'
    );
    act(() => {
      (setBtns[1] as HTMLButtonElement).click();
    });
    const removeBtns = rendered.container.querySelectorAll(
      '[data-testid="remove-item"]'
    );
    act(() => {
      (removeBtns[0] as HTMLButtonElement).click();
    });
    const cv = getSession().getSnapshot()?.data.values['items'] as
      | CollectionValue
      | undefined;
    expect(cv?.value.items).toHaveLength(2);
    expect(cv?.value.items[0].values['row/name']?.value).toBe('edited-name');
    rendered.unmount();
  });

  it('editing item does not affect other items', () => {
    const { rendered, getSession } = renderColApp(
      makeColView({ min: 3, defaultVal: 'orig' })
    );
    const setBtns = rendered.container.querySelectorAll(
      '[data-testid="set-name"]'
    );
    act(() => {
      (setBtns[1] as HTMLButtonElement).click();
    });
    const cv = getSession().getSnapshot()?.data.values['items'] as
      | CollectionValue
      | undefined;
    expect(cv?.value.items[0].values['row/name']?.value ?? 'orig').toBe('orig');
    expect(cv?.value.items[1].values['row/name']?.value).toBe('edited-name');
    expect(cv?.value.items[2].values['row/name']?.value ?? 'orig').toBe('orig');
    rendered.unmount();
  });

  it('collection state is persisted in session snapshot', () => {
    const { rendered, getSession } = renderColApp(
      makeColView({ min: 1, defaultVal: 'snap-val' })
    );
    const snap = getSession().getSnapshot();
    const cv = snap?.data.values['items'] as CollectionValue | undefined;
    expect(cv?.value.items).toHaveLength(1);
    rendered.unmount();
  });

  it('each item receives correct itemIndex prop', () => {
    const indices: number[] = [];
    const map = makeColMap({
      group: ({
        children,
        itemIndex,
      }: {
        children?: ReactNode;
        itemIndex?: number;
      }) => {
        if (itemIndex !== undefined) indices.push(itemIndex);
        return <div data-testid="item-group">{children}</div>;
      },
    });
    const view = makeColView({ min: 3 });
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(view);
      return <ContinuumRenderer view={view} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    expect(indices).toEqual([0, 1, 2]);
    rendered.unmount();
  });

  it('item 0 and item 1 have independent state after both edited', () => {
    const { rendered } = renderColApp(
      makeColView({ min: 2, defaultVal: 'start' })
    );
    const vals = rendered.container.querySelectorAll(
      '[data-testid="val-name"]'
    );
    expect((vals[0] as HTMLElement).textContent).toBe('start');
    expect((vals[1] as HTMLElement).textContent).toBe('start');
    const setBtns = rendered.container.querySelectorAll(
      '[data-testid="set-name"]'
    );
    act(() => {
      (setBtns[0] as HTMLButtonElement).click();
    });
    const valsAfter0 = rendered.container.querySelectorAll(
      '[data-testid="val-name"]'
    );
    expect((valsAfter0[0] as HTMLElement).textContent).toBe('edited-name');
    expect((valsAfter0[1] as HTMLElement).textContent).toBe('start');
    act(() => {
      (
        rendered.container.querySelectorAll(
          '[data-testid="set-name"]'
        )[1] as HTMLButtonElement
      ).click();
    });
    const valsFinal = rendered.container.querySelectorAll(
      '[data-testid="val-name"]'
    );
    expect((valsFinal[0] as HTMLElement).textContent).toBe('edited-name');
    expect((valsFinal[1] as HTMLElement).textContent).toBe('edited-name');
    rendered.unmount();
  });

  it('adding item after editing preserves existing item values', () => {
    const { rendered } = renderColApp(
      makeColView({ min: 1, defaultVal: 'default' })
    );
    const setBtn = rendered.container.querySelector(
      '[data-testid="set-name"]'
    ) as HTMLButtonElement;
    act(() => {
      setBtn.click();
    });
    act(() => {
      (
        rendered.container.querySelector(
          '[data-testid="add-items"]'
        ) as HTMLButtonElement
      ).click();
    });
    const vals = rendered.container.querySelectorAll(
      '[data-testid="val-name"]'
    );
    expect((vals[0] as HTMLElement).textContent).toBe('edited-name');
    expect((vals[1] as HTMLElement).textContent).toBe('default');
    rendered.unmount();
  });

  it('new item added after editing does not share reference with existing', () => {
    const { rendered } = renderColApp(
      makeColView({ min: 1, defaultVal: 'shared' })
    );
    act(() => {
      (
        rendered.container.querySelector(
          '[data-testid="add-items"]'
        ) as HTMLButtonElement
      ).click();
    });
    const setBtns = rendered.container.querySelectorAll(
      '[data-testid="set-name"]'
    );
    act(() => {
      (setBtns[0] as HTMLButtonElement).click();
    });
    const vals = rendered.container.querySelectorAll(
      '[data-testid="val-name"]'
    );
    expect((vals[0] as HTMLElement).textContent).toBe('edited-name');
    expect((vals[1] as HTMLElement).textContent).toBe('shared');
    rendered.unmount();
  });

  it('external updateState on collection updates rendered items', () => {
    const { rendered, getSession } = renderColApp(makeColView({}));
    act(() => {
      getSession().updateState('items', {
        value: {
          items: [{ values: { 'row/name': { value: 'external-val' } } }],
        },
      });
    });
    expect(
      rendered.container.querySelector('[data-testid="val-name"]')?.textContent
    ).toBe('external-val');
    rendered.unmount();
  });

  it('collection with non-array items value renders 0 items', () => {
    const { rendered, getSession } = renderColApp(makeColView({}));
    act(() => {
      getSession().updateState('items', { value: { items: 'not-an-array' } });
    });
    expect(
      rendered.container.querySelectorAll('[data-testid="item-group"]')
    ).toHaveLength(0);
    rendered.unmount();
  });

  it('nested collection inside collection renders items correctly', () => {
    const nestedView: ViewDefinition = {
      viewId: 'nested',
      version: '1',
      nodes: [
        {
          id: 'outer',
          type: 'collection',
          minItems: 1,
          template: {
            id: 'outer_row',
            type: 'group',
            children: [
              {
                id: 'inner',
                type: 'collection',
                minItems: 1,
                template: {
                  id: 'inner_row',
                  type: 'group',
                  children: [
                    {
                      id: 'leaf',
                      type: 'field',
                      dataType: 'string',
                      defaultValue: 'leaf-val',
                    } as ViewNode,
                  ],
                },
              } as ViewNode,
            ],
          },
        } as ViewNode,
      ],
    };
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(nestedView);
      return <ContinuumRenderer view={nestedView} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={makeColMap()}>
        <App />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="val-leaf"]')?.textContent
    ).toBe('leaf-val');
    rendered.unmount();
  });

  it('nested collection siblings have independent state', () => {
    const nestedView: ViewDefinition = {
      viewId: 'nested-iso',
      version: '1',
      nodes: [
        {
          id: 'outer',
          type: 'collection',
          minItems: 2,
          template: {
            id: 'outer_row',
            type: 'group',
            children: [
              {
                id: 'inner',
                type: 'collection',
                minItems: 1,
                template: {
                  id: 'inner_row',
                  type: 'group',
                  children: [
                    {
                      id: 'task',
                      type: 'field',
                      dataType: 'string',
                      defaultValue: '',
                    } as ViewNode,
                  ],
                },
              } as ViewNode,
            ],
          },
        } as ViewNode,
      ],
    };
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(nestedView);
      return <ContinuumRenderer view={nestedView} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={makeColMap()}>
        <App />
      </ContinuumProvider>
    );
    const setTaskBtns = rendered.container.querySelectorAll(
      '[data-testid="set-task"]'
    );
    expect(setTaskBtns).toHaveLength(2);
    act(() => {
      (setTaskBtns[0] as HTMLButtonElement).click();
    });
    const vals = rendered.container.querySelectorAll(
      '[data-testid="val-task"]'
    );
    expect((vals[0] as HTMLElement).textContent).toBe('edited-task');
    expect((vals[1] as HTMLElement).textContent).toBe('');
    rendered.unmount();
  });

  it('adding to nested collection does not affect sibling outer item', () => {
    const nestedView: ViewDefinition = {
      viewId: 'nested-add-iso',
      version: '1',
      nodes: [
        {
          id: 'weeks',
          type: 'collection',
          minItems: 2,
          template: {
            id: 'week',
            type: 'group',
            children: [
              {
                id: 'days',
                type: 'collection',
                minItems: 0,
                template: {
                  id: 'day',
                  type: 'group',
                  children: [
                    {
                      id: 'name',
                      type: 'field',
                      dataType: 'string',
                      defaultValue: 'Day',
                    } as ViewNode,
                  ],
                },
              } as ViewNode,
            ],
          },
        } as ViewNode,
      ],
    };
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(nestedView);
      return <ContinuumRenderer view={nestedView} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={makeColMap()}>
        <App />
      </ContinuumProvider>
    );
    const addDaysBtns = rendered.container.querySelectorAll(
      '[data-testid="add-days"]'
    );
    expect(addDaysBtns).toHaveLength(2);
    act(() => {
      (addDaysBtns[0] as HTMLButtonElement).click();
    });
    const week1Days = rendered.container.querySelectorAll(
      '[data-testid="col-days"]'
    );
    const week1Fields = week1Days[0].querySelectorAll(
      '[data-testid="val-name"]'
    );
    const week2Fields = week1Days[1].querySelectorAll(
      '[data-testid="val-name"]'
    );
    expect(week1Fields).toHaveLength(1);
    expect(week2Fields).toHaveLength(0);
    rendered.unmount();
  });

  it('collection isDirty propagates to snapshot', () => {
    const { rendered, getSession } = renderColApp(makeColView({ min: 1 }));
    const setBtn = rendered.container.querySelector(
      '[data-testid="set-name"]'
    ) as HTMLButtonElement;
    act(() => {
      setBtn.click();
    });
    const cv = getSession().getSnapshot()?.data.values['items'] as
      | CollectionValue
      | undefined;
    expect(cv?.value.items[0].values['row/name']?.isDirty).toBe(true);
    rendered.unmount();
  });

  it('template defaults are isolated per item on initial render', () => {
    const view = makeColView({ min: 3, defaultVal: 'shared-risk' });
    const { rendered } = renderColApp(view);
    const setBtn = rendered.container.querySelectorAll(
      '[data-testid="set-name"]'
    );
    act(() => {
      (setBtn[0] as HTMLButtonElement).click();
    });
    const vals = rendered.container.querySelectorAll(
      '[data-testid="val-name"]'
    );
    expect((vals[0] as HTMLElement).textContent).toBe('edited-name');
    expect((vals[1] as HTMLElement).textContent).toBe('shared-risk');
    expect((vals[2] as HTMLElement).textContent).toBe('shared-risk');
    rendered.unmount();
  });

  it('collection with negative minItems renders 0 items', () => {
    const view = makeColView({ min: -5, defaultVal: 'x' });
    const { rendered } = renderColApp(view);
    expect(
      rendered.container.querySelectorAll('[data-testid="item-group"]')
    ).toHaveLength(0);
    rendered.unmount();
  });

  it('collection with fractional minItems floors to integer', () => {
    const view = makeColView({ min: 2.7, defaultVal: 'f' });
    const { rendered } = renderColApp(view);
    expect(
      rendered.container.querySelectorAll('[data-testid="item-group"]')
    ).toHaveLength(2);
    rendered.unmount();
  });

  it('collection with fractional maxItems stops adding at floor', () => {
    const view = makeColView({ min: 0, max: 2.9 });
    const { rendered } = renderColApp(view);
    const addBtn = rendered.container.querySelector(
      '[data-testid="add-items"]'
    ) as HTMLButtonElement;
    act(() => {
      addBtn.click();
      addBtn.click();
      addBtn.click();
    });
    expect(
      rendered.container.querySelectorAll('[data-testid="item-group"]')
    ).toHaveLength(2);
    rendered.unmount();
  });

  it('collection passes onAdd and onRemove as headless props', () => {
    let receivedOnAdd: (() => void) | undefined;
    let receivedOnRemove: ((i: number) => void) | undefined;
    const map = makeColMap({
      collection: ({
        onAdd,
        onRemove,
        children,
      }: {
        onAdd?: () => void;
        onRemove?: (i: number) => void;
        children?: ReactNode;
      }) => {
        receivedOnAdd = onAdd;
        receivedOnRemove = onRemove;
        return <div>{children}</div>;
      },
    });
    const view = makeColView({ min: 1 });
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(view);
      return <ContinuumRenderer view={view} />;
    }
    renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    expect(typeof receivedOnAdd).toBe('function');
    expect(typeof receivedOnRemove).toBe('function');
  });

  it('collection does not render when hidden', () => {
    const view: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [
        {
          id: 'hidden-col',
          type: 'collection',
          hidden: true,
          minItems: 2,
          template: {
            id: 'row',
            type: 'group',
            children: [
              { id: 'name', type: 'field', dataType: 'string' } as ViewNode,
            ],
          },
        } as ViewNode,
      ],
    };
    const { rendered } = renderColApp(view);
    expect(
      rendered.container.querySelector('[data-testid="col-hidden-col"]')
    ).toBeNull();
    rendered.unmount();
  });

  it('multiple collections in same view are independent', () => {
    const view: ViewDefinition = {
      viewId: 'multi-col',
      version: '1',
      nodes: [
        {
          id: 'col_a',
          type: 'collection',
          minItems: 2,
          template: {
            id: 'row_a',
            type: 'group',
            children: [
              {
                id: 'fa',
                type: 'field',
                dataType: 'string',
                defaultValue: 'a',
              } as ViewNode,
            ],
          },
        } as ViewNode,
        {
          id: 'col_b',
          type: 'collection',
          minItems: 1,
          template: {
            id: 'row_b',
            type: 'group',
            children: [
              {
                id: 'fb',
                type: 'field',
                dataType: 'string',
                defaultValue: 'b',
              } as ViewNode,
            ],
          },
        } as ViewNode,
      ],
    };
    const { rendered } = renderColApp(view);
    expect(
      rendered.container.querySelectorAll('[data-testid="val-fa"]')
    ).toHaveLength(2);
    expect(
      rendered.container.querySelectorAll('[data-testid="val-fb"]')
    ).toHaveLength(1);
    rendered.unmount();
  });

  it('remove does not go below minItems', () => {
    const view = makeColView({ min: 2 });
    const { rendered } = renderColApp(view);
    const addBtn = rendered.container.querySelector(
      '[data-testid="add-items"]'
    ) as HTMLButtonElement;
    act(() => {
      addBtn.click();
    });
    const removeBtns = rendered.container.querySelectorAll(
      '[data-testid="remove-item"]'
    );
    act(() => {
      (removeBtns[0] as HTMLButtonElement).click();
      (removeBtns[0] as HTMLButtonElement).click();
    });
    expect(
      rendered.container.querySelectorAll('[data-testid="item-group"]')
    ).toHaveLength(2);
    rendered.unmount();
  });

  it('collection renders collection node id as canonical id on items', () => {
    const view = makeColView({ min: 1 });
    const capturedNodeIds: string[] = [];
    const map = makeColMap({
      collection: ({
        children,
        definition,
      }: {
        children?: ReactNode;
        definition: { id: string };
      }) => <div data-testid={`col-${definition.id}`}>{children}</div>,
      field: ({
        nodeId,
        definition,
      }: {
        nodeId?: string;
        definition: { id: string };
      }) => {
        if (nodeId) capturedNodeIds.push(nodeId);
        return <div />;
      },
    });
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(view);
      return <ContinuumRenderer view={view} />;
    }
    renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    expect(capturedNodeIds).toContain('items/row/name');
  });
});

describe('hook flows integration', () => {
  const componentMap = {
    field: ({
      value,
      definition,
    }: {
      value: NodeValue | undefined;
      definition: { id: string };
    }) => (
      <div data-testid={`field-${definition.id}`}>
        {typeof value?.value === 'string' ? value.value : ''}
      </div>
    ),
  };

  const simpleView: ViewDefinition = {
    viewId: 'hook-view',
    version: '1',
    nodes: [
      { id: 'f1', type: 'field', dataType: 'string' } as ViewNode,
      { id: 'f2', type: 'field', dataType: 'string' } as ViewNode,
    ],
  };

  it('useContinuumState returns undefined before any state set', () => {
    let stateVal: NodeValue | undefined = { value: 'not-undefined' };
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(simpleView);
      const [state] = useContinuumState('f1');
      stateVal = state;
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(stateVal).toBeUndefined();
    rendered.unmount();
  });

  it('useContinuumState returns value after session.updateState', () => {
    let stateVal: NodeValue | undefined;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      [stateVal] = useContinuumState('f1');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'set-by-session',
      });
    });
    expect(stateVal?.value).toBe('set-by-session');
    rendered.unmount();
  });

  it('useContinuumState setValue writes to session', () => {
    let setVal: ((v: NodeValue) => void) | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      [, setVal] = useContinuumState('f1');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(setVal)({ value: 'written', isDirty: true });
    });
    expect(
      requireSession(capturedSession).getSnapshot()?.data.values['f1']
    ).toEqual({ value: 'written', isDirty: true });
    rendered.unmount();
  });

  it('useContinuumState triggers re-render on state change', () => {
    let renderCount = 0;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      useContinuumState('f1');
      renderCount++;
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const before = renderCount;
    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'trigger' });
    });
    expect(renderCount).toBeGreaterThan(before);
    rendered.unmount();
  });

  it('useContinuumState does not trigger re-render for unrelated node', () => {
    let renderCount = 0;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      useContinuumState('f1');
      renderCount++;
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const before = renderCount;
    act(() => {
      requireSession(capturedSession).updateState('f2', { value: 'other' });
    });
    expect(renderCount).toBe(before);
    rendered.unmount();
  });

  it('useContinuumState caches ref when value is shallow-equal', () => {
    const refs: (NodeValue | undefined)[] = [];
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      const [state] = useContinuumState('f1');
      refs.push(state);
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'same',
        isDirty: true,
      });
    });
    const afterFirst = refs[refs.length - 1];
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'same',
        isDirty: true,
      });
    });
    expect(refs[refs.length - 1]).toBe(afterFirst);
    expect(refs[refs.length - 1]?.value).toBe('same');
    rendered.unmount();
  });

  it('useContinuumViewport returns undefined before set', () => {
    let vp: ViewportState | undefined = { isFocused: true };
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(simpleView);
      [vp] = useContinuumViewport('f1');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(vp).toBeUndefined();
    rendered.unmount();
  });

  it('useContinuumViewport returns updated viewport', () => {
    let vp: ViewportState | undefined;
    let setVp: ((v: ViewportState) => void) | null = null;
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(simpleView);
      [vp, setVp] = useContinuumViewport('f1');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(setVp)({ zoom: 3, isFocused: true });
    });
    expect(vp?.zoom).toBe(3);
    expect(vp?.isFocused).toBe(true);
    rendered.unmount();
  });

  it('useContinuumViewport does not re-render for unrelated node change', () => {
    let renderCount = 0;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      useContinuumViewport('f1');
      renderCount++;
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const before = renderCount;
    act(() => {
      requireSession(capturedSession).updateViewportState('f2', {
        isFocused: true,
      });
    });
    expect(renderCount).toBe(before);
    rendered.unmount();
  });

  it('useContinuumViewport caches ref for shallow-equal viewport', () => {
    const refs: (ViewportState | undefined)[] = [];
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      const [vp] = useContinuumViewport('f1');
      refs.push(vp);
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateViewportState('f1', {
        zoom: 1,
        isFocused: false,
      });
    });
    const afterFirst = refs[refs.length - 1];
    act(() => {
      requireSession(capturedSession).updateViewportState('f1', {
        zoom: 1,
        isFocused: false,
      });
    });
    expect(refs[refs.length - 1]).toBe(afterFirst);
    expect(refs[refs.length - 1]?.zoom).toBe(1);
    rendered.unmount();
  });

  it('useContinuumSnapshot returns null before pushView', () => {
    let snapshot: ContinuitySnapshot | null = undefined as unknown as null;
    function App() {
      snapshot = useContinuumSnapshot();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(snapshot).toBeNull();
    rendered.unmount();
  });

  it('useContinuumSnapshot contains view after pushView', () => {
    let snapshot: ContinuitySnapshot | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      snapshot = useContinuumSnapshot();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).pushView(simpleView);
    });
    expect(snapshot?.view.viewId).toBe('hook-view');
    rendered.unmount();
  });

  it('useContinuumSnapshot updates when state changes', () => {
    const snaps: (ContinuitySnapshot | null)[] = [];
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      snaps.push(useContinuumSnapshot());
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const before = snaps[snaps.length - 1];
    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'changed' });
    });
    expect(snaps[snaps.length - 1]).not.toBe(before);
    expect(
      (snaps[snaps.length - 1]?.data.values['f1'] as NodeValue | undefined)
        ?.value
    ).toBe('changed');
    rendered.unmount();
  });

  it('useContinuumSnapshot is frozen (immutable)', () => {
    let snapshot: ContinuitySnapshot | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      snapshot = useContinuumSnapshot();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'x' });
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    rendered.unmount();
  });

  it('useContinuumDiagnostics returns empty issues initially', () => {
    let diags: ReturnType<typeof useContinuumDiagnostics> | null = null;
    function App() {
      diags = useContinuumDiagnostics();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(requireSession(diags).issues).toEqual([]);
    rendered.unmount();
  });

  it('useContinuumDiagnostics returns empty checkpoints initially', () => {
    let diags: ReturnType<typeof useContinuumDiagnostics> | null = null;
    function App() {
      diags = useContinuumDiagnostics();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(requireSession(diags).checkpoints).toEqual([]);
    rendered.unmount();
  });

  it('useContinuumDiagnostics checkpoints grows after pushView', () => {
    let diags: ReturnType<typeof useContinuumDiagnostics> | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      diags = useContinuumDiagnostics();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(requireSession(diags).checkpoints.length).toBeGreaterThan(0);
    rendered.unmount();
  });

  it('useContinuumDiagnostics diffs array is accessible', () => {
    let diags: ReturnType<typeof useContinuumDiagnostics> | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      diags = useContinuumDiagnostics();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(Array.isArray(requireSession(diags).diffs)).toBe(true);
    rendered.unmount();
  });

  it('useContinuumHydrated returns false without storage', () => {
    let hydrated: boolean | null = null;
    function App() {
      hydrated = useContinuumHydrated();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(hydrated).toBe(false);
    rendered.unmount();
  });

  it('useContinuumHydrated returns true when key found in storage', () => {
    const seed = createSession();
    seed.pushView(simpleView);
    localStorage.setItem('hydrated-hook-key', JSON.stringify(seed.serialize()));
    let hydrated: boolean | null = null;
    function App() {
      hydrated = useContinuumHydrated();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={componentMap}
        persist="localStorage"
        storageKey="hydrated-hook-key"
      >
        <App />
      </ContinuumProvider>
    );
    expect(hydrated).toBe(true);
    localStorage.removeItem('hydrated-hook-key');
    rendered.unmount();
  });

  it('useContinuumConflict hasConflict is false initially', () => {
    let conflict: ReturnType<typeof useContinuumConflict> | null = null;
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(simpleView);
      conflict = useContinuumConflict('f1');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(requireSession(conflict).hasConflict).toBe(false);
    expect(requireSession(conflict).proposal).toBeNull();
    rendered.unmount();
  });

  it('useContinuumConflict detects proposal from proposeValue', () => {
    let conflict: ReturnType<typeof useContinuumConflict> | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      conflict = useContinuumConflict('f1');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'typed',
        isDirty: true,
      });
      requireSession(capturedSession).proposeValue('f1', { value: 'ai' }, 'ai');
    });
    expect(requireSession(conflict).hasConflict).toBe(true);
    expect(requireSession(conflict).proposal?.proposedValue).toEqual({
      value: 'ai',
    });
    rendered.unmount();
  });

  it('useContinuumConflict accept resolves conflict with proposed value', () => {
    let conflict: ReturnType<typeof useContinuumConflict> | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      conflict = useContinuumConflict('f1');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'typed',
        isDirty: true,
      });
      requireSession(capturedSession).proposeValue(
        'f1',
        { value: 'ai-val' },
        'ai'
      );
    });
    expect(requireSession(conflict).hasConflict).toBe(true);
    act(() => {
      requireSession(conflict).accept();
    });
    expect(
      (
        requireSession(capturedSession).getSnapshot()?.data.values['f1'] as
          | NodeValue
          | undefined
      )?.value
    ).toBe('ai-val');
    expect(
      requireSession(capturedSession).getPendingProposals()['f1']
    ).toBeUndefined();
    rendered.unmount();
  });

  it('useContinuumConflict reject resolves conflict and keeps original', () => {
    let conflict: ReturnType<typeof useContinuumConflict> | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      conflict = useContinuumConflict('f1');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'mine',
        isDirty: true,
      });
      requireSession(capturedSession).proposeValue(
        'f1',
        { value: 'ai-val' },
        'ai'
      );
    });
    act(() => {
      requireSession(conflict).reject();
    });
    expect(requireSession(conflict).hasConflict).toBe(false);
    expect(
      (
        requireSession(capturedSession).getSnapshot()?.data.values['f1'] as
          | NodeValue
          | undefined
      )?.value
    ).toBe('mine');
    rendered.unmount();
  });

  it('useContinuumConflict caches proposal ref when unchanged', () => {
    const proposals: unknown[] = [];
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      const conflict = useContinuumConflict('f1');
      proposals.push(conflict.proposal);
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'typed',
        isDirty: true,
      });
      requireSession(capturedSession).proposeValue(
        'f1',
        { value: 'prop' },
        'ai'
      );
    });
    const afterProposal = proposals[proposals.length - 1];
    act(() => {
      requireSession(capturedSession).updateState('f2', { value: 'unrelated' });
    });
    expect(proposals[proposals.length - 1]).toBe(afterProposal);
    rendered.unmount();
  });

  it('useContinuumSuggestions hasSuggestions is false initially', () => {
    let hasSuggestions = true;
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(simpleView);
      hasSuggestions = useContinuumSuggestions().hasSuggestions;
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(hasSuggestions).toBe(false);
    rendered.unmount();
  });

  it('useContinuumSuggestions detects suggestion field', () => {
    let hasSuggestions = false;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      hasSuggestions = useContinuumSuggestions().hasSuggestions;
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'old',
        suggestion: 'new',
        isDirty: true,
      });
    });
    expect(hasSuggestions).toBe(true);
    rendered.unmount();
  });

  it('useContinuumSuggestions acceptAll sets value to suggestion and clears it', () => {
    let acceptAll: (() => void) | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      const s = useContinuumSuggestions();
      acceptAll = s.acceptAll;
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'old',
        suggestion: 'suggested',
        isDirty: true,
      });
    });
    act(() => {
      requireSession(acceptAll)();
    });
    const f1 = requireSession(capturedSession).getSnapshot()?.data.values[
      'f1'
    ] as NodeValue | undefined;
    expect(f1?.value).toBe('suggested');
    expect(f1?.suggestion).toBeUndefined();
    expect(f1?.isDirty).toBe(true);
    rendered.unmount();
  });

  it('useContinuumSuggestions rejectAll removes suggestion keeps value', () => {
    let rejectAll: (() => void) | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      const s = useContinuumSuggestions();
      rejectAll = s.rejectAll;
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'original',
        suggestion: 'unwanted',
        isDirty: true,
      });
    });
    act(() => {
      requireSession(rejectAll)();
    });
    const f1 = requireSession(capturedSession).getSnapshot()?.data.values[
      'f1'
    ] as NodeValue | undefined;
    expect(f1?.value).toBe('original');
    expect(f1?.suggestion).toBeUndefined();
    rendered.unmount();
  });

  it('useContinuumSuggestions acceptAll handles multiple suggestions', () => {
    let acceptAll: (() => void) | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      acceptAll = useContinuumSuggestions().acceptAll;
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'old1',
        suggestion: 'new1',
        isDirty: true,
      });
      requireSession(capturedSession).updateState('f2', {
        value: 'old2',
        suggestion: 'new2',
        isDirty: true,
      });
    });
    act(() => {
      requireSession(acceptAll)();
    });
    const snap = requireSession(capturedSession).getSnapshot();
    expect((snap?.data.values['f1'] as NodeValue | undefined)?.value).toBe(
      'new1'
    );
    expect((snap?.data.values['f2'] as NodeValue | undefined)?.value).toBe(
      'new2'
    );
    rendered.unmount();
  });

  it('useContinuumAction returns correct initial state', () => {
    const actionView: ViewDefinition = {
      viewId: 'action-hook-view',
      version: '1',
      nodes: [{ id: 'btn', type: 'action', intentId: 'do_it', label: 'Go' }],
    };
    let hookResult: ReturnType<typeof useContinuumAction> | null = null;
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(actionView);
      hookResult = useContinuumAction('do_it');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={{ ...componentMap, action: () => <div /> }}
      >
        <App />
      </ContinuumProvider>
    );
    expect(requireSession(hookResult).isDispatching).toBe(false);
    expect(requireSession(hookResult).lastResult).toBeNull();
    expect(typeof requireSession(hookResult).dispatch).toBe('function');
    rendered.unmount();
  });

  it('useContinuumAction dispatch calls registered handler', async () => {
    const actionView: ViewDefinition = {
      viewId: 'action-dispatch-view',
      version: '1',
      nodes: [
        { id: 'btn', type: 'action', intentId: 'exec', label: 'Execute' },
      ],
    };
    let hookResult: ReturnType<typeof useContinuumAction> | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(actionView);
      hookResult = useContinuumAction('exec');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={{ ...componentMap, action: () => <div /> }}
        sessionOptions={{
          actions: {
            exec: {
              registration: { label: 'Exec' },
              handler: () => ({ success: true, data: 'executed' }),
            },
          },
        }}
      >
        <App />
      </ContinuumProvider>
    );
    await act(async () => {
      await requireSession(hookResult).dispatch('btn');
    });
    expect(requireSession(hookResult).lastResult?.success).toBe(true);
    expect(requireSession(hookResult).lastResult?.data).toBe('executed');
    expect(requireSession(hookResult).isDispatching).toBe(false);
    rendered.unmount();
  });

  it('useContinuumAction isDispatching resets to false after dispatch completes', async () => {
    const actionView: ViewDefinition = {
      viewId: 'action-dispatching-view',
      version: '1',
      nodes: [{ id: 'btn', type: 'action', intentId: 'slow', label: 'Slow' }],
    };
    let hookResult: ReturnType<typeof useContinuumAction> | null = null;
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(actionView);
      hookResult = useContinuumAction('slow');
      return (
        <div data-testid="dispatching">
          {requireSession(hookResult).isDispatching ? 'yes' : 'no'}
        </div>
      );
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={{ ...componentMap, action: () => <div /> }}
        sessionOptions={{
          actions: {
            slow: {
              registration: { label: 'Slow' },
              handler: async () => ({ success: true, data: 'done' }),
            },
          },
        }}
      >
        <App />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="dispatching"]')
        ?.textContent
    ).toBe('no');
    await act(async () => {
      await requireSession(hookResult).dispatch('btn');
    });
    expect(
      rendered.container.querySelector('[data-testid="dispatching"]')
        ?.textContent
    ).toBe('no');
    expect(requireSession(hookResult).lastResult?.data).toBe('done');
    rendered.unmount();
  });

  it('useContinuumAction last result is from most-recently-resolved dispatch', async () => {
    const actionView: ViewDefinition = {
      viewId: 'action-sequential-view',
      version: '1',
      nodes: [{ id: 'btn', type: 'action', intentId: 'seq', label: 'Seq' }],
    };
    let hookResult: ReturnType<typeof useContinuumAction> | null = null;
    let callCount = 0;
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(actionView);
      hookResult = useContinuumAction('seq');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={{ ...componentMap, action: () => <div /> }}
        sessionOptions={{
          actions: {
            seq: {
              registration: { label: 'Seq' },
              handler: async () => {
                callCount++;
                return { success: true, data: `call-${callCount}` };
              },
            },
          },
        }}
      >
        <App />
      </ContinuumProvider>
    );
    await act(async () => {
      await requireSession(hookResult).dispatch('btn');
    });
    await act(async () => {
      await requireSession(hookResult).dispatch('btn');
    });
    expect(requireSession(hookResult).lastResult?.data).toBe('call-2');
    rendered.unmount();
  });

  it('useContinuumAction context throws with clear message outside provider', () => {
    function Orphan() {
      useContinuumSession();
      return null;
    }
    expect(() => renderIntoDom(<Orphan />)).toThrow('<ContinuumProvider>');
  });

  it('useContinuumViewport warns when used inside collection scope', () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(simpleView);
      return (
        <NodeStateScopeContext.Provider
          value={{
            subscribeNode: () => () => undefined,
            getNodeValue: () => undefined,
            setNodeValue: () => undefined,
          }}
        >
          <InnerVpApp />
        </NodeStateScopeContext.Provider>
      );
    }
    function InnerVpApp() {
      useContinuumViewport('f1');
      return null;
    }
    renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('f1'));
    warnSpy.mockRestore();
  });

  it('useContinuumState reads from scope when inside collection', () => {
    let receivedValue: NodeValue | undefined;
    const mockScope = {
      subscribeNode: vi.fn(() => () => undefined),
      getNodeValue: vi.fn((_nodeId: string) => ({ value: 'from-scope' })),
      setNodeValue: vi.fn(),
    };
    function InnerScopeApp() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(simpleView);
      const [val] = useContinuumState('f1');
      receivedValue = val;
      return null;
    }
    function ScopeApp() {
      return (
        <NodeStateScopeContext.Provider value={mockScope}>
          <InnerScopeApp />
        </NodeStateScopeContext.Provider>
      );
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <ScopeApp />
      </ContinuumProvider>
    );
    expect(receivedValue?.value).toBe('from-scope');
    rendered.unmount();
  });
});

describe('error boundary and stress integration', () => {
  const componentMap = {
    field: ({
      value,
      definition,
    }: {
      value: NodeValue | undefined;
      definition: { id: string };
    }) => (
      <div data-testid={`field-${definition.id}`}>
        {typeof value?.value === 'string' ? value.value : ''}
      </div>
    ),
  };

  const errorView: ViewDefinition = {
    viewId: 'error-view',
    version: '1',
    nodes: [
      { id: 'boom', type: 'field', dataType: 'string' } as ViewNode,
      { id: 'safe', type: 'field', dataType: 'string' } as ViewNode,
    ],
  };

  it('NodeErrorBoundary catches render error and shows fallback', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    const map = {
      field: ({
        value,
        definition,
      }: {
        value: NodeValue | undefined;
        definition: { id: string };
      }) => {
        if (definition.id === 'boom' && value?.value === 'explode')
          throw new Error('Boom!');
        return (
          <div data-testid={`field-${definition.id}`}>
            {typeof value?.value === 'string' ? value.value : ''}
          </div>
        );
      },
    };
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(errorView);
      return <ContinuumRenderer view={errorView} />;
    }
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('boom', { value: 'explode' });
    });
    expect(
      rendered.container.querySelector('[data-continuum-render-error="boom"]')
    ).toBeTruthy();
    consoleSpy.mockRestore();
    rendered.unmount();
  });

  it('NodeErrorBoundary shows error message in fallback', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    const map = {
      field: ({
        value,
        definition,
      }: {
        value: NodeValue | undefined;
        definition: { id: string };
      }) => {
        if (definition.id === 'boom' && value?.value === 'throw')
          throw new Error('Custom error message');
        return <div data-testid={`field-${definition.id}`} />;
      },
    };
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(errorView);
      return <ContinuumRenderer view={errorView} />;
    }
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('boom', { value: 'throw' });
    });
    const boundary = rendered.container.querySelector(
      '[data-continuum-render-error="boom"]'
    );
    expect(boundary?.textContent).toContain('Custom error message');
    consoleSpy.mockRestore();
    rendered.unmount();
  });

  it('NodeErrorBoundary does not affect sibling nodes', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    const map = {
      field: ({
        value,
        definition,
      }: {
        value: NodeValue | undefined;
        definition: { id: string };
      }) => {
        if (definition.id === 'boom' && value?.value === 'throw')
          throw new Error('Isolated!');
        return (
          <div data-testid={`field-${definition.id}`}>
            {typeof value?.value === 'string' ? value.value : ''}
          </div>
        );
      },
    };
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(errorView);
      return <ContinuumRenderer view={errorView} />;
    }
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('boom', { value: 'throw' });
      requireSession(capturedSession).updateState('safe', {
        value: 'still-works',
      });
    });
    expect(
      rendered.container.querySelector('[data-testid="field-safe"]')
        ?.textContent
    ).toBe('still-works');
    consoleSpy.mockRestore();
    rendered.unmount();
  });

  it('NodeErrorBoundary recovers when children change (new value clears error)', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    const map = {
      field: ({
        value,
        definition,
      }: {
        value: NodeValue | undefined;
        definition: { id: string };
      }) => {
        if (definition.id === 'boom' && value?.value === 'throw')
          throw new Error('Recoverable!');
        return (
          <div data-testid={`field-${definition.id}`}>
            {typeof value?.value === 'string' ? value.value : ''}
          </div>
        );
      },
    };
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(errorView);
      return <ContinuumRenderer view={errorView} />;
    }
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('boom', { value: 'throw' });
    });
    expect(
      rendered.container.querySelector('[data-continuum-render-error="boom"]')
    ).toBeTruthy();
    act(() => {
      requireSession(capturedSession).updateState('boom', {
        value: 'recovered',
      });
    });
    expect(
      rendered.container.querySelector('[data-continuum-render-error="boom"]')
    ).toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="field-boom"]')
        ?.textContent
    ).toBe('recovered');
    consoleSpy.mockRestore();
    rendered.unmount();
  });

  it('multiple errors in different nodes are each isolated', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    const threeNodeView: ViewDefinition = {
      viewId: 'three-node-view',
      version: '1',
      nodes: [
        { id: 'n1', type: 'field', dataType: 'string' } as ViewNode,
        { id: 'n2', type: 'field', dataType: 'string' } as ViewNode,
        { id: 'n3', type: 'field', dataType: 'string' } as ViewNode,
      ],
    };
    const map = {
      field: ({
        value,
        definition,
      }: {
        value: NodeValue | undefined;
        definition: { id: string };
      }) => {
        if (value?.value === 'throw')
          throw new Error(`Error in ${definition.id}`);
        return (
          <div data-testid={`field-${definition.id}`}>
            {typeof value?.value === 'string' ? value.value : 'ok'}
          </div>
        );
      },
    };
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot())
        capturedSession.pushView(threeNodeView);
      return <ContinuumRenderer view={threeNodeView} />;
    }
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('n1', { value: 'throw' });
      requireSession(capturedSession).updateState('n3', { value: 'throw' });
    });
    expect(
      rendered.container.querySelector('[data-continuum-render-error="n1"]')
    ).toBeTruthy();
    expect(
      rendered.container.querySelector('[data-testid="field-n2"]')?.textContent
    ).toBe('ok');
    expect(
      rendered.container.querySelector('[data-continuum-render-error="n3"]')
    ).toBeTruthy();
    consoleSpy.mockRestore();
    rendered.unmount();
  });

  it('FallbackComponent renders for unknown node type with definition info', () => {
    const view: ViewDefinition = {
      viewId: 'fallback-view',
      version: '1',
      nodes: [
        {
          id: 'unk',
          type: 'unknown_type',
          dataType: 'string',
        } as unknown as ViewNode,
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={{}}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    const fallback = rendered.container.querySelector(
      '[data-continuum-fallback="unknown_type"]'
    );
    expect(fallback).toBeTruthy();
    expect(fallback?.textContent).toContain('unk');
    rendered.unmount();
  });

  it('FallbackComponent shows display name when label is present', () => {
    const view: ViewDefinition = {
      viewId: 'fallback-label-view',
      version: '1',
      nodes: [
        {
          id: 'f1',
          type: 'custom',
          label: 'My Label',
          dataType: 'string',
        } as unknown as ViewNode,
      ],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={{}}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    const fallback = rendered.container.querySelector(
      '[data-continuum-fallback="custom"]'
    );
    expect(fallback?.textContent).toContain('My Label');
    rendered.unmount();
  });

  it('session with 50 nodes renders without errors', () => {
    const nodes: ViewNode[] = Array.from(
      { length: 50 },
      (_, i) => ({ id: `f${i}`, type: 'field', dataType: 'string' } as ViewNode)
    );
    const view: ViewDefinition = { viewId: 'big-view', version: '1', nodes };
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(view);
      return <ContinuumRenderer view={view} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelectorAll('[data-testid^="field-"]')
    ).toHaveLength(50);
    rendered.unmount();
  });

  it('rapid state updates on same node are all applied in order', () => {
    const view: ViewDefinition = {
      viewId: 'rapid-view',
      version: '1',
      nodes: [{ id: 'counter', type: 'field', dataType: 'string' } as ViewNode],
    };
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(view);
      return <ContinuumRenderer view={view} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      for (let i = 0; i < 20; i++) {
        requireSession(capturedSession).updateState('counter', {
          value: `val-${i}`,
        });
      }
    });
    expect(
      rendered.container.querySelector('[data-testid="field-counter"]')
        ?.textContent
    ).toBe('val-19');
    rendered.unmount();
  });

  it('rapid pushView calls do not corrupt state', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      for (let i = 0; i < 10; i++) {
        requireSession(capturedSession).pushView({
          viewId: `v${i}`,
          version: `${i}`,
          nodes: [{ id: 'f', type: 'field', dataType: 'string' } as ViewNode],
        });
      }
    });
    const snapshot = requireSession(capturedSession).getSnapshot();
    expect(snapshot?.view.viewId).toBe('v9');
    rendered.unmount();
  });

  it('collection with 100 items renders correctly', () => {
    const view: ViewDefinition = {
      viewId: 'large-col-view',
      version: '1',
      nodes: [
        {
          id: 'items',
          type: 'collection',
          minItems: 10,
          template: {
            id: 'row',
            type: 'group',
            children: [
              {
                id: 'name',
                type: 'field',
                dataType: 'string',
                defaultValue: 'item',
              } as ViewNode,
            ],
          },
        } as ViewNode,
      ],
    };
    const map = {
      collection: ({
        children,
        onAdd,
        definition,
      }: {
        children?: ReactNode;
        onAdd?: () => void;
        definition: { id: string };
      }) => (
        <div data-testid={`col-${definition.id}`}>
          <button data-testid="add" onClick={onAdd}>
            add
          </button>
          {children}
        </div>
      ),
      group: ({ children }: { children?: ReactNode }) => (
        <div data-testid="item">{children}</div>
      ),
      field: ({
        value,
        definition,
      }: {
        value: NodeValue | undefined;
        definition: { id: string };
      }) => (
        <div data-testid={`field-${definition.id}`}>
          {typeof value?.value === 'string' ? value.value : ''}
        </div>
      ),
    };
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(view);
      return <ContinuumRenderer view={view} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    const addBtn = rendered.container.querySelector(
      '[data-testid="add"]'
    ) as HTMLButtonElement;
    act(() => {
      for (let i = 0; i < 90; i++) addBtn.click();
    });
    expect(
      rendered.container.querySelectorAll('[data-testid="item"]')
    ).toHaveLength(100);
    rendered.unmount();
  });

  it('collection items at item 0 and item 99 are independent', () => {
    const view: ViewDefinition = {
      viewId: 'isolation-view',
      version: '1',
      nodes: [
        {
          id: 'list',
          type: 'collection',
          minItems: 0,
          template: {
            id: 'row',
            type: 'group',
            children: [
              {
                id: 'val',
                type: 'field',
                dataType: 'string',
                defaultValue: 'default',
              } as ViewNode,
            ],
          },
        } as ViewNode,
      ],
    };
    const map = {
      collection: ({
        children,
        onAdd,
        definition,
      }: {
        children?: ReactNode;
        onAdd?: () => void;
        definition: { id: string };
      }) => (
        <div data-testid={`col-${definition.id}`}>
          <button data-testid="add" onClick={onAdd}>
            add
          </button>
          {children}
        </div>
      ),
      group: ({
        children,
        onChange,
        itemIndex,
      }: {
        children?: ReactNode;
        onChange?: (v: NodeValue) => void;
        itemIndex?: number;
      }) => (
        <div data-testid="item" data-index={itemIndex}>
          {children}
        </div>
      ),
      field: ({
        onChange,
        definition,
      }: {
        onChange: (v: NodeValue) => void;
        definition: { id: string };
      }) => (
        <button
          data-testid={`set-${definition.id}`}
          onClick={() => onChange({ value: 'changed', isDirty: true })}
        >
          set
        </button>
      ),
    };
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(view);
      return <ContinuumRenderer view={view} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    const addBtn = rendered.container.querySelector(
      '[data-testid="add"]'
    ) as HTMLButtonElement;
    act(() => {
      for (let i = 0; i < 100; i++) addBtn.click();
    });
    const setButtons = rendered.container.querySelectorAll(
      '[data-testid="set-val"]'
    );
    act(() => {
      (setButtons[0] as HTMLButtonElement).click();
    });
    type ColVal = NodeValue<{
      items: Array<{ values: Record<string, NodeValue> }>;
    }>;
    const cv = requireSession(capturedSession).getSnapshot()?.data.values[
      'list'
    ] as ColVal | undefined;
    expect(cv?.value.items[0].values['row/val']?.value).toBe('changed');
    expect(cv?.value.items[99].values['row/val']?.value ?? 'default').toBe(
      'default'
    );
    rendered.unmount();
  });

  it('provider handles component map with no entries gracefully', () => {
    const view: ViewDefinition = {
      viewId: 'empty-map-view',
      version: '1',
      nodes: [{ id: 'f', type: 'field', dataType: 'string' } as ViewNode],
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={{}}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-continuum-fallback="field"]')
    ).toBeTruthy();
    rendered.unmount();
  });

  it('session with deeply nested groups renders all levels', () => {
    function makeDeepGroup(depth: number): ViewNode {
      if (depth === 0)
        return { id: 'leaf', type: 'field', dataType: 'string' } as ViewNode;
      return {
        id: `g${depth}`,
        type: 'group',
        children: [makeDeepGroup(depth - 1)],
      } as ViewNode;
    }
    const view: ViewDefinition = {
      viewId: 'deep-group-view',
      version: '1',
      nodes: [makeDeepGroup(10)],
    };
    const map = {
      group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      field: ({ definition }: { definition: { id: string } }) => (
        <div data-testid={`leaf-${definition.id}`} />
      ),
    };
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="leaf-leaf"]')
    ).toBeTruthy();
    rendered.unmount();
  });

  it('ContinuumRenderer with undefined view nodes does not throw', () => {
    const view = {
      viewId: 'v',
      version: '1',
      nodes: undefined,
    } as unknown as ViewDefinition;
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    );
    expect(rendered.container.childElementCount).toBe(0);
    rendered.unmount();
  });
});

describe('adversarial and edge-case integration', () => {
  const componentMap = {
    field: ({
      value,
      definition,
    }: {
      value: NodeValue | undefined;
      definition: { id: string };
    }) => (
      <div data-testid={`field-${definition.id}`}>
        {typeof value?.value === 'string' ? value.value : ''}
      </div>
    ),
  };

  const simpleView: ViewDefinition = {
    viewId: 'adversarial-view',
    version: '1',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' } as ViewNode],
  };

  it('useContinuumAction isDispatching resets to false when action handler throws', async () => {
    const actionView: ViewDefinition = {
      viewId: 'action-throw-view',
      version: '1',
      nodes: [
        { id: 'btn', type: 'action', intentId: 'fail_action', label: 'Fail' },
      ],
    };
    let hookResult: ReturnType<typeof useContinuumAction> | null = null;
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(actionView);
      hookResult = useContinuumAction('fail_action');
      return (
        <div data-testid="dispatching">
          {requireSession(hookResult).isDispatching ? 'yes' : 'no'}
        </div>
      );
    }
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={{ ...componentMap, action: () => <div /> }}
        sessionOptions={{
          actions: {
            fail_action: {
              registration: { label: 'Fail' },
              handler: async () => {
                throw new Error('Action failed!');
              },
            },
          },
        }}
      >
        <App />
      </ContinuumProvider>
    );
    await act(async () => {
      try {
        await requireSession(hookResult).dispatch('btn');
      } catch {
        /* ignored */
      }
    });
    expect(
      rendered.container.querySelector('[data-testid="dispatching"]')
        ?.textContent
    ).toBe('no');
    consoleSpy.mockRestore();
    rendered.unmount();
  });

  it('component mutating value prop does not corrupt session stored state', () => {
    const map = {
      field: ({ value }: { value: NodeValue | undefined }) => {
        if (value && typeof value === 'object') {
          try {
            (value as Record<string, unknown>).hackedProp = 'injected';
          } catch {
            /* frozen â€” expected */
          }
        }
        return (
          <div data-testid="f1">
            {typeof value?.value === 'string' ? value.value : ''}
          </div>
        );
      },
    };
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      return <ContinuumRenderer view={simpleView} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'original',
        isDirty: true,
      });
    });
    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'second',
        isDirty: true,
      });
    });
    expect(
      rendered.container.querySelector('[data-testid="f1"]')?.textContent
    ).toBe('second');
    const f1 = requireSession(capturedSession).getSnapshot()?.data.values[
      'f1'
    ] as NodeValue | undefined;
    expect(f1?.value).toBe('second');
    expect(f1?.isDirty).toBe(true);
    rendered.unmount();
  });

  it('snapshot provided to component is frozen and mutation attempt fails silently', () => {
    let capturedSnap: ContinuitySnapshot | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      capturedSnap = useContinuumSnapshot();
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'v' });
    });
    if (capturedSnap) {
      expect(Object.isFrozen(capturedSnap)).toBe(true);
      try {
        (capturedSnap as Record<string, unknown>).injected = 'evil';
      } catch {
        /* expected in strict mode */
      }
      expect(
        (capturedSnap as Record<string, unknown>).injected
      ).toBeUndefined();
    }
    rendered.unmount();
  });

  it('useContinuumSuggestions handles collection values with nested suggestion fields', () => {
    const colView: ViewDefinition = {
      viewId: 'col-sug-view',
      version: '1',
      nodes: [
        {
          id: 'items',
          type: 'collection',
          minItems: 1,
          template: {
            id: 'row',
            type: 'group',
            children: [
              { id: 'status', type: 'field', dataType: 'string' } as ViewNode,
            ],
          },
        } as ViewNode,
      ],
    };
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let hasSuggestions = false;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(colView);
      hasSuggestions = useContinuumSuggestions().hasSuggestions;
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(capturedSession).updateState('items', {
        value: {
          items: [
            {
              values: {
                'row/status': {
                  value: 'old',
                  suggestion: 'new',
                  isDirty: true,
                },
              },
            },
          ],
        },
      });
    });
    expect(hasSuggestions).toBe(false);
    rendered.unmount();
  });

  it('dispatching action after session is destroyed does not crash', async () => {
    vi.useFakeTimers();
    const actionView: ViewDefinition = {
      viewId: 'destroy-action-view',
      version: '1',
      nodes: [
        { id: 'btn', type: 'action', intentId: 'ok_action', label: 'OK' },
      ],
    };
    let hookResult: ReturnType<typeof useContinuumAction> | null = null;
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(actionView);
      hookResult = useContinuumAction('ok_action');
      return null;
    }
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={{ ...componentMap, action: () => <div /> }}
        sessionOptions={{
          actions: {
            ok_action: {
              registration: { label: 'OK' },
              handler: async () => ({ success: true, data: 'ok' }),
            },
          },
        }}
      >
        <App />
      </ContinuumProvider>
    );
    rendered.unmount();
    vi.runAllTimers();
    await act(async () => {
      try {
        await requireSession(hookResult).dispatch('btn');
      } catch {
        /* graceful failure */
      }
    });
    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it('calling useContinuumState setValue after session destroy does not throw', () => {
    vi.useFakeTimers();
    let setVal: ((v: NodeValue) => void) | null = null;
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(simpleView);
      [, setVal] = useContinuumState('f1');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    rendered.unmount();
    vi.runAllTimers();
    expect(() => {
      act(() => {
        try {
          requireSession(setVal)({ value: 'after-destroy' });
        } catch {
          /* ok */
        }
      });
    }).not.toThrow();
    vi.useRealTimers();
  });

  it('multiple setState calls within single act batch to single update', () => {
    let renderCount = 0;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      useContinuumState('f1');
      renderCount++;
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const beforeBatch = renderCount;
    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'a' });
      requireSession(capturedSession).updateState('f1', { value: 'b' });
      requireSession(capturedSession).updateState('f1', { value: 'c' });
    });
    expect(renderCount - beforeBatch).toBeLessThanOrEqual(3);
    const f1 = requireSession(capturedSession).getSnapshot()?.data.values[
      'f1'
    ] as NodeValue | undefined;
    expect(f1?.value).toBe('c');
    rendered.unmount();
  });

  it('component receiving undefined value does not crash', () => {
    const map = {
      field: ({
        value,
        definition,
      }: {
        value: NodeValue | undefined;
        definition: { id: string };
      }) => (
        <div data-testid={`field-${definition.id}`}>
          {value === undefined ? 'no-value' : 'has-value'}
        </div>
      ),
    };
    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(simpleView);
      return <ContinuumRenderer view={simpleView} />;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={map}>
        <App />
      </ContinuumProvider>
    );
    expect(
      rendered.container.querySelector('[data-testid="field-f1"]')?.textContent
    ).toBe('no-value');
    rendered.unmount();
  });

  it('component onChange returning nothing does not break state', () => {
    let setVal: ((v: NodeValue) => void) | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      capturedSession = useContinuumSession();
      if (!capturedSession.getSnapshot()) capturedSession.pushView(simpleView);
      [, setVal] = useContinuumState('f1');
      return null;
    }
    const rendered = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    act(() => {
      requireSession(setVal)({ value: undefined });
    });
    const f1 = requireSession(capturedSession).getSnapshot()?.data.values[
      'f1'
    ] as NodeValue | undefined;
    expect(f1?.value).toBeUndefined();
    rendered.unmount();
  });
});
