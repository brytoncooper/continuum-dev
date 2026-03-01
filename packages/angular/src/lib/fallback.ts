import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { ViewNode, NodeValue } from '@continuum/contract';

@Component({
  selector: 'continuum-fallback',
  standalone: true,
  template: `
    <div
      class="continuum-fallback"
      style="border: 2px dashed #d1242f; border-radius: 6px; padding: 12px; background: #fff8f8"
    >
      <div style="font-size: 11px; color: #d1242f; font-weight: 600">
        Unknown type: {{ definition().type }} ({{ displayName() }})
      </div>
      <input
        [value]="textValue()"
        (input)="onInput($event)"
        [placeholder]="placeholder()"
        style="display: block; width: 100%; margin-top: 8px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box"
      />
      <details style="margin-top: 8px">
        <summary style="font-size: 11px; color: #666; cursor: pointer">
          View definition
        </summary>
        <pre
          style="font-size: 10px; overflow: auto; background: #f5f5f5; padding: 8px; border-radius: 4px; margin: 4px 0 0"
        >
          {{ definitionJson() }}
        </pre>
      </details>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContinuumFallbackComponent {
  definition = input.required<ViewNode>();
  value = input<NodeValue>();
  valueChange = output<NodeValue>();

  protected displayName = computed(() => {
    const def = this.definition();
    return ('label' in def ? def.label : undefined) ?? def?.id ?? '';
  });
  protected placeholder = computed(() => {
    const def = this.definition();
    return ('placeholder' in def ? (def as { placeholder?: string }).placeholder : undefined) ?? `Enter value for "${this.displayName()}"`;
  });
  protected textValue = computed(() => {
    const v = this.value();
    if (v == null) return '';
    const val = v.value;
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    return '';
  });
  protected definitionJson = computed(() => {
    const def = this.definition();
    return def ? JSON.stringify(def, null, 2) : '{}';
  });

  protected onInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.valueChange.emit({ value: target.value });
  }
}
