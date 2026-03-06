import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { 
  NodeStateScopeContext,
  useContinuumSuggestions,
  useContinuumSession,
  useContinuumState,
  useContinuumSnapshot,
  useContinuumDiagnostics,
  useContinuumViewport,
  useContinuumAction,
} from './hooks.js';
import { ContinuumProvider } from './context.js';
import type { NodeValue, ViewDefinition, ViewportState } from '@continuum/contract';

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
      return <div data-testid="has-suggestions">{suggestions.hasSuggestions ? 'true' : 'false'}</div>;
    }

    const { getByTestId } = render(<ContinuumProvider components={componentMap}><App /></ContinuumProvider>);
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
      return <div data-testid="has-suggestions">{suggestions.hasSuggestions ? 'true' : 'false'}</div>;
    }

    const { getByTestId } = render(<ContinuumProvider components={componentMap}><App /></ContinuumProvider>);
    
    act(() => {
      requireSession(capturedSession).updateState('f1', { value: 'John', suggestion: 'Jonathan', isDirty: true });
    });

    expect(getByTestId('has-suggestions').textContent).toBe('true');
  });

  it('acceptAll updates values and clears suggestions and sets isDirty', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let suggestionsHook: ReturnType<typeof useContinuumSuggestions> | null = null;

    function App() {
      const suggestions = useContinuumSuggestions();
      const session = useContinuumSession();
      suggestionsHook = suggestions;
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return <div data-testid="has-suggestions">{suggestions.hasSuggestions ? 'true' : 'false'}</div>;
    }

    const { getByTestId } = render(<ContinuumProvider components={componentMap}><App /></ContinuumProvider>);
    
    act(() => {
      const session = requireSession(capturedSession);
      session.updateState('f1', { value: 'John', suggestion: 'Jonathan', isDirty: true });
      session.updateState('f2', { value: 'Doe', suggestion: 'Doherty', isDirty: true });
    });

    expect(getByTestId('has-suggestions').textContent).toBe('true');

    act(() => {
      requireSession(suggestionsHook).acceptAll();
    });

    expect(getByTestId('has-suggestions').textContent).toBe('false');
    const snapshot = requireSession(requireSession(capturedSession).getSnapshot());
    expect(snapshot.data.values['f1']).toEqual({ value: 'Jonathan', isDirty: true });
    expect(snapshot.data.values['f2']).toEqual({ value: 'Doherty', isDirty: true });
  });

  it('rejectAll clears suggestions and leaves values intact', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let suggestionsHook: ReturnType<typeof useContinuumSuggestions> | null = null;

    function App() {
      const suggestions = useContinuumSuggestions();
      const session = useContinuumSession();
      suggestionsHook = suggestions;
      capturedSession = session;
      if (!session.getSnapshot()) {
        session.pushView(viewDef);
      }
      return <div data-testid="has-suggestions">{suggestions.hasSuggestions ? 'true' : 'false'}</div>;
    }

    const { getByTestId } = render(<ContinuumProvider components={componentMap}><App /></ContinuumProvider>);
    
    act(() => {
      const session = requireSession(capturedSession);
      session.updateState('f1', { value: 'John', suggestion: 'Jonathan', isDirty: true });
      session.updateState('f2', { value: 'Doe', suggestion: 'Doherty', isDirty: true });
    });

    expect(getByTestId('has-suggestions').textContent).toBe('true');

    act(() => {
      requireSession(suggestionsHook).rejectAll();
    });

    expect(getByTestId('has-suggestions').textContent).toBe('false');
    const snapshot = requireSession(requireSession(capturedSession).getSnapshot());
    expect(snapshot.data.values['f1']).toEqual({ value: 'John', isDirty: true });
    expect(snapshot.data.values['f2']).toEqual({ value: 'Doe', isDirty: true });
  });
});

describe('useContinuumState', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1', version: '1.0',
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

    const { getByTestId } = render(<ContinuumProvider components={componentMap}><App /></ContinuumProvider>);
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
    viewId: 'v1', version: '1.0',
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

    render(<ContinuumProvider components={componentMap}><App /></ContinuumProvider>);
    expect(hookSnapshot).toBeDefined();
    expect(hookSnapshot?.view.viewId).toBe('v1');
  });
});

describe('useContinuumViewport', () => {
  const componentMap = { field: () => <div /> };
  const viewDef: ViewDefinition = {
    viewId: 'v1', version: '1.0',
    nodes: [{ id: 'f1', type: 'field', dataType: 'string' }],
  };

  it('reads and writes viewport state', () => {
    let hookViewport: ViewportState | undefined;
    let setHookViewport: ((state: ViewportState) => void) | null = null;

    function App() {
      const session = useContinuumSession();
      if (!session.getSnapshot()) session.pushView(viewDef);
      
      const [viewport, setViewport] = useContinuumViewport('f1');
      hookViewport = viewport;
      setHookViewport = setViewport;
      return null;
    }

    render(<ContinuumProvider components={componentMap}><App /></ContinuumProvider>);
    expect(hookViewport).toBeUndefined();

    act(() => requireSession(setHookViewport)({ isFocused: true }));
    expect(hookViewport).toEqual({ isFocused: true });
  });

  it('warns when called inside node scope', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    function App() {
      useContinuumViewport('f1');
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

    render(<ContinuumProvider components={componentMap}><App /></ContinuumProvider>);
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

    render(<ContinuumProvider components={componentMap}><App /></ContinuumProvider>);
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
      return <div data-testid="result">{hookResult.lastResult?.success ? 'ok' : 'none'}</div>;
    }

    const { getByTestId } = render(
      <ContinuumProvider components={componentMap} sessionOptions={{
        actions: {
          do_it: {
            registration: { label: 'Go' },
            handler: () => ({ success: true, data: 'done' }),
          },
        },
      }}><App /></ContinuumProvider>
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
    expect(() => render(<Orphan />)).toThrow('useContinuumAction must be used within a <ContinuumProvider>');
  });

  it('keeps dispatching true until latest dispatch settles', async () => {
    let hookResult: ReturnType<typeof useContinuumAction> | null = null;
    let firstResolve: ((value: { success: true; data: string }) => void) | null = null;
    let secondResolve: ((value: { success: true; data: string }) => void) | null = null;
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
      <ContinuumProvider components={componentMap} sessionOptions={{
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
      }}><App /></ContinuumProvider>
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
