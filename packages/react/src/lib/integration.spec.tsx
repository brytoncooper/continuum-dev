import { act, StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { ContinuitySnapshot, SchemaSnapshot } from '@continuum/contract';
import { createSession } from '@continuum/session';
import type { Session } from '@continuum/session';
import { describe, expect, it, vi } from 'vitest';
import { ContinuumProvider } from './context.js';
import { useContinuumDiagnostics, useContinuumHydrated, useContinuumSession, useContinuumSnapshot, useContinuumState } from './hooks.js';
import { ContinuumRenderer } from './renderer.js';

const schema: SchemaSnapshot = {
  schemaId: 'schema',
  version: '1',
  components: [{ id: 'field', type: 'input' }],
};

const componentMap = {
  input: ({ value, onChange }: { value: any; onChange: (next: any) => void }) => (
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
    seed.pushSchema(schema);
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
    expect(hydratedSnapshot?.state.values['field']).toEqual({ value: 'from-storage' });
    view.unmount();
  });

  it('supports state updates through useContinuumState', () => {
    function App() {
      const session = useContinuumSession();
      const [value, setValue] = useContinuumState('field');
      if (!session.getSnapshot()) {
        session.pushSchema(schema);
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

  it('renders schemas and tolerates null component arrays', () => {
    const badSchema = { schemaId: 's', version: '1', components: null } as unknown as SchemaSnapshot;
    const view = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <ContinuumRenderer schema={badSchema} />
      </ContinuumProvider>
    );
    expect(view.container.querySelector('[data-continuum-schema="s"]')).toBeTruthy();
    view.unmount();
  });

  it('does not render components marked hidden', () => {
    const hiddenSchema: SchemaSnapshot = {
      schemaId: 'hidden-schema',
      version: '1',
      components: [{ id: 'hidden-field', type: 'input', hidden: true }],
    };
    const view = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <ContinuumRenderer schema={hiddenSchema} />
      </ContinuumProvider>
    );
    expect(view.container.querySelector('[data-continuum-id="hidden-field"]')).toBeNull();
    view.unmount();
  });

  it('forwards definition.props to rendered component', () => {
    let receivedPlaceholder = '';
    const propsMap = {
      input: ({ definition, placeholder }: any) => {
        receivedPlaceholder = placeholder ?? '';
        return <div data-testid={`field-${definition.id}`} />;
      },
    };
    const propsSchema: SchemaSnapshot = {
      schemaId: 'props-schema',
      version: '1',
      components: [
        {
          id: 'field',
          type: 'input',
          props: { placeholder: 'From props' },
        },
      ],
    };
    const view = renderIntoDom(
      <ContinuumProvider components={propsMap}>
        <ContinuumRenderer schema={propsSchema} />
      </ContinuumProvider>
    );
    expect(receivedPlaceholder).toBe('From props');
    view.unmount();
  });

  it('isolates component render errors with per-component boundary', () => {
    const errorMap = {
      input: ({ definition }: any) => {
        if (definition.id === 'boom') {
          throw new Error('boom');
        }
        return <div data-testid={`ok-${definition.id}`}>ok</div>;
      },
    };
    const errorSchema: SchemaSnapshot = {
      schemaId: 'error-schema',
      version: '1',
      components: [
        { id: 'boom', type: 'input' },
        { id: 'safe', type: 'input' },
      ],
    };
    const view = renderIntoDom(
      <ContinuumProvider components={errorMap}>
        <ContinuumRenderer schema={errorSchema} />
      </ContinuumProvider>
    );
    expect(view.container.querySelector('[data-continuum-render-error="boom"]')).toBeTruthy();
    expect(view.container.querySelector('[data-testid="ok-safe"]')).toBeTruthy();
    view.unmount();
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
        session.pushSchema(schema);
      }
      issuesLength = diagnostics.issues.length;
      checkpointsLength = diagnostics.checkpoints.length;
      return null;
    }

    const view = renderIntoDom(
      <ContinuumProvider components={componentMap}>
        <App />
      </ContinuumProvider>
    );

    expect(issuesLength).toBeGreaterThanOrEqual(0);
    expect(checkpointsLength).toBeGreaterThanOrEqual(1);
    view.unmount();
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
        session.pushSchema(schema);
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

    const view = renderIntoDom(
      <StrictMode>
        <ContinuumProvider components={componentMap}>
          <App />
        </ContinuumProvider>
      </StrictMode>
    );
    const button = view.container.querySelector('[data-testid="strict-button"]') as HTMLButtonElement;
    act(() => {
      button.click();
    });
    expect(button.textContent).toBe('strict-next');
    view.unmount();
  });
});
