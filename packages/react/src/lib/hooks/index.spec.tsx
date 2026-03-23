import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import {
  NodeStateScopeContext,
  useContinuumRestoreCandidates,
  useContinuumRestoreReviews,
  useContinuumSuggestions,
  useContinuumSession,
  useContinuumState,
  useContinuumSnapshot,
  useContinuumCommittedSnapshot,
  useContinuumDiagnostics,
  useContinuumStreaming,
  useContinuumStreams,
  useContinuumFocus,
  useContinuumAction,
  useContinuumHydrated,
  useContinuumConflict,
} from './index.js';
import {
  ContinuumProvider,
  ContinuumRenderScopeContext,
} from '../context/index.js';
import type { NodeValue, ViewDefinition } from '@continuum-dev/contract';

function requireSession<T>(value: T | null): T {
  if (!value) {
    throw new Error('Expected session to be captured');
  }
  return value;
}

describe('useContinuumSuggestions', () => {
  const componentMap = {
    field: () => <div />,
  };

  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [
      { id: 'f1', type: 'field', dataType: 'string', key: 'firstName' },
      { id: 'f2', type: 'field', dataType: 'string', key: 'lastName' },
    ],
  };

  it('initially has no suggestions', () => {
    function App() {
      const suggestions = useContinuumSuggestions();
      const session = useContinuumSession();
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return (
        <div data-testid="has-suggestions">
          {suggestions.hasSuggestions ? 'true' : 'false'}
        </div>
      );
    }

    const { getByTestId } = render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(getByTestId('has-suggestions').textContent).toBe('false');
  });

  it('detects when suggestions exist', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    function App() {
      const suggestions = useContinuumSuggestions();
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return (
        <div data-testid="has-suggestions">
          {suggestions.hasSuggestions ? 'true' : 'false'}
        </div>
      );
    }

    const { getByTestId } = render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'John',
        suggestion: 'Jonathan',
        isDirty: true,
      });
    });

    expect(getByTestId('has-suggestions').textContent).toBe('true');
  });

  it('acceptAll updates values and clears suggestions and sets isDirty', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let suggestionsHook: ReturnType<typeof useContinuumSuggestions> | null =
      null;

    function App() {
      const suggestions = useContinuumSuggestions();
      const session = useContinuumSession();
      suggestionsHook = suggestions;
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return (
        <div data-testid="has-suggestions">
          {suggestions.hasSuggestions ? 'true' : 'false'}
        </div>
      );
    }

    const { getByTestId } = render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      const session = requireSession(capturedSession);
      session.updateState('f1', {
        value: 'John',
        suggestion: 'Jonathan',
        isDirty: true,
      });
      session.updateState('f2', {
        value: 'Doe',
        suggestion: 'Doherty',
        isDirty: true,
      });
    });

    expect(getByTestId('has-suggestions').textContent).toBe('true');

    act(() => {
      requireSession(suggestionsHook).acceptAll();
    });

    expect(getByTestId('has-suggestions').textContent).toBe('false');
    const snapshot = requireSession(
      requireSession(capturedSession).getSnapshot()
    );
    expect(snapshot.data.values['f1']).toEqual({
      value: 'Jonathan',
      isDirty: true,
    });
    expect(snapshot.data.values['f2']).toEqual({
      value: 'Doherty',
      isDirty: true,
    });
  });

  it('rejectAll clears suggestions and leaves values intact', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let suggestionsHook: ReturnType<typeof useContinuumSuggestions> | null =
      null;

    function App() {
      const suggestions = useContinuumSuggestions();
      const session = useContinuumSession();
      suggestionsHook = suggestions;
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return (
        <div data-testid="has-suggestions">
          {suggestions.hasSuggestions ? 'true' : 'false'}
        </div>
      );
    }

    const { getByTestId } = render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      const session = requireSession(capturedSession);
      session.updateState('f1', {
        value: 'John',
        suggestion: 'Jonathan',
        isDirty: true,
      });
      session.updateState('f2', {
        value: 'Doe',
        suggestion: 'Doherty',
        isDirty: true,
      });
    });

    expect(getByTestId('has-suggestions').textContent).toBe('true');

    act(() => {
      requireSession(suggestionsHook).rejectAll();
    });

    expect(getByTestId('has-suggestions').textContent).toBe('false');
    const snapshot = requireSession(
      requireSession(capturedSession).getSnapshot()
    );
    expect(snapshot.data.values['f1']).toEqual({
      value: 'John',
      isDirty: true,
    });
    expect(snapshot.data.values['f2']).toEqual({ value: 'Doe', isDirty: true });
  });
});

