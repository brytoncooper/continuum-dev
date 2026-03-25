import type { NodeValue } from '@continuum-dev/contract';
import { ConflictBanner } from './conflict-banner.js';

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : String(value);
}

export function StarterKitFieldProposal({
  title,
  hasSuggestion,
  currentValue,
  suggestionValue,
  currentLabel,
  nextLabel,
  onAccept,
  onReject,
  bannerVariant = 'card',
}: {
  title: string;
  hasSuggestion: boolean;
  currentValue: unknown;
  suggestionValue: unknown;
  currentLabel?: string;
  nextLabel?: string;
  onAccept: () => void;
  onReject: () => void;
  bannerVariant?: 'card' | 'popover';
}) {
  if (!hasSuggestion) {
    return null;
  }

  return (
    <ConflictBanner
      title={title}
      currentValue={stringifyValue((currentValue as NodeValue | undefined)?.value ?? currentValue)}
      currentLabel={currentLabel}
      nextValue={stringifyValue(suggestionValue)}
      nextLabel={nextLabel}
      tone="proposal"
      variant={bannerVariant}
      onAccept={onAccept}
      onReject={onReject}
    />
  );
}
