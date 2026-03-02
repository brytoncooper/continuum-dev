import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionState } from './session-state.js';
import { createEmptySessionState } from './session-state.js';
import { serializeSession } from './serializer.js';
import { notifySnapshotListeners, subscribeSnapshot } from './listeners.js';
import { attachPersistence } from './persistence.js';

interface StorageEventLike {
  key: string | null;
  newValue: string | null;
  storageArea?: unknown;
}

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function makeState(sessionId: string): SessionState {
  const state = createEmptySessionState(sessionId, () => 1000);
  state.currentView = { viewId: `${sessionId}-view`, version: '1', nodes: [] };
  state.currentData = {
    values: {},
    lineage: {
      timestamp: 1000,
      sessionId,
    },
  };
  return state;
}

describe('attachPersistence', () => {
  const originalAddEventListener = (globalThis as { addEventListener?: typeof addEventListener }).addEventListener;
  const originalRemoveEventListener = (globalThis as { removeEventListener?: typeof removeEventListener }).removeEventListener;
  let storageHandlers: Array<(event: StorageEventLike) => void> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    storageHandlers = [];
    (globalThis as { addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void }).addEventListener = (type, listener) => {
      if (type === 'storage' && typeof listener === 'function') {
        storageHandlers.push(listener as unknown as (event: StorageEventLike) => void);
      }
    };
    (globalThis as { removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void }).removeEventListener = (type, listener) => {
      if (type !== 'storage' || typeof listener !== 'function') return;
      storageHandlers = storageHandlers.filter((entry) => entry !== (listener as unknown as (event: StorageEventLike) => void));
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as { addEventListener?: typeof addEventListener }).addEventListener = originalAddEventListener;
    (globalThis as { removeEventListener?: typeof removeEventListener }).removeEventListener = originalRemoveEventListener;
  });

  it('writes to storage after debounce when snapshot changes', () => {
    const storage = new MemoryStorage();
    const setItemSpy = vi.spyOn(storage, 'setItem');
    const state = makeState('local');
    const detach = attachPersistence(state, { storage, key: 'continuum_session' });

    notifySnapshotListeners(state);
    expect(setItemSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(199);
    expect(setItemSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(storage.getItem('continuum_session')).toBeTruthy();
    detach();
  });

  it('applies matching storage events and notifies snapshot subscribers', () => {
    const storage = new MemoryStorage();
    const state = makeState('local');
    const detach = attachPersistence(state, { storage, key: 'continuum_session' });

    const remote = makeState('remote');
    remote.currentData = {
      values: { field: { value: 'remote' } },
      lineage: {
        timestamp: 2000,
        sessionId: 'remote',
      },
    };
    const payload = JSON.stringify(serializeSession(remote));

    const snapshots: string[] = [];
    const unsub = subscribeSnapshot(state, (snapshot) => {
      snapshots.push(String(snapshot.data.values['field']?.value ?? ''));
    });

    storageHandlers[0](
      {
        key: 'continuum_session',
        newValue: payload,
        storageArea: storage,
      }
    );

    expect(snapshots.at(-1)).toBe('remote');
    unsub();
    detach();
  });

  it('ignores unrelated, null, and malformed storage events', () => {
    const storage = new MemoryStorage();
    const state = makeState('local');
    state.currentData = {
      values: { field: { value: 'before' } },
      lineage: {
        timestamp: 1000,
        sessionId: 'local',
      },
    };
    const detach = attachPersistence(state, { storage, key: 'continuum_session' });

    storageHandlers[0](
      {
        key: 'other_key',
        newValue: JSON.stringify(serializeSession(makeState('x'))),
        storageArea: storage,
      }
    );
    expect(state.currentData?.values['field']).toEqual({ value: 'before' });

    storageHandlers[0](
      {
        key: 'continuum_session',
        newValue: null,
        storageArea: storage,
      }
    );
    expect(state.currentData?.values['field']).toEqual({ value: 'before' });

    storageHandlers[0](
      {
        key: 'continuum_session',
        newValue: '{bad-json',
        storageArea: storage,
      }
    );
    expect(state.currentData?.values['field']).toEqual({ value: 'before' });
    detach();
  });

  it('suppresses write-through while applying remote state', () => {
    const storage = new MemoryStorage();
    const setItemSpy = vi.spyOn(storage, 'setItem');
    const state = makeState('local');
    const detach = attachPersistence(state, { storage, key: 'continuum_session' });

    const remote = makeState('remote');
    remote.currentData = {
      values: { field: { value: 'remote' } },
      lineage: {
        timestamp: 2000,
        sessionId: 'remote',
      },
    };

    storageHandlers[0](
      {
        key: 'continuum_session',
        newValue: JSON.stringify(serializeSession(remote)),
        storageArea: storage,
      }
    );
    vi.runAllTimers();
    expect(setItemSpy).toHaveBeenCalledTimes(0);
    detach();
  });

  it('removes listeners and timers on detach', () => {
    const storage = new MemoryStorage();
    const setItemSpy = vi.spyOn(storage, 'setItem');
    const state = makeState('local');
    const detach = attachPersistence(state, { storage, key: 'continuum_session' });

    notifySnapshotListeners(state);
    detach();
    vi.runAllTimers();
    expect(setItemSpy).toHaveBeenCalledTimes(0);
    expect(storageHandlers).toHaveLength(0);
  });
});
