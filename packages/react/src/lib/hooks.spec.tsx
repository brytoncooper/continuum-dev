import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { useContinuumSuggestions, useContinuumSession } from './hooks.js';
import { ContinuumProvider } from './context.js';
import { ViewDefinition } from '@continuum/contract';

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
      capturedSession!.updateState('f1', { value: 'John', suggestion: 'Jonathan', isDirty: true });
    });

    expect(getByTestId('has-suggestions').textContent).toBe('true');
  });

  it('acceptAll updates values and clears suggestions and sets isDirty', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let suggestionsHook: any = null;

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
      capturedSession!.updateState('f1', { value: 'John', suggestion: 'Jonathan', isDirty: true });
      capturedSession!.updateState('f2', { value: 'Doe', suggestion: 'Doherty', isDirty: true });
    });

    expect(getByTestId('has-suggestions').textContent).toBe('true');

    act(() => {
      suggestionsHook.acceptAll();
    });

    expect(getByTestId('has-suggestions').textContent).toBe('false');
    const snapshot = capturedSession!.getSnapshot()!;
    expect(snapshot.data.values['f1']).toEqual({ value: 'Jonathan', isDirty: true });
    expect(snapshot.data.values['f2']).toEqual({ value: 'Doherty', isDirty: true });
  });

  it('rejectAll clears suggestions and leaves values intact', () => {
    let capturedSession: ReturnType<typeof useContinuumSession> | null = null;
    let suggestionsHook: any = null;

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
      capturedSession!.updateState('f1', { value: 'John', suggestion: 'Jonathan', isDirty: true });
      capturedSession!.updateState('f2', { value: 'Doe', suggestion: 'Doherty', isDirty: true });
    });

    expect(getByTestId('has-suggestions').textContent).toBe('true');

    act(() => {
      suggestionsHook.rejectAll();
    });

    expect(getByTestId('has-suggestions').textContent).toBe('false');
    const snapshot = capturedSession!.getSnapshot()!;
    expect(snapshot.data.values['f1']).toEqual({ value: 'John', isDirty: true });
    expect(snapshot.data.values['f2']).toEqual({ value: 'Doe', isDirty: true });
  });
});
