import type { DataSnapshot, DetachedValue, ViewNode } from '@continuum-dev/contract';
import { resolveNodeLookupEntry } from '../node-lookup.js';
import type { SessionState } from '../state/index.js';
import type { InternalSessionStreamState } from './types.js';

function getNodeLabel(node: ViewNode | null): string | undefined {
  if (!node || !('label' in node) || typeof node.label !== 'string') {
    return undefined;
  }

  return node.label;
}

function ensureDetachedValueTarget(internal: SessionState): DataSnapshot {
  if (internal.currentData) {
    return internal.currentData;
  }

  return {
    values: {},
    lineage: {
      timestamp: internal.clock(),
      sessionId: internal.sessionId,
    },
  };
}

export function collectRenderOnlyDetachedValues(
  internal: SessionState,
  stream: InternalSessionStreamState
): Record<string, DetachedValue> {
  if (!stream.workingView || !stream.workingData) {
    return {};
  }

  const now = internal.clock();
  const detachedValues: Record<string, DetachedValue> = {};

  for (const canonicalId of stream.renderOnlyDirtyNodeIds) {
    const lookup = resolveNodeLookupEntry(stream.workingView.nodes, canonicalId);
    const value = stream.workingData.values[canonicalId];
    if (!lookup || !value) {
      continue;
    }

    detachedValues[`stream:${stream.streamId}:${canonicalId}`] = {
      value: structuredClone(value),
      previousNodeType: lookup.node.type,
      semanticKey: lookup.node.key,
      key: lookup.node.key,
      previousLabel: getNodeLabel(lookup.node),
      previousParentLabel: getNodeLabel(lookup.parentNode),
      detachedAt: now,
      viewVersion: stream.workingView.version,
      reason: 'node-removed',
    };
  }

  return detachedValues;
}

export function storeRenderOnlyDetachedValues(
  internal: SessionState,
  stream: InternalSessionStreamState
): void {
  const detachedValues = collectRenderOnlyDetachedValues(internal, stream);
  if (Object.keys(detachedValues).length === 0) {
    return;
  }

  const currentData = ensureDetachedValueTarget(internal);
  internal.currentData = {
    ...currentData,
    detachedValues: {
      ...(currentData.detachedValues ?? {}),
      ...detachedValues,
    },
  };
}
