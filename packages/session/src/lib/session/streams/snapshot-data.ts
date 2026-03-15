import type { DataSnapshot, NodeValue, ViewDefinition } from '@continuum-dev/contract';

export function ensureStreamData(
  data: DataSnapshot | null,
  sessionId: string,
  now: number,
  view: ViewDefinition | null
): DataSnapshot {
  if (data) {
    return data;
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

  return {
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
  };
}

export function applyViewportToSnapshot(
  data: DataSnapshot | null,
  canonicalId: string,
  state: NonNullable<DataSnapshot['viewContext']>[string],
  sessionId: string,
  now: number,
  view: ViewDefinition | null
): DataSnapshot {
  const next = ensureStreamData(data, sessionId, now, view);

  return {
    ...next,
    viewContext: {
      ...(next.viewContext ?? {}),
      [canonicalId]: state,
    },
    lineage: {
      ...next.lineage,
      timestamp: now,
      viewId: view?.viewId ?? next.lineage.viewId,
      viewVersion: view?.version ?? next.lineage.viewVersion,
    },
  };
}
