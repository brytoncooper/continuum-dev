import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { ViewDefinition } from '@continuum-dev/contract';
import type { Session } from '@continuum-dev/session';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ContinuumProvider } from './context.js';
import { useContinuumSession } from './hooks.js';

const viewDef: ViewDefinition = {
  viewId: 'view',
  version: '1',
  nodes: [{ id: 'field', type: 'field', dataType: 'string' }],
};

const componentMap = {
  field: ({
    value,
    onChange,
  }: {
    value: { value?: string } | undefined;
    onChange: (next: { value: string }) => void;
  }) => (
    <input
      data-testid="input"
      value={typeof value?.value === 'string' ? value.value : ''}
      onChange={(e) => onChange({ value: e.target.value })}
    />
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
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function SessionProbe({
  onSession,
}: {
  onSession: (session: Session) => void;
}) {
  const session = useContinuumSession();
  onSession(session);
  return null;
}

describe('react persistence guard', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('persists when payload is under maxPersistBytes', () => {
    vi.useFakeTimers();
    let session: Session | null = null;
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={componentMap}
        persist="localStorage"
        maxPersistBytes={100_000}
      >
        <SessionProbe
          onSession={(next) => {
            session = next;
          }}
        />
      </ContinuumProvider>
    );

    act(() => {
      session?.pushView(viewDef);
      session?.updateState('field', { value: 'persisted' });
      vi.runAllTimers();
    });

    const raw = localStorage.getItem('continuum_session');
    expect(raw).not.toBeNull();
    rendered.unmount();
  });

  it('skips persistence and reports size_limit when payload exceeds maxPersistBytes', () => {
    vi.useFakeTimers();
    const errors: Array<Record<string, unknown>> = [];
    let session: Session | null = null;
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={componentMap}
        persist="localStorage"
        maxPersistBytes={1}
        onPersistError={(error) => {
          errors.push(error as unknown as Record<string, unknown>);
        }}
      >
        <SessionProbe
          onSession={(next) => {
            session = next;
          }}
        />
      </ContinuumProvider>
    );

    act(() => {
      session?.pushView(viewDef);
      session?.updateState('field', { value: 'persisted' });
      vi.runAllTimers();
    });

    expect(localStorage.getItem('continuum_session')).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].reason).toBe('size_limit');
    expect(errors[0].key).toBe('continuum_session');
    expect(errors[0].maxBytes).toBe(1);
    expect((errors[0].attemptedBytes as number) > 1).toBe(true);
    rendered.unmount();
  });

  it('reports storage_error when setItem throws', () => {
    vi.useFakeTimers();
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });
    const errors: Array<Record<string, unknown>> = [];
    let session: Session | null = null;
    const rendered = renderIntoDom(
      <ContinuumProvider
        components={componentMap}
        persist="localStorage"
        onPersistError={(error) => {
          errors.push(error as unknown as Record<string, unknown>);
        }}
      >
        <SessionProbe
          onSession={(next) => {
            session = next;
          }}
        />
      </ContinuumProvider>
    );

    act(() => {
      session?.pushView(viewDef);
      session?.updateState('field', { value: 'persisted' });
      vi.runAllTimers();
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].reason).toBe('storage_error');
    expect(errors[0].key).toBe('continuum_session');
    expect((errors[0].cause as Error).message).toBe('quota exceeded');
    setItemSpy.mockRestore();
    rendered.unmount();
  });
});
