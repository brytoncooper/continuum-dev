import { describe, expect, it } from 'vitest';
import { makeNode } from '../test-fixtures.js';
import { collectSemanticKeyLocations } from './semantic-key-locations.js';
import {
  planCollectionToTopMoves,
  planTopToCollectionMoves,
} from './semantic-key-move-planner.js';

function makeTargetCollection(
  collectionId: string,
  fieldId: string,
  semanticKey?: string
) {
  return makeNode({
    id: collectionId,
    type: 'collection',
    template: makeNode({
      id: 'row',
      type: 'group',
      children: [
        makeNode({
          id: fieldId,
          type: 'field',
          semanticKey,
          dataType: 'string',
        }),
      ],
    }),
  });
}

describe('semantic key move planner', () => {
  it('plans top-to-collection moves when top-level source disappears', () => {
    const priorLocations = collectSemanticKeyLocations([
      makeNode({
        id: 'owner',
        type: 'field',
        semanticKey: 'task.owner',
        dataType: 'string',
      }),
      makeTargetCollection('tasks', 'assignee'),
    ]);
    const newLocations = collectSemanticKeyLocations([
      makeTargetCollection('tasks', 'assignee', 'task.owner'),
    ]);

    const intents = planTopToCollectionMoves(priorLocations, newLocations);

    expect(intents).toHaveLength(1);
    expect(intents[0].source.nodeId).toBe('owner');
    expect(intents[0].target.outerCollectionId).toBe('tasks');
  });

  it('does not plan top-to-collection moves when source still exists at top-level', () => {
    const source = makeNode({
      id: 'owner',
      type: 'field',
      semanticKey: 'task.owner',
      dataType: 'string',
    });
    const priorLocations = collectSemanticKeyLocations([
      source,
      makeTargetCollection('tasks', 'assignee'),
    ]);
    const newLocations = collectSemanticKeyLocations([
      source,
      makeTargetCollection('tasks', 'assignee', 'task.owner'),
    ]);

    const intents = planTopToCollectionMoves(priorLocations, newLocations);

    expect(intents).toHaveLength(0);
  });

  it('plans collection-to-top moves when collection source disappears', () => {
    const priorLocations = collectSemanticKeyLocations([
      makeTargetCollection('tasks', 'assignee', 'person.name'),
    ]);
    const newLocations = collectSemanticKeyLocations([
      makeNode({
        id: 'user_name',
        type: 'field',
        semanticKey: 'person.name',
        dataType: 'string',
      }),
      makeNode({
        id: 'tasks',
        type: 'collection',
        template: makeNode({
          id: 'row',
          type: 'group',
          children: [makeNode({ id: 'title', type: 'field', dataType: 'string' })],
        }),
      }),
    ]);

    const intents = planCollectionToTopMoves(priorLocations, newLocations);

    expect(intents).toHaveLength(1);
    expect(intents[0].source.outerCollectionId).toBe('tasks');
    expect(intents[0].target.nodeId).toBe('user_name');
  });
});