describe('useContinuumState', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
  };

  it('reads state and triggers re-renders on update', () => {
    let renderCount = 0;
    let hookState: NodeValue | undefined;
    let hookSetState: ((value: NodeValue) => void) | null = null;

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);

      const [state, setState] = useContinuumState('f1');
      hookState = state;
      hookSetState = setState;
      renderCount++;
      return <div data-testid="val">{String(state?.value)}</div>;
    }

    const { getByTestId } = render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(getByTestId('val').textContent).toBe('undefined');

    act(() => {
      requireSession(hookSetState)({ value: 'hello', isDirty: true });
    });

    expect(getByTestId('val').textContent).toBe('hello');
    expect(hookState).toEqual({ value: 'hello', isDirty: true });
    expect(renderCount).toBeGreaterThan(1);
  });
});

describe('useContinuumSnapshot', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
  };

  it('returns the current snapshot', () => {
    let hookSnapshot: ReturnType<typeof useContinuumSnapshot> = null;

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);

      hookSnapshot = useContinuumSnapshot();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(hookSnapshot).toBeDefined();
    expect(hookSnapshot?.view.viewId).toBe('v1');
  });

  it('keeps committed snapshot stable while a foreground stream updates the render snapshot', () => {
    let renderSnapshot: ReturnType<typeof useContinuumSnapshot> = null;
    let committedSnapshot: ReturnType<typeof useContinuumCommittedSnapshot> =
      null;
    let streamingState: ReturnType<typeof useContinuumStreaming> | null = null;
    let streams: ReturnType<typeof useContinuumStreams> = [];
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }

      renderSnapshot = useContinuumSnapshot();
      committedSnapshot = useContinuumCommittedSnapshot();
      streamingState = useContinuumStreaming();
      streams = useContinuumStreams();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      const stream = requireSession(capturedSession).beginStream({
        targetViewId: 'v1',
        mode: 'foreground',
      });
      requireSession(capturedSession).applyStreamPart(stream.streamId, {
        kind: 'view',
        view: {
          ...viewDef,
          version: '2.0',
          nodes: [
            ...viewDef.nodes,
            { id: 'f2', type: 'field', dataType: 'string' },
          ],
        },
      });
    });

    expect(renderSnapshot?.view.version).toBe('2.0');
    expect(committedSnapshot?.view.version).toBe('1.0');
    expect(streamingState?.isStreaming).toBe(true);
    expect(streamingState?.activeStream?.viewVersion).toBe('2.0');
    expect(streams[0]?.status).toBe('open');
  });
});

