import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import type { ViewNode } from '@continuum/contract';
import { ContinuumViewNodeComponent } from './renderer.js';

@Component({
  selector: 'continuum-children-renderer',
  standalone: true,
  imports: [ContinuumViewNodeComponent],
  template: `
    @for (child of definitions; track child.id) {
      <continuum-view-node [definition]="child" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContinuumChildrenRendererComponent {
  @Input() definitions: ViewNode[] = [];
}
