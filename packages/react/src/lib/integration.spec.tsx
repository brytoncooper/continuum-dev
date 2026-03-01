import { act, StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { ContinuitySnapshot, ViewDefinition } from '@continuum/contract';
import { createSession } from '@continuum/session';
import type { Session } from '@continuum/session';
import { describe, expect, it, vi } from 'vitest';
import { ContinuumProvider } from './context.js';
import { useContinuumDiagnostics, useContinuumHydrated, useContinuumSession, useContinuumSnapshot, useContinuumState } from './hooks.js';
import { ContinuumRenderer } from './renderer.js';

const viewDef: ViewDefinition = {
  viewId: 'view',
  version: '1',
  nodes: [{ id: 'field', type: 'field', dataType: 'string' }],
};

const componentMap = {
  field: ({ value, onChange }: { value: any; onChange: (next: any) => void }) => (
    <input
      data-testid="input"
      value={typeof value?.value === 'string' ? value.value : ''}
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
          {typeof (value as any)?.value === 'string' ? (value as any).value : ''}
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
      field: ({ definition }: any) => {
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
      field: ({ definition }: any) => {
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
    expect(finalizedSession?.getSnapshot()).toBeNull();
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
          {typeof (value as any)?.value === 'string' ? (value as any).value : ''}
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
});