describe('useContinuumFocus', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
  };

  it('reads and writes focus as boolean', () => {
    let focused: boolean | undefined;
    let setFocused: ((v: boolean) => void) | null = null;

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);

      const [isFocused, setFn] = useContinuumFocus('f1');
      focused = isFocused;
      setFocused = setFn;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(focused).toBe(false);

    act(() => requireSession(setFocused)(true));
    expect(focused).toBe(true);
  });

  it('warns when called inside node scope', () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    function App() {
      useContinuumFocus('f1');
      return null;
    }
    render(
      <ContinuumProvider components={componentMap}>
        <NodeStateScopeContext.Provider
          value={{
            subscribeNode: () => () => undefined,
            getNodeValue: () => undefined,
            setNodeValue: () => undefined,
          }}
        >
          <App />
        </NodeStateScopeContext.Provider>
      </ContinuumProvider>
    );
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('useContinuumDiagnostics', () => {
  const componentMap = { field: () => <div /> };

  it('returns diagnostic info like checkpoints and issues', () => {
    let diags: ReturnType<typeof useContinuumDiagnostics> | null = null;

    function App() {
      diags = useContinuumDiagnostics();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(diags).toBeDefined();
    expect(requireSession(diags).issues).toEqual([]);
    expect(requireSession(diags).checkpoints).toBeDefined();
  });
});

describe('useContinuumAction', () => {
  const componentMap = {
    field: () => <div />,
    action: () => <div />,
  };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [
      { id: 'f1', type: 'field', dataType: 'string' },
      { id: 'btn', type: 'action', intentId: 'do_it', label: 'Go' },
    ],
  };

  it('returns dispatch function and initial state', () => {
    let hookResult: ReturnType<typeof useContinuumAction> | null = null;

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);
      hookResult = useContinuumAction('do_it');
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(hookResult).toBeDefined();
    expect(typeof requireSession(hookResult).dispatch).toBe('function');
    expect(requireSession(hookResult).isDispatching).toBe(false);
    expect(requireSession(hookResult).lastResult).toBeNull();
  });

  it('updates lastResult after dispatch', async () => {
    let hookResult: ReturnType<typeof useContinuumAction> | null = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      hookResult = useContinuumAction('do_it');
      return (
        <div data-testid="result">
          {hookResult.lastResult?.success ? 'ok' : 'none'}
        </div>
      );
    }

    const { getByTestId } = render(
      <ContinuumProvider
        components={componentMap}
        sessionOptions={{
          actions: {
            do_it: {
              registration: { label: 'Go' },
              handler: () => ({ success: true, data: 'done' }),
            },
          },
        }}
      >
        <App />
      </ContinuumProvider>
    );

    expect(getByTestId('result').textContent).toBe('none');

    await act(async () => {
      await requireSession(hookResult).dispatch('btn');
    });

    expect(getByTestId('result').textContent).toBe('ok');
    expect(requireSession(hookResult).lastResult?.success).toBe(true);
    expect(requireSession(hookResult).lastResult?.data).toBe('done');
  });

  it('throws when used outside provider', () => {
    function Orphan() {
      useContinuumAction('test');
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(
      'useContinuumAction must be used within a <ContinuumProvider>'
    );
  });

  it('keeps dispatching true until latest dispatch settles', async () => {
    let hookResult: ReturnType<typeof useContinuumAction> | null = null;
    let firstResolve:
      | ((value: { success: true; data: string }) => void)
      | null = null;
    let secondResolve:
      | ((value: { success: true; data: string }) => void)
      | null = null;
    let callCount = 0;

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      hookResult = useContinuumAction('do_it');
      return (
        <div data-testid="dispatching">
          {hookResult.isDispatching ? 'true' : 'false'}
        </div>
      );
    }

    const { getByTestId } = render(
      <ContinuumProvider
        components={componentMap}
        sessionOptions={{
          actions: {
            do_it: {
              registration: { label: 'Go' },
              handler: async () => {
                callCount += 1;
                if (callCount === 1) {
                  return new Promise((resolve) => {
                    firstResolve = resolve;
                  });
                }
                return new Promise((resolve) => {
                  secondResolve = resolve;
                });
              },
            },
          },
        }}
      >
        <App />
      </ContinuumProvider>
    );

    await act(async () => {
      const promiseOne = requireSession(hookResult).dispatch('btn');
      const promiseTwo = requireSession(hookResult).dispatch('btn');
      requireSession(firstResolve)({ success: true, data: 'first-done' });
      await Promise.resolve();
      requireSession(secondResolve)({ success: true, data: 'second-done' });
      await Promise.all([promiseOne, promiseTwo]);
    });

    expect(getByTestId('dispatching').textContent).toBe('false');
    expect(requireSession(hookResult).lastResult?.data).toBe('second-done');
  });
});

describe('shallowArrayEqual (via diagnostics caching)', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
  };

  it('returns stable ref when issues array is same ref', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let diagsRef: ReturnType<typeof useContinuumDiagnostics> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      diagsRef = useContinuumDiagnostics();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const first = diagsRef;

    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'x' });
    });

    expect(diagsRef).toBe(first);
    expect(requireSession(diagsRef).issues).toBe(requireSession(first).issues);
    expect(requireSession(diagsRef).checkpoints).toBe(
      requireSession(first).checkpoints
    );
  });

  it('returns stable ref when issues array has identical elements', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let diagsRef: ReturnType<typeof useContinuumDiagnostics> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      diagsRef = useContinuumDiagnostics();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const first = diagsRef;

    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'a' });
    });

    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'b' });
    });

    expect(diagsRef).toBe(first);
    expect(requireSession(diagsRef).issues).toBe(requireSession(first).issues);
    expect(requireSession(diagsRef).checkpoints).toBe(
      requireSession(first).checkpoints
    );
    expect(requireSession(diagsRef).checkpoints.length).toBeGreaterThan(0);
  });

  it('returns new ref when issues length changes', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let diagsRef: ReturnType<typeof useContinuumDiagnostics> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      diagsRef = useContinuumDiagnostics();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const first = diagsRef;

    act(() => {
      requireSession(capturedSession).pushView({
        viewId: 'v1',
        version: '2.0',
        nodes: [
          { id: 'f1', type: 'field', dataType: 'string' },
          { id: 'f2', type: 'field', dataType: 'string' },
        ],
      });
    });

    expect(diagsRef).not.toBe(first);
  });

  it('returns new ref when one issue element differs', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let diagsRef: ReturnType<typeof useContinuumDiagnostics> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      diagsRef = useContinuumDiagnostics();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).pushView({
        viewId: 'v1',
        version: '2.0',
        nodes: [{ id: 'f1', type: 'field', dataType: 'number' }],
      });
    });
    const afterFirst = diagsRef;

    act(() => {
      requireSession(capturedSession).pushView({
        viewId: 'v1',
        version: '3.0',
        nodes: [{ id: 'f1', type: 'field', dataType: 'boolean' }],
      });
    });

    expect(diagsRef).not.toBe(afterFirst);
  });

  it('returns stable ref for two empty arrays', () => {
    let diagsRef: ReturnType<typeof useContinuumDiagnostics> | null = null;
    let triggerRerender: (() => void) | null = null;

    function App() {
      const [, setCount] = React.useState(0);
      triggerRerender = () => setCount((c) => c + 1);
      diagsRef = useContinuumDiagnostics();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const first = diagsRef;
    expect(requireSession(first).issues).toEqual([]);

    act(() => {
      requireSession(triggerRerender)();
    });

    expect(diagsRef).toBe(first);
    expect(requireSession(diagsRef).issues).toEqual([]);
  });
});

