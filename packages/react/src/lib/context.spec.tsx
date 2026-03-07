import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { useContext, useRef, useState } from 'react';
import { ContinuumProvider, ContinuumContext } from './context.js';
import type { ContinuumContextValue, ContinuumStore } from './context.js';
import { useContinuumSession, useContinuumState } from './hooks.js';
import type { ViewDefinition, NodeValue, ContinuitySnapshot } from '@continuum/contract';
import type { Session } from '@continuum/session';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const simpleView: ViewDefinition = {
  viewId: 'v1',
  version: '1',
  nodes: [
    { id: 'f1', type: 'field', dataType: 'string' },
    { id: 'f2', type: 'field', dataType: 'string' },
  ],
};

const componentMap = { field: () => <div /> };

function captureContext(ref: { current: ContinuumContextValue | null }) {
  return function Probe() {
    ref.current = useContext(ContinuumContext);
    return null;
  };
}

describe('notifyListeners (via store subscriptions)', () => {
  it('calls all registered listeners exactly once', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    let store: ContinuumStore | null = null;
    let session: Session | null = null;

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    store!.subscribeSnapshot(listenerA);
    store!.subscribeSnapshot(listenerB);

    act(() => {
      session!.pushView(simpleView);
    });

    expect(listenerA).toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalled();
    unmount();
  });

  it('tolerates listener that removes itself during iteration', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const survivingListener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    let cleanup: (() => void) | null = null;
    const selfRemovingListener = vi.fn(() => {
      if (cleanup) cleanup();
    });
    cleanup = store!.subscribeSnapshot(selfRemovingListener);
    store!.subscribeSnapshot(survivingListener);

    act(() => {
      session!.pushView(simpleView);
    });

    expect(selfRemovingListener).toHaveBeenCalled();
    expect(survivingListener).toHaveBeenCalled();
    unmount();
  });

  it('handles empty listener set without error', () => {
    let session: Session | null = null;

    function Probe() {
      const ctx = useContext(ContinuumContext);
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    expect(() => {
      act(() => {
        session!.pushView(simpleView);
      });
    }).not.toThrow();
    unmount();
  });

  it('isolates thrown listeners without dropping or duplicating later deliveries', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const deliveryOrder: string[] = [];
    const secondListener = vi.fn(() => {
      deliveryOrder.push(
        String((store?.getSnapshot()?.data.values?.['f1'] as NodeValue | undefined)?.value ?? 'unset')
      );
    });
    const thirdListener = vi.fn(() => {
      deliveryOrder.push(
        String((store?.getSnapshot()?.data.values?.['f1'] as NodeValue | undefined)?.value ?? 'unset')
      );
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    store!.subscribeSnapshot(() => {
      deliveryOrder.push('throw');
      throw new Error('boom');
    });
    store!.subscribeSnapshot(secondListener);
    store!.subscribeSnapshot(thirdListener);

    act(() => {
      session!.pushView(simpleView);
    });

    expect(secondListener).toHaveBeenCalledTimes(1);
    expect(thirdListener).toHaveBeenCalledTimes(1);
    expect(deliveryOrder).toEqual(['throw', 'unset', 'unset']);

    act(() => {
      session!.updateState('f1', { value: 'after-update' });
    });

    expect(secondListener).toHaveBeenCalledTimes(2);
    expect(thirdListener).toHaveBeenCalledTimes(2);
    expect(store!.getSnapshot()?.data.values?.['f1']).toEqual({ value: 'after-update' });
    expect(deliveryOrder).toEqual([
      'throw',
      'unset',
      'unset',
      'throw',
      'after-update',
      'after-update',
    ]);
    consoleSpy.mockRestore();
    unmount();
  });
});

