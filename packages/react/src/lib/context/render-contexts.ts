import { createContext } from 'react';
import type {
  ContinuitySnapshot,
  DetachedRestoreScope,
  Session,
} from '@continuum-dev/core';
import type { ContinuumNodeMap } from '../types.js';
import type { ContinuumStore } from './store.js';

/**
 * Value shape exposed through `ContinuumContext`.
 */
export interface ContinuumContextValue {
  /** Backing Continuum session instance. */
  session: Session;
  /** Subscription-friendly store facade over session state. */
  store: ContinuumStore;
  /** Resolved node type to component map. */
  componentMap: ContinuumNodeMap;
  /** True when provider loaded from existing persisted state. */
  wasHydrated: boolean;
}

/**
 * React context backing all `@continuum-dev/react` hooks and renderer behavior.
 */
export const ContinuumContext = createContext<ContinuumContextValue | null>(
  null
);

/**
 * Optional render-time snapshot override used for non-destructive previews.
 */
export const ContinuumRenderSnapshotContext =
  createContext<ContinuitySnapshot | null>(null);

/**
 * Optional render-time scope used by restore review hooks to distinguish live
 * rendering from a specific draft preview stream.
 */
export const ContinuumRenderScopeContext =
  createContext<DetachedRestoreScope | null>(null);
