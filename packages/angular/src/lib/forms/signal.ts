import { inject, effect, signal, type Signal } from '@angular/core';
import type { NodeValue } from '@continuum/contract';
import { injectContinuumSession } from '../inject.js';
import { CONTINUUM_SNAPSHOT } from '../tokens.js';

export interface ContinuumSignalFormModel<T = unknown> {
  value: Signal<T>;
  update: (value: T) => void;
}

export function bindContinuumSignalForm<T = unknown>(
  nodeId: string
): ContinuumSignalFormModel<T> {
  const session = injectContinuumSession();
  const snapshot = inject(CONTINUUM_SNAPSHOT);

  const valueSignal = signal<T>(undefined as T);
  effect(() => {
    const snap = snapshot();
    const raw = snap?.data.values?.[nodeId] as
      | (NodeValue & { value?: T })
      | undefined;
    if (raw != null && 'value' in raw) {
      valueSignal.set(raw.value as T);
    }
  });

  const update = (value: T) => {
    session.updateState(nodeId, { value } as NodeValue);
  };

  return {
    value: valueSignal,
    update,
  };
}