describe('getChangedNodeIds (via store node subscriptions)', () => {
  it('returns empty array when previous is null (notifies all node listeners)', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const f1Listener = vi.fn();
    const f2Listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    store!.subscribeNode('f1', f1Listener);
    store!.subscribeNode('f2', f2Listener);

    act(() => {
      session!.pushView(simpleView);
    });

    expect(f1Listener).toHaveBeenCalled();
    expect(f2Listener).toHaveBeenCalled();
    unmount();
  });

  it('returns empty array when next is null', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const f1Listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
    });

    f1Listener.mockClear();
    store!.subscribeNode('f1', f1Listener);

    act(() => {
      session!.reset();
    });

    expect(f1Listener).toHaveBeenCalled();
    unmount();
  });

  it('returns empty array when both are null', () => {
    let store: ContinuumStore | null = null;
    const f1Listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    store!.subscribeNode('f1', f1Listener);
    expect(f1Listener).not.toHaveBeenCalled();
    unmount();
  });

  it('returns empty array when values and viewContext refs are identical', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const f1Listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
    });

    store!.subscribeNode('f1', f1Listener);
    f1Listener.mockClear();

    act(() => {
      session!.checkpoint();
    });

    expect(f1Listener).not.toHaveBeenCalled();
    unmount();
  });

  it('detects added node id in next that was not in previous', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const f1Listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
    });

    store!.subscribeNode('f1', f1Listener);
    f1Listener.mockClear();

    act(() => {
      session!.updateState('f1', { value: 'hello' });
    });

    expect(f1Listener).toHaveBeenCalled();
    unmount();
  });

  it('detects removed node id present in previous but not in next', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const f1Listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
      session!.updateState('f1', { value: 'exists' });
    });

    store!.subscribeNode('f1', f1Listener);
    f1Listener.mockClear();

    const viewWithoutF1: ViewDefinition = {
      viewId: 'v1',
      version: '2',
      nodes: [{ id: 'f2', type: 'field', dataType: 'string' }],
    };
    act(() => {
      session!.pushView(viewWithoutF1);
    });

    expect(f1Listener).toHaveBeenCalled();
    unmount();
  });

  it('detects changed value reference for same node id', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const f1Listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
      session!.updateState('f1', { value: 'first' });
    });

    store!.subscribeNode('f1', f1Listener);
    f1Listener.mockClear();

    act(() => {
      session!.updateState('f1', { value: 'second' });
    });

    expect(f1Listener).toHaveBeenCalled();
    unmount();
  });

  it('detects changed viewContext reference for same node id', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const f1Listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
    });

    store!.subscribeNode('f1', f1Listener);
    f1Listener.mockClear();

    act(() => {
      session!.updateViewportState('f1', { isFocused: true });
    });

    expect(f1Listener).toHaveBeenCalled();
    unmount();
  });

  it('does not fire listener for node whose value ref has not changed', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const f1Listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
      session!.updateState('f1', { value: 'first' });
    });

    store!.subscribeNode('f1', f1Listener);
    f1Listener.mockClear();

    act(() => {
      session!.updateState('f2', { value: 'changed-f2' });
    });

    expect(f1Listener).not.toHaveBeenCalled();
    unmount();
  });

  it('handles snapshots with empty values and viewContext objects', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const emptyView: ViewDefinition = {
      viewId: 'empty',
      version: '1',
      nodes: [],
    };

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    store!.subscribeNode('nonexistent', listener);

    act(() => {
      session!.pushView(emptyView);
    });

    expect(listener).toHaveBeenCalled();
    unmount();
  });
});

describe('createContinuumStore (via context capture)', () => {
  it('getSnapshot returns session initial snapshot', () => {
    let store: ContinuumStore | null = null;

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    expect(store!.getSnapshot()).toBeNull();
    unmount();
  });

  it('subscribeSnapshot listener fires on session snapshot change', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    store!.subscribeSnapshot(listener);

    act(() => {
      session!.pushView(simpleView);
    });

    expect(listener).toHaveBeenCalled();
    unmount();
  });

  it('subscribeDiagnostics listener fires on snapshot change', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    store!.subscribeDiagnostics(listener);

    act(() => {
      session!.pushView(simpleView);
    });

    expect(listener).toHaveBeenCalled();
    unmount();
  });

  it('subscribeDiagnostics listener fires on issues change', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
    });

    store!.subscribeDiagnostics(listener);
    listener.mockClear();

    const mismatchView: ViewDefinition = {
      viewId: 'v1',
      version: '2',
      nodes: [{ id: 'f1', type: 'field', dataType: 'number' }],
    };
    act(() => {
      session!.pushView(mismatchView);
    });

    expect(listener).toHaveBeenCalled();
    unmount();
  });

  it('subscribeNode listener fires only for the matching node id on value change', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const f1Listener = vi.fn();
    const f2Listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
    });

    store!.subscribeNode('f1', f1Listener);
    store!.subscribeNode('f2', f2Listener);
    f1Listener.mockClear();
    f2Listener.mockClear();

    act(() => {
      session!.updateState('f1', { value: 'changed' });
    });

    expect(f1Listener).toHaveBeenCalled();
    expect(f2Listener).not.toHaveBeenCalled();
    unmount();
  });

  it('subscribeNode does not fire listener for unrelated node id changes', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const f1Listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
    });

    store!.subscribeNode('f1', f1Listener);
    f1Listener.mockClear();

    act(() => {
      session!.updateState('f2', { value: 'changed' });
    });

    expect(f1Listener).not.toHaveBeenCalled();
    unmount();
  });

  it('subscribeSnapshot cleanup stops notifications after unsubscribe', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    const cleanup = store!.subscribeSnapshot(listener);
    cleanup();
    listener.mockClear();

    act(() => {
      session!.pushView(simpleView);
    });

    expect(listener).not.toHaveBeenCalled();
    unmount();
  });

  it('subscribeNode cleanup removes listener set entry when last listener removed', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const listener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
    });

    const cleanup = store!.subscribeNode('f1', listener);
    cleanup();
    listener.mockClear();

    act(() => {
      session!.updateState('f1', { value: 'nope' });
    });

    expect(listener).not.toHaveBeenCalled();
    unmount();
  });

  it('getNodeValue returns undefined for unknown node id', () => {
    let store: ContinuumStore | null = null;

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    expect(store!.getNodeValue('nonexistent')).toBeUndefined();
    unmount();
  });

  it('getNodeValue returns correct value for known node id', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
      session!.updateState('f1', { value: 'hello' });
    });

    expect(store!.getNodeValue('f1')).toEqual({ value: 'hello' });
    unmount();
  });

  it('getNodeViewport returns undefined when no viewport set', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
    });

    expect(store!.getNodeViewport('f1')).toBeUndefined();
    unmount();
  });

  it('getNodeViewport returns viewport for known node id', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
      session!.updateViewportState('f1', { scrollX: 10, zoom: 2 });
    });

    expect(store!.getNodeViewport('f1')).toEqual({ scrollX: 10, zoom: 2 });
    unmount();
  });

  it('destroy stops all notifications and clears listeners', () => {
    let store: ContinuumStore | null = null;
    let session: Session | null = null;
    const snapshotListener = vi.fn();
    const nodeListener = vi.fn();

    function Probe() {
      const ctx = useContext(ContinuumContext);
      store = ctx?.store ?? null;
      session = ctx?.session ?? null;
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
    });

    store!.subscribeSnapshot(snapshotListener);
    store!.subscribeNode('f1', nodeListener);

    store!.destroy();
    snapshotListener.mockClear();
    nodeListener.mockClear();

    act(() => {
      session!.updateState('f1', { value: 'after-destroy' });
    });

    expect(snapshotListener).not.toHaveBeenCalled();
    expect(nodeListener).not.toHaveBeenCalled();

    unmount();
  });
});