describe('shallowNodeValueEqual (via useContinuumState caching)', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
  };

  it('same ref returns same cached value', () => {
    let stateRef: NodeValue | undefined;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let triggerRerender: (() => void) | null = null;

    function App() {
      const [, setCount] = React.useState(0);
      triggerRerender = () => setCount((c) => c + 1);
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [state] = useContinuumState('f1');
      stateRef = state;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'stable',
        isDirty: true,
      });
    });
    const first = stateRef;
    expect(first?.value).toBe('stable');

    act(() => {
      requireSession(triggerRerender)();
    });

    expect(stateRef).toBe(first);
    expect(stateRef?.value).toBe('stable');
    expect(stateRef?.isDirty).toBe(true);
  });

  it('equal value/isDirty/isValid/suggestion returns cached value', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let stateRef: NodeValue | undefined;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [state] = useContinuumState('f1');
      stateRef = state;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'hello',
        isDirty: false,
        isValid: true,
        suggestion: 'hi',
      });
    });
    const first = stateRef;
    expect(first?.value).toBe('hello');
    expect(first?.suggestion).toBe('hi');

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'hello',
        isDirty: false,
        isValid: true,
        suggestion: 'hi',
      });
    });

    expect(stateRef).toBe(first);
    expect(stateRef?.value).toBe('hello');
    expect(stateRef?.isDirty).toBe(false);
    expect(stateRef?.isValid).toBe(true);
    expect(stateRef?.suggestion).toBe('hi');
  });

  it('returns new ref when value differs', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let stateRef: NodeValue | undefined;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [state] = useContinuumState('f1');
      stateRef = state;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'a',
        isDirty: false,
      });
    });
    const first = stateRef;

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'b',
        isDirty: false,
      });
    });

    expect(stateRef).not.toBe(first);
    expect(stateRef?.value).toBe('b');
  });

  it('returns new ref when isDirty differs', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let stateRef: NodeValue | undefined;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [state] = useContinuumState('f1');
      stateRef = state;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'x',
        isDirty: false,
      });
    });
    const first = stateRef;

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'x',
        isDirty: true,
      });
    });

    expect(stateRef).not.toBe(first);
  });

  it('returns new ref when suggestion differs', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let stateRef: NodeValue | undefined;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [state] = useContinuumState('f1');
      stateRef = state;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'x',
        suggestion: 'y',
      });
    });
    const first = stateRef;

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'x',
        suggestion: 'z',
      });
    });

    expect(stateRef).not.toBe(first);
  });

  it('left undefined returns new ref', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let stateRef: NodeValue | undefined;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [state] = useContinuumState('f1');
      stateRef = state;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(stateRef).toBeUndefined();

    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'hello' });
    });

    expect(stateRef).toBeDefined();
    expect(stateRef?.value).toBe('hello');
  });

  it('right undefined returns new ref', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let stateRef: NodeValue | undefined;
    let hasPushed = false;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!hasPushed) {
        session.pushView(viewDef);
        hasPushed = true;
      }
      const [state] = useContinuumState('f1');
      stateRef = state;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'hello' });
    });
    expect(stateRef?.value).toBe('hello');

    act(() => {
      requireSession(capturedSession).reset();
    });

    expect(stateRef).toBeUndefined();
  });
});

