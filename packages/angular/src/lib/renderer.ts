import {
  Component,
  input,
  inject,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type {
  ViewNode,
  NodeValue,
  ViewDefinition,
} from '@continuum-dev/contract';
import { CONTINUUM_NODE_MAP, CONTINUUM_SNAPSHOT } from './tokens.js';
import { ContinuumFallbackComponent } from './fallback.js';
import { injectContinuumSession } from './inject.js';

@Component({
  selector: 'continuum-view-node',
  standalone: true,
  imports: [NgComponentOutlet, ContinuumFallbackComponent],
  template: `
    @if (!definition().hidden) {
    <div [attr.data-continuum-id]="definition().id">
      @if (resolvedComponent(); as comp) {
      <ng-container *ngComponentOutlet="comp; inputs: nodeInputs()" />
      } @else {
      <continuum-fallback
        [definition]="definition()"
        [value]="state()"
        (valueChange)="setState($event)"
      />
      }
    </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContinuumViewNodeComponent {
  definition = input.required<ViewNode>();

  private session = injectContinuumSession();
  private snapshot = inject(CONTINUUM_SNAPSHOT);
  private nodeMap = inject(CONTINUUM_NODE_MAP);

  protected state = computed(() => {
    const def = this.definition();
    if (!def) return undefined;
    return this.snapshot()?.data.values?.[def.id] as NodeValue | undefined;
  });
  protected setState = (value: NodeValue) => {
    const def = this.definition();
    if (def) this.session.updateState(def.id, value);
  };
  protected resolvedComponent = computed(() => {
    const def = this.definition();
    if (!def) return null;
    return this.nodeMap[def.type] ?? this.nodeMap['default'] ?? null;
  });
  protected nodeInputs = computed(() => ({
    value: this.state(),
    onChange: this.setState,
    definition: this.definition(),
  }));
}

@Component({
  selector: 'continuum-renderer',
  standalone: true,
  imports: [ContinuumViewNodeComponent],
  template: `
    <div [attr.data-continuum-view]="view().viewId">
      @for (node of view().nodes ?? []; track node.id) {
      <continuum-view-node [definition]="node" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContinuumRendererComponent {
  view = input.required<ViewDefinition>();
}