describe('resolveStorage (via ContinuumProvider persist)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns localStorage for localStorage', () => {
    vi.useFakeTimers();
    let session: Session | null = null;

    function Probe() {
      session = useContinuumSession();
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap} persist="localStorage">
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
      session!.updateState('f1', { value: 'persisted' });
      vi.runAllTimers();
    });

    expect(localStorage.getItem('continuum_session')).not.toBeNull();
    unmount();
    vi.useRealTimers();
  });

  it('returns sessionStorage for sessionStorage', () => {
    vi.useFakeTimers();
    let session: Session | null = null;

    function Probe() {
      session = useContinuumSession();
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap} persist="sessionStorage">
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
      session!.updateState('f1', { value: 'persisted' });
      vi.runAllTimers();
    });

    expect(sessionStorage.getItem('continuum_session')).not.toBeNull();
    unmount();
    vi.useRealTimers();
  });

  it('returns undefined for false', () => {
    vi.useFakeTimers();
    let session: Session | null = null;

    function Probe() {
      session = useContinuumSession();
      return null;
    }

    const { unmount } = render(
      <ContinuumProvider components={componentMap} persist={false}>
        <Probe />
      </ContinuumProvider>
    );

    act(() => {
      session!.pushView(simpleView);
      session!.updateState('f1', { value: 'persisted' });
      vi.runAllTimers();
    });

    expect(localStorage.getItem('continuum_session')).toBeNull();
    expect(sessionStorage.getItem('continuum_session')).toBeNull();
    unmount();
    vi.useRealTimers();
  });
});