describe('useContinuumFocus subscription behavior', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
  };

  it('keeps focus true when unrelated value updates occur', () => {
    let focusedRef: boolean | undefined;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [isFocused] = useContinuumFocus('f1');
      focusedRef = isFocused;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).setFocusedNodeId('f1');
    });
    expect(focusedRef).toBe(true);

    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'x' });
    });

    expect(focusedRef).toBe(true);
  });

  it('clears focus when session resets', () => {
    let focusedRef: boolean | undefined;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let hasPushed = false;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!hasPushed) {
        session.pushView(viewDef);
        hasPushed = true;
      }
      const [isFocused] = useContinuumFocus('f1');
      focusedRef = isFocused;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).setFocusedNodeId('f1');
    });
    expect(focusedRef).toBe(true);

    act(() => {
      requireSession(capturedSession).reset();
    });

    expect(focusedRef).toBe(false);
  });
});

describe('useContinuumSession additional', () => {
  const componentMap = { field: () => <div /> };

  it('returns session from context', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      capturedSession = useContinuumSession();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(capturedSession).toBeDefined();
    expect(typeof requireSession(capturedSession).pushView).toBe('function');
    expect(typeof requireSession(capturedSession).getSnapshot).toBe('function');
  });

  it('throws with descriptive message outside provider', () => {
    function Orphan() {
      useContinuumSession();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(
      'useContinuumSession must be used within a <ContinuumProvider>'
    );
  });
});

describe('useContinuumState additional', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
  };

  it('returns undefined for node with no prior state', () => {
    let stateRef: NodeValue | undefined;

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [state] = useContinuumState('f1');
      stateRef = state;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(stateRef).toBeUndefined();
  });

  it('returns cached value ref on re-render when shallow-equal', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let stateRef: NodeValue | undefined;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [state] = useContinuumState('f1');
      stateRef = state;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'a',
        isDirty: true,
      });
    });
    const first = stateRef;

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'a',
        isDirty: true,
      });
    });

    expect(stateRef).toBe(first);
  });

  it('subscribes to scope when scope is present', () => {
    const subscribeSpy = vi.fn(() => () => undefined);
    const mockScope = {
      subscribeNode: subscribeSpy,
      getNodeValue: () => undefined,
      setNodeValue: vi.fn(),
    };

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);
      useContinuumState('f1');
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <NodeStateScopeContext.Provider value={mockScope}>
          <App />
        </NodeStateScopeContext.Provider>
      </ContinuumProvider>
    );

    expect(subscribeSpy).toHaveBeenCalledWith('f1', expect.any(Function));
  });

  it('subscribes to store when scope is null', () => {
    let stateRef: NodeValue | undefined;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [state] = useContinuumState('f1');
      stateRef = state;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).updateState('f1', {
        value: 'from-store',
      });
    });

    expect(stateRef?.value).toBe('from-store');
  });

  it('setValue calls scope.setNodeValue when scope present', () => {
    const setNodeValueSpy = vi.fn();
    const mockScope = {
      subscribeNode: vi.fn(() => () => undefined),
      getNodeValue: () => undefined,
      setNodeValue: setNodeValueSpy,
    };
    let hookSetState: ((value: NodeValue) => void) | null = null;

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [, setState] = useContinuumState('f1');
      hookSetState = setState;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <NodeStateScopeContext.Provider value={mockScope}>
          <App />
        </NodeStateScopeContext.Provider>
      </ContinuumProvider>
    );

    act(() => {
      requireSession(hookSetState)({ value: 'test', isDirty: true });
    });

    expect(setNodeValueSpy).toHaveBeenCalledWith('f1', {
      value: 'test',
      isDirty: true,
    });
  });

  it('setValue calls session.updateState when scope null', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let hookSetState: ((value: NodeValue) => void) | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [, setState] = useContinuumState('f1');
      hookSetState = setState;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(hookSetState)({ value: 'test', isDirty: true });
    });

    expect(
      requireSession(capturedSession).getSnapshot()?.data.values['f1']
    ).toEqual({ value: 'test', isDirty: true });
  });

  it('triggers re-render on value change', () => {
    let renderCount = 0;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      useContinuumState('f1');
      renderCount++;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const initialCount = renderCount;

    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'hello' });
    });

    expect(renderCount).toBeGreaterThan(initialCount);
  });

  it('does not re-render when unrelated node changes', () => {
    const viewDef2: ViewDefinition = {
      viewId: 'v1',
      version: '1.0',
      nodes: [
        { id: 'f1', type: 'field', dataType: 'string' },
        { id: 'f2', type: 'field', dataType: 'string' },
      ],
    };
    let renderCount = 0;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef2);
      useContinuumState('f1');
      renderCount++;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const initialCount = renderCount;

    act(() => {
      requireSession(capturedSession).updateState('f2', { value: 'other' });
    });

    expect(renderCount).toBe(initialCount);
  });
});

