import type {
  ContinuitySnapshot,
  NodeValue,
  Session,
  SessionStream,
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
  const ids = new Set<string>([
    ...Object.keys(previousValues),
    ...Object.keys(nextValues),
  ]);
  const changed: string[] = [];
  for (const id of ids) {
    const previousValue = previousValues[id] as NodeValue | undefined;
    const nextValue = nextValues[id] as NodeValue | undefined;
    if (previousValue !== nextValue) {
      changed.push(id);
    }
  }
  return changed;
}

function readCommittedSnapshot(session: Session): ContinuitySnapshot | null {
  const fn = session.getCommittedSnapshot;
  if (typeof fn === 'function') {
    return fn.call(session);
  }
  return session.getSnapshot();
}

export interface ContinuumStore {
  getSnapshot(): ContinuitySnapshot | null;
  getCommittedSnapshot(): ContinuitySnapshot | null;
  getStreams(): SessionStream[];
  getActiveStream(): SessionStream | null;
  subscribeSnapshot(listener: Listener): () => void;
  subscribeStreams(listener: Listener): () => void;
  subscribeDiagnostics(listener: Listener): () => void;
  getNodeValue(nodeId: string): NodeValue | undefined;
  getFocusedNodeId(): string | null;
  subscribeNode(nodeId: string, listener: Listener): () => void;
  destroy(): void;
}

export function createContinuumStore(session: Session): ContinuumStore {
  let snapshot = session.getSnapshot();
  let committedSnapshot = readCommittedSnapshot(session);
  let streams = session.getStreams?.() ?? [];
  const snapshotListeners = new Set<Listener>();
  const streamListeners = new Set<Listener>();
  const diagnosticsListeners = new Set<Listener>();
  const nodeListeners = new Map<string, Set<Listener>>();

  let previousFocus = session.getFocusedNodeId();

  const cleanupSnapshot = session.onSnapshot((nextSnapshot) => {
    const previousSnapshot = snapshot;
    snapshot = nextSnapshot;
    committedSnapshot = readCommittedSnapshot(session);

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

  const cleanupFocus = session.onFocusChange((next: string | null) => {
    const touched = new Set<string>();
    if (previousFocus) {
      touched.add(previousFocus);
    }
    if (next) {
      touched.add(next);
    }
    previousFocus = next;
    for (const nid of touched) {
      const listeners = nodeListeners.get(nid);
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
    getFocusedNodeId() {
      return session.getFocusedNodeId();
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
      cleanupFocus();
      cleanupStreams();
      cleanupIssues();
      snapshotListeners.clear();
      streamListeners.clear();
      diagnosticsListeners.clear();
      nodeListeners.clear();
    },
  };
}
