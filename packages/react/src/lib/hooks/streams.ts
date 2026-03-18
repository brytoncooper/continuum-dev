import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { SessionStream } from '@continuum-dev/core';
import { useRequiredContinuumContext } from './provider.js';
import { shallowArrayEqual } from './shared.js';

/**
 * Subscribes to stream metadata emitted by the active Continuum session.
 */
export function useContinuumStreams(): SessionStream[] {
  const { store } = useRequiredContinuumContext('useContinuumStreams');
  const streamsCacheRef = useRef<SessionStream[]>([]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeStreams(onStoreChange),
    [store]
  );

  const getSnapshot = useCallback(() => {
    const nextStreams = store.getStreams();
    if (shallowArrayEqual(streamsCacheRef.current, nextStreams)) {
      return streamsCacheRef.current;
    }
    streamsCacheRef.current = nextStreams;
    return nextStreams;
  }, [store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Returns the current foreground streaming state for renderer/integration use.
 */
export function useContinuumStreaming(): {
  streams: SessionStream[];
  activeStream: SessionStream | null;
  isStreaming: boolean;
} {
  const streams = useContinuumStreams();
  const activeStream =
    streams.find(
      (stream) => stream.status === 'open' && stream.mode === 'foreground'
    ) ?? null;

  return {
    streams,
    activeStream,
    isStreaming: activeStream !== null,
  };
}