describe('useContinuumSnapshot additional', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
  };

  it('returns null when store has no snapshot', () => {
    let snapshotRef: ReturnType<typeof useContinuumSnapshot> = null;

    function App() {
      snapshotRef = useContinuumSnapshot();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(snapshotRef).toBeNull();
  });

  it('returns snapshot after pushView', () => {
    let snapshotRef: ReturnType<typeof useContinuumSnapshot> = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      snapshotRef = useContinuumSnapshot();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(snapshotRef).toBeNull();

    act(() => {
      requireSession(capturedSession).pushView(viewDef);
    });

    expect(snapshotRef).not.toBeNull();
    expect(snapshotRef?.view.viewId).toBe('v1');
  });

  it('caches snapshot ref when view and data refs unchanged', () => {
    let snapshotRef: ReturnType<typeof useContinuumSnapshot> = null;
    let triggerRerender: (() => void) | null = null;

    function App() {
      const [, setCount] = React.useState(0);
      triggerRerender = () => setCount((c) => c + 1);
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);
      snapshotRef = useContinuumSnapshot();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const first = snapshotRef;

    act(() => {
      requireSession(triggerRerender)();
    });

    expect(snapshotRef).toBe(first);
  });

  it('updates cached snapshot when view ref changes', () => {
    let snapshotRef: ReturnType<typeof useContinuumSnapshot> = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      snapshotRef = useContinuumSnapshot();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const first = snapshotRef;

    act(() => {
      requireSession(capturedSession).pushView({
        viewId: 'v2',
        version: '2.0',
        nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
      });
    });

    expect(snapshotRef).not.toBe(first);
    expect(snapshotRef?.view.viewId).toBe('v2');
  });

  it('updates when data changes', () => {
    let snapshotRef: ReturnType<typeof useContinuumSnapshot> = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      snapshotRef = useContinuumSnapshot();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const first = snapshotRef;

    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'changed' });
    });

    expect(snapshotRef).not.toBe(first);
    expect(
      (snapshotRef?.data.values['f1'] as NodeValue | undefined)?.value
    ).toBe('changed');
  });

  it('clears cache when snapshot becomes null', () => {
    let snapshotRef: ReturnType<typeof useContinuumSnapshot> = null;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let hasPushed = false;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!hasPushed) {
        session.pushView(viewDef);
        hasPushed = true;
      }
      snapshotRef = useContinuumSnapshot();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(snapshotRef).not.toBeNull();

    act(() => {
      requireSession(capturedSession).reset();
    });

    expect(snapshotRef).toBeNull();
  });
});

describe('useContinuumFocus additional', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [
      { id: 'f1', type: 'field', dataType: 'string' },
      { id: 'f2', type: 'field', dataType: 'string' },
    ],
  };

  it('returns false initially', () => {
    let focusedRef: boolean | undefined;

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [isFocused] = useContinuumFocus('f1');
      focusedRef = isFocused;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(focusedRef).toBe(false);
  });

  it('updates after setFocused true', () => {
    let focusedRef: boolean | undefined;
    let setFocusedFn: ((v: boolean) => void) | null = null;

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);
      const [isFocused, setFn] = useContinuumFocus('f1');
      focusedRef = isFocused;
      setFocusedFn = setFn;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(focusedRef).toBe(false);

    act(() => {
      requireSession(setFocusedFn)(true);
    });

    expect(focusedRef).toBe(true);
  });

  it('does not re-render f1 when f2 receives focus', () => {
    let renderCount = 0;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      useContinuumFocus('f1');
      renderCount++;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const initialCount = renderCount;

    act(() => {
      requireSession(capturedSession).setFocusedNodeId('f2');
    });

    expect(renderCount).toBe(initialCount);
  });

  it('updates when a pushed view removes the focused node', () => {
    let focusedRef: boolean | undefined;
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      const [isFocused] = useContinuumFocus('f1');
      focusedRef = isFocused;
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).setFocusedNodeId('f1');
    });
    expect(focusedRef).toBe(true);

    act(() => {
      requireSession(capturedSession).pushView({
        viewId: 'v1',
        version: '2.0',
        nodes: [{ id: 'f2', type: 'field', dataType: 'string' }],
      });
    });

    expect(focusedRef).toBe(false);
  });
});

