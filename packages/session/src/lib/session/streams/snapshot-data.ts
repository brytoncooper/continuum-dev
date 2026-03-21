import type { DataSnapshot, NodeValue, ViewDefinition } from '@continuum-dev/contract';
import { sanitizeContinuumDataSnapshot } from '@continuum-dev/runtime/canonical-snapshot';

export function ensureStreamData(
  data: DataSnapshot | null,
  sessionId: string,
  now: number,
  view: ViewDefinition | null
): DataSnapshot {
  const sanitized = sanitizeContinuumDataSnapshot(data);
  if (sanitized) {
    return sanitized;
  }

  return {
    values: {},
    lineage: {
      timestamp: now,
      sessionId,
      viewId: view?.viewId,
      viewVersion: view?.version,
    },
  };
}

export function applyNodeValueToSnapshot(
  data: DataSnapshot | null,
  canonicalId: string,
  value: NodeValue,
  sessionId: string,
  now: number,
  view: ViewDefinition | null
): DataSnapshot {
  const next = ensureStreamData(data, sessionId, now, view);

  return sanitizeContinuumDataSnapshot({
    ...next,
    values: {
      ...next.values,
      [canonicalId]: value,
    },
    lineage: {
      ...next.lineage,
      timestamp: now,
      viewId: view?.viewId ?? next.lineage.viewId,
      viewVersion: view?.version ?? next.lineage.viewVersion,
    },
    valueLineage: {
      ...(next.valueLineage ?? {}),
      [canonicalId]: {
        ...(next.valueLineage?.[canonicalId] ?? {}),
        lastUpdated: now,
      },
    },
  })!;
}
