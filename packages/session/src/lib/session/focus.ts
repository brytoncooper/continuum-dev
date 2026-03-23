import type { ViewDefinition } from '@continuum-dev/contract';
import { resolveNodeLookupEntry } from '@continuum-dev/runtime/node-lookup';
import { notifyFocusListeners } from './listeners/index.js';
import type { SessionState } from './state/index.js';
import { getActiveForegroundStream } from './streams/state.js';

function resolveCanonicalIdInView(
  view: ViewDefinition | null,
  nodeId: string
): string | null {
  if (!view) {
    return null;
  }

  const hit = resolveNodeLookupEntry(view.nodes, nodeId);
  if (hit) {
    return hit.canonicalId;
  }

  const leafNodeId = nodeId.includes('/') ? nodeId.split('/').at(-1) : null;
  if (!leafNodeId || leafNodeId === nodeId) {
    return null;
  }

  return resolveNodeLookupEntry(view.nodes, leafNodeId)?.canonicalId ?? null;
}

export function resolveFocusCanonicalId(
  internal: SessionState,
  nodeId: string
): string | null {
  return (
    resolveCanonicalIdInView(
      getActiveForegroundStream(internal)?.workingView ?? null,
      nodeId
    ) ?? resolveCanonicalIdInView(internal.currentView, nodeId)
  );
}

export function applyFocusedNodeId(
  internal: SessionState,
  nodeId: string | null
): void {
  if (nodeId === null) {
    if (internal.focusedNodeId !== null) {
      internal.focusedNodeId = null;
      notifyFocusListeners(internal);
    }
    return;
  }

  const canonical = resolveFocusCanonicalId(internal, nodeId);
  if (canonical === null || internal.focusedNodeId === canonical) {
    return;
  }

  internal.focusedNodeId = canonical;
  notifyFocusListeners(internal);
}

export function syncFocusedNodeIdToRenderView(internal: SessionState): void {
  if (internal.focusedNodeId === null) {
    return;
  }

  const renderView =
    getActiveForegroundStream(internal)?.workingView ?? internal.currentView;
  const nextFocusedNodeId = resolveCanonicalIdInView(
    renderView ?? null,
    internal.focusedNodeId
  );

  if (nextFocusedNodeId === internal.focusedNodeId) {
    return;
  }

  internal.focusedNodeId = nextFocusedNodeId;
  notifyFocusListeners(internal);
}