describe('useContinuumDiagnostics additional', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
  };

  it('returns initial empty diagnostics', () => {
    let diagsRef: ReturnType<typeof useContinuumDiagnostics> | null = null;

    function App() {
      diagsRef = useContinuumDiagnostics();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(requireSession(diagsRef).issues).toEqual([]);
    expect(requireSession(diagsRef).checkpoints).toEqual([]);
  });

  it('caches diagnostics when shallow-equal', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let diagsRef: ReturnType<typeof useContinuumDiagnostics> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      diagsRef = useContinuumDiagnostics();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const first = diagsRef;

    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'changed' });
    });

    expect(diagsRef).toBe(first);
  });

  it('updates when issues change', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let diagsRef: ReturnType<typeof useContinuumDiagnostics> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      diagsRef = useContinuumDiagnostics();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'hello' });
    });
    const afterUpdate = diagsRef;

    act(() => {
      requireSession(capturedSession).pushView({
        viewId: 'v1',
        version: '2.0',
        nodes: [{ id: 'f1', type: 'action', intentId: 'x', label: 'Go' }],
      });
    });

    expect(diagsRef).not.toBe(afterUpdate);
  });

  it('updates when checkpoints change', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let diagsRef: ReturnType<typeof useContinuumDiagnostics> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      diagsRef = useContinuumDiagnostics();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    const first = diagsRef;

    act(() => {
      requireSession(capturedSession).pushView({
        viewId: 'v1',
        version: '2.0',
        nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
      });
    });

    expect(diagsRef).not.toBe(first);
    expect(requireSession(diagsRef).checkpoints.length).toBeGreaterThan(
      requireSession(first).checkpoints.length
    );
  });
});

describe('useContinuumHydrated', () => {
  const componentMap = { field: () => <div /> };

  it('returns false when no storage provided', () => {
    let hydrated = false;

    function App() {
      hydrated = useContinuumHydrated();
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(hydrated).toBe(false);
  });

  it('throws outside provider', () => {
    function Orphan() {
      useContinuumHydrated();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(
      'useContinuumHydrated must be used within a <ContinuumProvider>'
    );
  });
});

describe('useContinuumConflict', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1',
    version: '1.0',
    nodes: [
      { id: 'f1', type: 'field', dataType: 'string' },
      { id: 'f2', type: 'field', dataType: 'string' },
    ],
  };

  it('hasConflict is false initially', () => {
    let conflictResult: ReturnType<typeof useContinuumConflict> | null = null;

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);
      conflictResult = useContinuumConflict('f1');
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );
    expect(requireSession(conflictResult).hasConflict).toBe(false);
    expect(requireSession(conflictResult).proposal).toBeNull();
  });

  it('hasConflict becomes true after proposeValue', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let conflictResult: ReturnType<typeof useContinuumConflict> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      conflictResult = useContinuumConflict('f1');
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      const s = requireSession(capturedSession);
      s.updateState('f1', { value: 'typed', isDirty: true });
      s.proposeValue('f1', { value: 'ai-suggested' }, 'ai');
    });

    expect(requireSession(conflictResult).hasConflict).toBe(true);
    expect(requireSession(conflictResult).proposal?.proposedValue).toEqual({
      value: 'ai-suggested',
    });
  });

  it('accept calls session.acceptProposal', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let conflictResult: ReturnType<typeof useContinuumConflict> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      useContinuumState('f1');
      conflictResult = useContinuumConflict('f1');
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      const s = requireSession(capturedSession);
      s.updateState('f1', { value: 'typed', isDirty: true });
      s.proposeValue('f1', { value: 'ai-suggested' }, 'ai');
    });

    expect(requireSession(conflictResult).hasConflict).toBe(true);

    act(() => {
      requireSession(conflictResult).accept();
    });

    expect(requireSession(conflictResult).hasConflict).toBe(false);
    expect(
      requireSession(capturedSession).getSnapshot()?.data.values['f1']
    ).toEqual(expect.objectContaining({ value: 'ai-suggested' }));
  });

  it('reject calls session.rejectProposal', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let conflictResult: ReturnType<typeof useContinuumConflict> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      conflictResult = useContinuumConflict('f1');
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      const s = requireSession(capturedSession);
      s.updateState('f1', { value: 'typed', isDirty: true });
      s.proposeValue('f1', { value: 'ai-suggested' }, 'ai');
    });

    expect(requireSession(conflictResult).hasConflict).toBe(true);

    act(() => {
      requireSession(conflictResult).reject();
    });

    expect(requireSession(conflictResult).hasConflict).toBe(false);
    expect(
      (
        requireSession(capturedSession).getSnapshot()?.data.values[
          'f1'
        ] as NodeValue
      )?.value
    ).toBe('typed');
  });

  it('caches proposal reference when unchanged', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let conflictResult: ReturnType<typeof useContinuumConflict> | null = null;

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      if (!session.getSnapshot()) session.pushView(viewDef);
      conflictResult = useContinuumConflict('f1');
      return null;
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      const s = requireSession(capturedSession);
      s.updateState('f1', { value: 'typed', isDirty: true });
      s.proposeValue('f1', { value: 'ai-suggested' }, 'ai');
    });

    const firstProposal = requireSession(conflictResult).proposal;

    act(() => {
      requireSession(capturedSession).updateState('f2', { value: 'unrelated' });
    });

    expect(requireSession(conflictResult).proposal).toBe(firstProposal);
  });
});

