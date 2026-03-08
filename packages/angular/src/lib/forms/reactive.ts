import { inject, DestroyRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { NodeValue } from '@continuum-dev/contract';
import { injectContinuumSession } from '../inject.js';

export interface ContinuumReactiveFormBinding {
  nodeId: string;
  control: FormControl;
}

export function bindContinuumReactiveForm(
  bindings: ContinuumReactiveFormBinding[],
  options?: { destroyRef?: DestroyRef }
): void {
  const session = injectContinuumSession();
  const destroyRef = options?.destroyRef ?? inject(DestroyRef);

  for (const { nodeId, control } of bindings) {
    const snapshot = session.getSnapshot();
    const value = snapshot?.data.values?.[nodeId] as NodeValue | undefined;
    if (value != null && typeof value === 'object' && 'value' in value) {
      control.setValue(value.value, {
        emitEvent: false,
      });
    }

    control.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((v) => {
      session.updateState(nodeId, { value: v } as NodeValue);
    });
  }

  const unsub = session.onSnapshot(() => {
    for (const { nodeId, control } of bindings) {
      const snapshot = session.getSnapshot();
      const value = snapshot?.data.values?.[nodeId] as NodeValue | undefined;
      if (value != null && typeof value === 'object' && 'value' in value) {
        const v = value.value;
        if (control.value !== v) {
          control.setValue(v, { emitEvent: false });
        }
      }
    }
  });

  destroyRef.onDestroy(() => unsub());
}
