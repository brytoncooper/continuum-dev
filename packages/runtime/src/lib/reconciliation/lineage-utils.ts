import type { DataSnapshot, ValueLineage } from '@continuum-dev/contract';

export interface CarryValuesMetaInput {
  target: Record<string, ValueLineage>;
  newId: string;
  priorId: string;
  priorData: DataSnapshot;
  now: number;
  isMigrated: boolean;
}

export function carryValuesMeta(input: CarryValuesMetaInput): void {
  const priorMeta = input.priorData.valueLineage?.[input.priorId];
  if (!priorMeta) {
    return;
  }

  input.target[input.newId] = input.isMigrated
    ? { ...priorMeta, lastUpdated: input.now }
    : { ...priorMeta };
}
