import { useCallback, useRef, useState } from 'react';
import type { ActionResult } from '@continuum-dev/core';
import { useRequiredContinuumContext } from './provider.js';

/**
 * Returns an action dispatcher bound to an intent id with dispatch state.
 *
 * @param intentId Registered action intent id to dispatch.
 */
export function useContinuumAction(intentId: string): {
  dispatch: (nodeId: string) => Promise<ActionResult>;
  isDispatching: boolean;
  lastResult: ActionResult | null;
} {
  const { session } = useRequiredContinuumContext('useContinuumAction');
  const [isDispatching, setIsDispatching] = useState(false);
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);
  const dispatchIdRef = useRef(0);

  const dispatch = useCallback(
    async (nodeId: string) => {
      const dispatchId = ++dispatchIdRef.current;
      setIsDispatching(true);
      try {
        const result = await session.dispatchAction(intentId, nodeId);
        if (dispatchIdRef.current === dispatchId) {
          setLastResult(result);
        }
        return result;
      } finally {
        if (dispatchIdRef.current === dispatchId) {
          setIsDispatching(false);
        }
      }
    },
    [session, intentId]
  );

  return { dispatch, isDispatching, lastResult };
}