describe('mapsMatch (via ContinuumProvider re-renders)', () => {
  it('returns true for identical refs', () => {
    const renderCounts = { inner: 0 };
    const singleMap = { field: () => { renderCounts.inner++; return <div />; } };

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(simpleView);
      return <div data-testid="r">{renderCounts.inner}</div>;
    }

    const { unmount, getByTestId } = render(
      <ContinuumProvider components={singleMap}>
        <App />
      </ContinuumProvider>
    );

    expect(getByTestId('r')).toBeDefined();
    unmount();
  });

  it('returns true for same keys with same component refs', () => {
    const renderCounts = { field: 0 };
    const fieldComp = () => { renderCounts.field++; return <div data-testid="stable-field" />; };

    function ProviderShell() {
      const [tick, setTick] = useState(0);
      return (
        <div>
          <button data-testid="rerender-btn" onClick={() => setTick(t => t + 1)}>{tick}</button>
          <ContinuumProvider components={{ field: fieldComp }}>
            <InnerApp />
          </ContinuumProvider>
        </div>
      );
    }

    function InnerApp() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(simpleView);
      return null;
    }

    const { unmount, getByTestId } = render(<ProviderShell />);
    const initialCount = renderCounts.field;

    act(() => {
      getByTestId('rerender-btn').click();
    });

    expect(renderCounts.field).toBe(initialCount);
    unmount();
  });

  it('returns false when key count differs', () => {
    let contextValue: ContinuumContextValue | null = null;
    const fieldComp = () => <div />;

    function InnerApp() {
      contextValue = useContext(ContinuumContext);
      return null;
    }

    const { unmount, rerender } = render(
      <ContinuumProvider components={{ field: fieldComp }}>
        <InnerApp />
      </ContinuumProvider>
    );

    const firstMap = contextValue!.componentMap;

    rerender(
      <ContinuumProvider components={{ field: fieldComp, group: fieldComp }}>
        <InnerApp />
      </ContinuumProvider>
    );

    expect(contextValue!.componentMap).not.toBe(firstMap);
    unmount();
  });

  it('returns false when same keys but different component refs', () => {
    let contextValue: ContinuumContextValue | null = null;

    function InnerApp() {
      contextValue = useContext(ContinuumContext);
      return null;
    }

    const compA = () => <div />;
    const compB = () => <span />;

    const { unmount, rerender } = render(
      <ContinuumProvider components={{ field: compA }}>
        <InnerApp />
      </ContinuumProvider>
    );

    const firstMap = contextValue!.componentMap;

    rerender(
      <ContinuumProvider components={{ field: compB }}>
        <InnerApp />
      </ContinuumProvider>
    );

    expect(contextValue!.componentMap).not.toBe(firstMap);
    unmount();
  });
});

describe('useStableMap (via provider)', () => {
  it('returns same reference when map contents match', () => {
    const maps: object[] = [];
    const fieldComp = () => <div />;

    function InnerApp() {
      const ctx = useContext(ContinuumContext);
      if (ctx) maps.push(ctx.componentMap);
      return null;
    }

    function Shell() {
      const [tick, setTick] = useState(0);
      return (
        <div>
          <button data-testid="tick" onClick={() => setTick(t => t + 1)}>{tick}</button>
          <ContinuumProvider components={{ field: fieldComp }}>
            <InnerApp />
          </ContinuumProvider>
        </div>
      );
    }

    const { unmount, getByTestId } = render(<Shell />);

    act(() => {
      getByTestId('tick').click();
    });

    if (maps.length >= 2) {
      expect(maps[0]).toBe(maps[1]);
    }
    unmount();
  });

  it('returns new reference when a component is added', () => {
    const maps: object[] = [];
    const fieldComp = () => <div />;
    const groupComp = () => <div />;

    function InnerApp() {
      const ctx = useContext(ContinuumContext);
      if (ctx) maps.push(ctx.componentMap);
      return null;
    }

    const { unmount, rerender } = render(
      <ContinuumProvider components={{ field: fieldComp }}>
        <InnerApp />
      </ContinuumProvider>
    );

    rerender(
      <ContinuumProvider components={{ field: fieldComp, group: groupComp }}>
        <InnerApp />
      </ContinuumProvider>
    );

    expect(maps.length).toBeGreaterThanOrEqual(2);
    expect(maps[0]).not.toBe(maps[maps.length - 1]);
    unmount();
  });

  it('returns new reference when a component is replaced', () => {
    const maps: object[] = [];
    const compA = () => <div />;
    const compB = () => <span />;

    function InnerApp() {
      const ctx = useContext(ContinuumContext);
      if (ctx) maps.push(ctx.componentMap);
      return null;
    }

    const { unmount, rerender } = render(
      <ContinuumProvider components={{ field: compA }}>
        <InnerApp />
      </ContinuumProvider>
    );

    rerender(
      <ContinuumProvider components={{ field: compB }}>
        <InnerApp />
      </ContinuumProvider>
    );

    expect(maps.length).toBeGreaterThanOrEqual(2);
    expect(maps[0]).not.toBe(maps[maps.length - 1]);
    unmount();
  });

  it('returns stable ref across multiple renders with equivalent maps', () => {
    const maps: object[] = [];
    const fieldComp = () => <div />;

    function InnerApp() {
      const ctx = useContext(ContinuumContext);
      if (ctx) maps.push(ctx.componentMap);
      return null;
    }

    function Shell() {
      const [tick, setTick] = useState(0);
      return (
        <div>
          <button data-testid="multi-tick" onClick={() => setTick(t => t + 1)}>{tick}</button>
          <ContinuumProvider components={{ field: fieldComp }}>
            <InnerApp />
          </ContinuumProvider>
        </div>
      );
    }

    const { unmount, getByTestId } = render(<Shell />);

    act(() => { getByTestId('multi-tick').click(); });
    act(() => { getByTestId('multi-tick').click(); });
    act(() => { getByTestId('multi-tick').click(); });

    const uniqueMaps = new Set(maps);
    expect(uniqueMaps.size).toBe(1);
    unmount();
  });
});
