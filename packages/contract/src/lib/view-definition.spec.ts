import { describe, it, expect } from 'vitest';
import { getChildNodes } from './view-definition.js';
import type { 
  GroupNode, RowNode, GridNode, CollectionNode, FieldNode, ActionNode, PresentationNode 
} from './view-definition.js';

describe('getChildNodes', () => {
  it('returns children for group nodes', () => {
    const node: GroupNode = {
      id: 'g1', type: 'group',
      children: [{ id: 'f1', type: 'field', dataType: 'string' }]
    };
    expect(getChildNodes(node)).toHaveLength(1);
    expect(getChildNodes(node)[0].id).toBe('f1');
  });

  it('returns children for row nodes', () => {
    const node: RowNode = {
      id: 'r1', type: 'row',
      children: [{ id: 'f1', type: 'field', dataType: 'string' }]
    };
    expect(getChildNodes(node)).toHaveLength(1);
  });

  it('returns children for grid nodes', () => {
    const node: GridNode = {
      id: 'grid1', type: 'grid',
      children: [{ id: 'f1', type: 'field', dataType: 'string' }]
    };
    expect(getChildNodes(node)).toHaveLength(1);
  });

  it('returns template as only child for collection nodes', () => {
    const node: CollectionNode = {
      id: 'c1', type: 'collection',
      template: { id: 'f1', type: 'field', dataType: 'string' }
    };
    const children = getChildNodes(node);
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe('f1');
  });

  it('returns empty array for non-container nodes', () => {
    const field: FieldNode = { id: 'f1', type: 'field', dataType: 'string' };
    const action: ActionNode = { id: 'a1', type: 'action', intentId: 'run', label: 'Run' };
    const presentation: PresentationNode = { id: 'p1', type: 'presentation', contentType: 'text', content: '' };

    expect(getChildNodes(field)).toHaveLength(0);
    expect(getChildNodes(action)).toHaveLength(0);
    expect(getChildNodes(presentation)).toHaveLength(0);
  });
});
