import type { Session, SessionOptions, SessionFactory } from './types.js';
import {
  createEmptySessionState,
  generateId,
  deserializeToState,
  attachPersistence,
} from './session/state/index.js';
import { createStateFacade } from './session/state/facade.js';
import { createInteractionsFacade } from './session/interactions/facade.js';
import { createStreamsFacade } from './session/streams/facade.js';
import { createListenersFacade } from './session/listeners/facade.js';
import { createUpdatesFacade } from './session/updates/facade.js';
import { createRestoreReviewsFacade } from './session/restore-reviews/facade.js';

const DEFAULT_STORAGE_KEY = 'continuum_session';

/**
 * Creates a new in-memory session ledger via object composition.
 *
 * Initializes event log limits, reconciliation behavior, optional persistence,
 * and optional action handlers.
 *
 * @param options Optional session configuration.
 * @returns A live session instance.
 */
export function createSession(options?: SessionOptions): Session {
  const clock = options?.clock ?? Date.now;
  const internal = createEmptySessionState(generateId('session', clock), clock);
  internal.maxEventLogSize =
    options?.maxEventLogSize ?? internal.maxEventLogSize;
  internal.maxPendingIntents =
    options?.maxPendingIntents ?? internal.maxPendingIntents;
  internal.maxCheckpoints = options?.maxCheckpoints ?? internal.maxCheckpoints;
  internal.reconciliationOptions = options?.reconciliation;
  internal.validateOnUpdate =
    options?.validateOnUpdate ?? internal.validateOnUpdate;
  internal.detachedValuePolicy = options?.detachedValuePolicy;
  internal.restoreReviewsEnabled =
    options?.enableRestoreReviews ?? internal.restoreReviewsEnabled;
  if (options?.actions) {
    for (const [id, entry] of Object.entries(options.actions)) {
      internal.actionRegistry.set(id, entry);
    }
  }
  const cleanupPersistence = options?.persistence
    ? attachPersistence(internal, {
        ...options.persistence,
        key: options.persistence.key ?? DEFAULT_STORAGE_KEY,
      })
    : undefined;

  const session = {} as Session;
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(
      createStateFacade(internal, cleanupPersistence)
    )
  );
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(
      createInteractionsFacade(internal, session)
    )
  );
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(createStreamsFacade(internal))
  );
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(createListenersFacade(internal))
  );
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(createUpdatesFacade(internal))
  );
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(
      createRestoreReviewsFacade(internal, session)
    )
  );
  return session;
}

/**
 * Recreates a session from serialized data produced by `session.serialize()`.
 *
 * @param data Serialized session payload.
 * @param options Optional runtime overrides (clock, limits, reconciliation, persistence).
 * @returns A live session instance restored from the payload via object composition.
 */
export function deserialize(data: unknown, options?: SessionOptions): Session {
  const internal = deserializeToState(data, options?.clock ?? Date.now, {
    maxEventLogSize: options?.maxEventLogSize,
    maxPendingIntents: options?.maxPendingIntents,
    maxCheckpoints: options?.maxCheckpoints,
  });
  if (options?.reconciliation) {
    internal.reconciliationOptions = options.reconciliation;
  }
  if (options?.validateOnUpdate !== undefined) {
    internal.validateOnUpdate = options.validateOnUpdate;
  }
  if (options?.enableRestoreReviews !== undefined) {
    internal.restoreReviewsEnabled = options.enableRestoreReviews;
  }
  if (options?.actions) {
    for (const [id, entry] of Object.entries(options.actions)) {
      internal.actionRegistry.set(id, entry);
    }
  }
  const cleanupPersistence = options?.persistence
    ? attachPersistence(internal, {
        ...options.persistence,
        key: options.persistence.key ?? DEFAULT_STORAGE_KEY,
      })
    : undefined;

  const session = {} as Session;
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(
      createStateFacade(internal, cleanupPersistence)
    )
  );
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(
      createInteractionsFacade(internal, session)
    )
  );
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(createStreamsFacade(internal))
  );
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(createListenersFacade(internal))
  );
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(createUpdatesFacade(internal))
  );
  Object.defineProperties(
    session,
    Object.getOwnPropertyDescriptors(
      createRestoreReviewsFacade(internal, session)
    )
  );
  return session;
}

/**
 * Hydrates a session from persistence storage when data exists, otherwise creates a new one.
 *
 * If stored data is invalid, it is removed and a fresh session is created.
 *
 * @param options Session options including required persistence config.
 * @returns A hydrated or newly created session.
 */
export function hydrateOrCreate(options?: SessionOptions): Session {
  if (!options?.persistence) return createSession(options);
  const storageKey = options.persistence.key ?? DEFAULT_STORAGE_KEY;
  const raw = options.persistence.storage.getItem(storageKey);
  if (!raw) return createSession(options);
  try {
    return deserialize(JSON.parse(raw), options);
  } catch {
    options.persistence.storage.removeItem(storageKey);
    return createSession(options);
  }
}

/**
 * Dependency-injection friendly factory for session creation and deserialization.
 */
export const sessionFactory: SessionFactory = { createSession, deserialize };
