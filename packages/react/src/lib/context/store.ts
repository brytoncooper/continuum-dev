import type {
  ContinuitySnapshot,
  NodeValue,
  Session,
  SessionStream,
  ViewportState,
} from '@continuum-dev/core';

type Listener = () => void;

function notifyListeners(listeners: Set<Listener>): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      console.error('Continuum listener error', error);
    }
  }
}

function getChangedNodeIds(
  previous: ContinuitySnapshot | null,
  next: ContinuitySnapshot | null
): string[] {
  if (!previous || !next) {
    return [];
  }
  const previousValues = previous.data.values ?? {};
  const nextValues = next.data.values ?? {};
  const previousViewContext = previous.data.viewContext ?? {};
  const nextViewContext = next.data.viewContext ?? {};
  if (
    previousValues === nextValues &&
    previousViewContext === nextViewContext
  ) {
    return [];
  }
  const ids = new Set<string>([
    ...Object.keys(previousValues),
    ...Object.keys(nextValues),
    ...Object.keys(previousViewContext),
    ...Object.keys(nextViewContext),
  ]);
  const changed: string[] = [];
  for (const id of ids) {
    const previousValue = previousValues[id] as NodeValue | undefined;
    const nextValue = nextValues[id] as NodeValue | undefined;
    const previousViewport = previousViewContext[id] as
      | ViewportState
      | undefined;
    const nextViewport = nextViewContext[id] as ViewportState | undefined;
    if (previousValue !== nextValue || previousViewport !== nextViewport) {
      changed.push(id);
    }
  }
  return changed;
}

/**
 * Subscription-oriented store facade over Continuum session state.
 */
export interface ContinuumStore {
  /** Returns the latest continuity snapshot. */
  getSnapshot(): ContinuitySnapshot | null;
  /** Returns the latest committed continuity snapshot. */
  getCommittedSnapshot(): ContinuitySnapshot | null;
  /** Returns the latest stream metadata. */
  getStreams(): SessionStream[];
  /** Returns the active foreground stream when one exists. */
  getActiveStream(): SessionStream | null;
  /** Subscribes to snapshot updates. */
  subscribeSnapshot(listener: Listener): () => void;
  /** Subscribes to stream metadata updates. */
  subscribeStreams(listener: Listener): () => void;
  /** Subscribes to diagnostics-related updates. */
  subscribeDiagnostics(listener: Listener): () => void;
  /** Returns a node value by canonical id. */
  getNodeValue(nodeId: string): NodeValue | undefined;
  /** Returns viewport state by canonical node id. */
  getNodeViewport(nodeId: string): ViewportState | undefined;
  /** Subscribes to updates for a specific node id. */
  subscribeNode(nodeId: string, listener: Listener): () => void;
  /** Releases store subscriptions and listeners. */
  destroy(): void;
}

export function createContinuumStore(session: Session): ContinuumStore {
  let snapshot = session.getSnapshot();
  let committedSnapshot = session.getCommittedSnapshot();
  let streams = session.getStreams?.() ?? [];
  const snapshotListeners = new Set<Listener>();
  const streamListeners = new Set<Listener>();
  const diagnosticsListeners = new Set<Listener>();
  const nodeListeners = new Map<string, Set<Listener>>();

  const cleanupSnapshot = session.onSnapshot((nextSnapshot) => {
    const previousSnapshot = snapshot;
    snapshot = nextSnapshot;
    committedSnapshot = session.getCommittedSnapshot();

    notifyListeners(snapshotListeners);
    notifyListeners(diagnosticsListeners);

    if (!previousSnapshot || !nextSnapshot) {
      for (const listeners of nodeListeners.values()) {
        notifyListeners(listeners);
      }
      return;
    }

    const changedIds = getChangedNodeIds(previousSnapshot, nextSnapshot);
    for (const id of changedIds) {
      const listeners = nodeListeners.get(id);
      if (listeners) {
        notifyListeners(listeners);
      }
    }
  });

  const cleanupStreams =
    typeof session.onStreams === 'function'
      ? session.onStreams((nextStreams) => {
          streams = nextStreams;
          notifyListeners(streamListeners);
        })
      : () => undefined;

  const cleanupIssues = session.onIssues(() => {
    notifyListeners(diagnosticsListeners);
  });

  return {
    getSnapshot: () => snapshot,
    getCommittedSnapshot: () => committedSnapshot,
    getStreams: () => streams,
    getActiveStream: () =>
      streams.find(
        (stream) => stream.status === 'open' && stream.mode === 'foreground'
      ) ?? null,
    subscribeSnapshot(listener) {
      snapshotListeners.add(listener);
      return () => {
        snapshotListeners.delete(listener);
      };
    },
    subscribeStreams(listener) {
      streamListeners.add(listener);
      return () => {
        streamListeners.delete(listener);
      };
    },
    subscribeDiagnostics(listener) {
      diagnosticsListeners.add(listener);
      return () => {
        diagnosticsListeners.delete(listener);
      };
    },
    getNodeValue(nodeId) {
      return snapshot?.data.values?.[nodeId] as NodeValue | undefined;
    },
    getNodeViewport(nodeId) {
      return snapshot?.data.viewContext?.[nodeId];
    },
    subscribeNode(nodeId, listener) {
      const existing = nodeListeners.get(nodeId);
      if (existing) {
        existing.add(listener);
      } else {
        nodeListeners.set(nodeId, new Set([listener]));
      }

      return () => {
        const listeners = nodeListeners.get(nodeId);
        if (!listeners) {
          return;
        }
        listeners.delete(listener);
        if (listeners.size === 0) {
          nodeListeners.delete(nodeId);
        }
      };
    },
    destroy() {
      cleanupSnapshot();
      cleanupStreams();
      cleanupIssues();
      snapshotListeners.clear();
      streamListeners.clear();
      diagnosticsListeners.clear();
      nodeListeners.clear();
    },
  };
}
