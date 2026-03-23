import type { SessionState } from './session-state.js';
import { replaceInternalState } from './session-state.js';
import {
  subscribeSnapshot,
  notifySnapshotAndIssueListeners,
} from '../listeners/index.js';
import { serializeSession, deserializeToState } from './serializer.js';
import type { SessionPersistenceOptions } from '../../types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMatchingStorageEvent(
  event: unknown,
  storage: SessionPersistenceOptions['storage'],
  key: string
): event is { key: string | null; newValue: string; storageArea?: unknown } {
  if (!isRecord(event)) return false;
  if (event.key !== key) return false;
  if (event.newValue === null || typeof event.newValue !== 'string')
    return false;
  if (event.storageArea !== undefined && event.storageArea !== storage)
    return false;
  return true;
}

/**
 * Attaches persistence synchronization to a session.
 *
 * Persists snapshots to storage with debounce and applies remote `storage` events
 * (for example, cross-tab updates) back into the active session state.
 *
 * @param internal Mutable internal session state.
 * @param options Persistence storage options.
 * @returns Cleanup function that unsubscribes listeners and removes event handlers.
 */
export function attachPersistence(
  internal: SessionState,
  options: SessionPersistenceOptions
): () => void {
  const key = options.key ?? 'continuum_session';
  const storage = options.storage;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let isApplyingRemote = false;
  const encoder = new TextEncoder();
  const flushNow = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    try {
      const payload = JSON.stringify(serializeSession(internal));
      const attemptedBytes = encoder.encode(payload).byteLength;
      if (
        typeof options.maxBytes === 'number' &&
        Number.isFinite(options.maxBytes) &&
        options.maxBytes >= 0 &&
        attemptedBytes > options.maxBytes
      ) {
        options.onError?.({
          reason: 'size_limit',
          key,
          attemptedBytes,
          maxBytes: options.maxBytes,
        });
        return;
      }
      storage.setItem(key, payload);
    } catch (cause) {
      options.onError?.({
        reason: 'storage_error',
        key,
        cause,
      });
    }
  };

  const unsubscribe = subscribeSnapshot(internal, () => {
    if (isApplyingRemote) return;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      flushNow();
    }, 200);
  });

  const onStorage = (event: unknown) => {
    if (!isMatchingStorageEvent(event, storage, key)) return;
    try {
      const raw = JSON.parse(event.newValue);
      const next = deserializeToState(raw, internal.clock, {
        maxEventLogSize: internal.maxEventLogSize,
        maxPendingIntents: internal.maxPendingIntents,
        maxCheckpoints: internal.maxCheckpoints,
      });
      isApplyingRemote = true;
      replaceInternalState(internal, next);
      isApplyingRemote = false;
      notifySnapshotAndIssueListeners(internal);
    } catch {
      isApplyingRemote = false;
      return;
    }
  };

  const maybeAdd = (
    globalThis as {
      addEventListener?: (
        type: string,
        listener: (event: unknown) => void
      ) => void;
    }
  ).addEventListener;
  const maybeRemove = (
    globalThis as {
      removeEventListener?: (
        type: string,
        listener: (event: unknown) => void
      ) => void;
    }
  ).removeEventListener;
  if (maybeAdd) {
    maybeAdd('storage', onStorage);
    maybeAdd('beforeunload', flushNow as unknown as (event: unknown) => void);
  }

  return () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    unsubscribe();
    if (maybeRemove) {
      maybeRemove('storage', onStorage);
      maybeRemove(
        'beforeunload',
        flushNow as unknown as (event: unknown) => void
      );
    }
  };
}