describe('restore review hooks', () => {
  const componentMap = { field: () => <div />, group: () => <div /> };

  it('returns empty restore state outside a provider', () => {
    let reviews: ReturnType<typeof useContinuumRestoreReviews> = [];
    let candidates: ReturnType<typeof useContinuumRestoreCandidates> = [];

    function Orphan() {
      reviews = useContinuumRestoreReviews();
      candidates = useContinuumRestoreCandidates('email');
      return null;
    }

    render(<Orphan />);

    expect(reviews).toEqual([]);
    expect(candidates).toEqual([]);
  });

  it('returns draft-scoped candidates only for the active render scope', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let liveCandidates: ReturnType<typeof useContinuumRestoreCandidates> = [];
    let draftCandidates: ReturnType<typeof useContinuumRestoreCandidates> = [];
    let reviews: ReturnType<typeof useContinuumRestoreReviews> = [];

    function LiveScope() {
      liveCandidates = useContinuumRestoreCandidates('profile/secondary_email');
      return null;
    }

    function DraftScope({ streamId }: { streamId: string }) {
      draftCandidates = useContinuumRestoreCandidates(
        'profile/secondary_email'
      );
      return (
        <div data-testid="draft-scope" data-stream-id={streamId}>
          draft
        </div>
      );
    }

    function App() {
      const session = useContinuumSession();
      capturedSession = session;
      reviews = useContinuumRestoreReviews();

      if (!session.getSnapshot()) {
        session.pushView({
          viewId: 'profile',
          version: '1',
          nodes: [
            {
              id: 'profile',
              type: 'group',
              children: [
                {
                  id: 'email',
                  type: 'field',
                  dataType: 'string',
                  key: 'person.email',
                  semanticKey: 'person.email',
                  label: 'Email',
                },
              ],
            },
          ],
        });
      }

      const draftReview = reviews.find(
        (review) => review.scope.kind === 'draft'
      );
      return (
        <>
          <ContinuumRenderScopeContext.Provider value={{ kind: 'live' }}>
            <LiveScope />
          </ContinuumRenderScopeContext.Provider>
          {draftReview?.scope.kind === 'draft' ? (
            <ContinuumRenderScopeContext.Provider value={draftReview.scope}>
              <DraftScope streamId={draftReview.scope.streamId} />
            </ContinuumRenderScopeContext.Provider>
          ) : null}
        </>
      );
    }

    render(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    act(() => {
      const session = requireSession(capturedSession);
      session.updateState('profile/email', {
        value: 'user@example.com',
        isDirty: true,
      });
      const draft = session.beginStream({
        targetViewId: 'profile',
        mode: 'draft',
      });
      session.applyStreamPart(draft.streamId, {
        kind: 'view',
        view: {
          viewId: 'profile',
          version: '2',
          nodes: [
            {
              id: 'profile',
              type: 'group',
              children: [
                {
                  id: 'secondary_email',
                  type: 'field',
                  dataType: 'string',
                  key: 'person.secondaryEmail',
                  label: 'Secondary email',
                },
              ],
            },
          ],
        },
      });
    });

    expect(reviews).toHaveLength(1);
    expect(liveCandidates).toEqual([]);
    expect(draftCandidates).toEqual([
      expect.objectContaining({
        targetNodeId: 'profile/secondary_email',
      }),
    ]);
  });
});
