import type { NodeValue } from '@continuum/contract';
import { useContinuumConflict, useContinuumState } from '@continuum/react';
import { ConflictBanner } from './conflict-banner.js';

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : String(value);
}

export function StarterKitFieldProposal({
  nodeId,
  title,
  currentLabel,
  nextLabel,
}: {
  nodeId: string;
  title: string;
  currentLabel?: string;
  nextLabel?: string;
}) {
  const [value] = useContinuumState(nodeId);
  const conflict = useContinuumConflict(nodeId);

  if (!conflict.hasConflict) {
    return null;
  }

  return (
    <ConflictBanner
      title={title}
      currentValue={stringifyValue((value as NodeValue | undefined)?.value)}
      currentLabel={currentLabel}
      nextValue={stringifyValue(conflict.proposal?.proposedValue.value)}
      nextLabel={nextLabel}
      tone="proposal"
      onAccept={conflict.accept}
      onReject={conflict.reject}
    />
  );
}
