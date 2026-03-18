import { useContext } from 'react';
import type { Session } from '@continuum-dev/core';
import { ContinuumContext } from '../context/render-contexts.js';

export function useRequiredContinuumContext(hookName: string) {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(`${hookName} must be used within a <ContinuumProvider>`);
  }
  return ctx;
}

/**
 * Returns the active Continuum session from provider context.
 */
export function useContinuumSession(): Session {
  return useRequiredContinuumContext('useContinuumSession').session;
}

/**
 * Indicates whether the provider session was restored from persistence.
 */
export function useContinuumHydrated(): boolean {
  return useRequiredContinuumContext('useContinuumHydrated').wasHydrated;
}
