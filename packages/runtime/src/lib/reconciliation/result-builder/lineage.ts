import type { DataSnapshot, ValueLineage } from '@continuum-dev/contract';

export function carryValuesMeta(
  target: Record<string, ValueLineage>,
  newId: string,
  priorId: string,
  priorData: DataSnapshot,
  now: number,
  isMigrated: boolean
): void {
  const priorMeta = priorData.valueLineage?.[priorId];
  if (!priorMeta) {
    return;
  }

  target[newId] = isMigrated
    ? { ...priorMeta, lastUpdated: now }
    : { ...priorMeta };
}
