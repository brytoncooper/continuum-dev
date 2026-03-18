import { describe, expect, it } from 'vitest';
import {
  cloneView,
  collectNodeEntries,
  collectStatefulEntries,
  findNodeByCanonicalId,
  getChildNodes,
  indexTargets,
  parseJson,
  summarizeCurrentData,
  toBoolean,
  uniqueNonEmptyStrings,
} from './shared.mjs';

const nestedNodes = [
  {
    id: 'profile',
    type: 'group',
    label: 'Profile',
    children: [
      {
        id: 'full_name',
        type: 'field',
        label: 'Full name',
        dataType: 'string',
        key: 'person.fullName',
        semanticKey: 'person.fullName',
      },
      {
        id: 'contact_row',
        type: 'row',
        children: [
          {
            id: 'email',
            type: 'field',
            dataType: 'string',
            key: 'person.email',
            semanticKey: 'person.email',
          },
        ],
      },
      {
        id: 'dependents',
        type: 'collection',
        key: 'person.dependents',
        semanticKey: 'person.dependents',
        template: {
          id: 'dependent',
          type: 'group',
          children: [
            {
              id: 'name',
              type: 'field',
              dataType: 'string',
              key: 'dependent.name',
              semanticKey: 'dependent.name',
            },
          ],
        },
      },
    ],
  },
];

describe('continuum execution shared parsing helpers', () => {
  it('parses direct JSON and embedded JSON payloads', () => {
    expect(parseJson('{"mode":"view"}')).toEqual({
      mode: 'view',
    });

    expect(parseJson('Planner output:\n{"mode":"patch","fallback":"view"}')).toEqual({
      mode: 'patch',
      fallback: 'view',
    });
  });

  it('returns null for malformed or missing JSON payloads', () => {
    expect(parseJson('not json')).toBeNull();
    expect(parseJson('{"mode":"patch"')).toBeNull();
  });

  it('deduplicates and trims string arrays while keeping only meaningful values', () => {
    expect(uniqueNonEmptyStrings([' email ', '', 'email', ' phone ', 42 as never])).toEqual([
      'email',
      'phone',
    ]);
  });

  it('treats only the literal boolean true as dirty', () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(false)).toBe(false);
    expect(toBoolean('true')).toBe(false);
  });
});

describe('continuum execution shared tree helpers', () => {
  it('walks container children including collection templates', () => {
    expect(getChildNodes(nestedNodes[0])).toHaveLength(3);
    expect(getChildNodes((nestedNodes[0].children as Array<unknown>)[2])).toEqual([
      {
        id: 'dependent',
        type: 'group',
        children: [
          {
            id: 'name',
            type: 'field',
            dataType: 'string',
            key: 'dependent.name',
            semanticKey: 'dependent.name',
          },
        ],
      },
    ]);
  });

  it('collects stateful entries with canonical ids across nested structures', () => {
    expect(collectStatefulEntries(nestedNodes)).toEqual([
      {
        canonicalId: 'profile/full_name',
        id: 'full_name',
        key: 'person.fullName',
        semanticKey: 'person.fullName',
        type: 'field',
      },
      {
        canonicalId: 'profile/contact_row/email',
        id: 'email',
        key: 'person.email',
        semanticKey: 'person.email',
        type: 'field',
      },
      {
        canonicalId: 'profile/dependents',
        id: 'dependents',
        key: 'person.dependents',
        semanticKey: 'person.dependents',
        type: 'collection',
      },
      {
        canonicalId: 'profile/dependents/dependent/name',
        id: 'name',
        key: 'dependent.name',
        semanticKey: 'dependent.name',
        type: 'field',
      },
    ]);
  });

  it('collects all node entries including non-stateful containers', () => {
    expect(collectNodeEntries(nestedNodes)).toEqual([
      {
        canonicalId: 'profile',
        id: 'profile',
        key: undefined,
        semanticKey: undefined,
        type: 'group',
        label: 'Profile',
      },
      {
        canonicalId: 'profile/full_name',
        id: 'full_name',
        key: 'person.fullName',
        semanticKey: 'person.fullName',
        type: 'field',
        label: 'Full name',
      },
      {
        canonicalId: 'profile/contact_row',
        id: 'contact_row',
        key: undefined,
        semanticKey: undefined,
        type: 'row',
        label: undefined,
      },
      {
        canonicalId: 'profile/contact_row/email',
        id: 'email',
        key: 'person.email',
        semanticKey: 'person.email',
        type: 'field',
        label: undefined,
      },
      {
        canonicalId: 'profile/dependents',
        id: 'dependents',
        key: 'person.dependents',
        semanticKey: 'person.dependents',
        type: 'collection',
        label: undefined,
      },
      {
        canonicalId: 'profile/dependents/dependent',
        id: 'dependent',
        key: undefined,
        semanticKey: undefined,
        type: 'group',
        label: undefined,
      },
      {
        canonicalId: 'profile/dependents/dependent/name',
        id: 'name',
        key: 'dependent.name',
        semanticKey: 'dependent.name',
        type: 'field',
        label: undefined,
      },
    ]);
  });
});

describe('continuum execution shared indexing and summaries', () => {
  it('indexes trimmed targets by node id and keeps the first semantic key match', () => {
    const firstTarget = {
      nodeId: ' email ',
      semanticKey: ' person.email ',
    };
    const secondTarget = {
      nodeId: 'secondary_email',
      semanticKey: 'person.email',
    };

    const indexed = indexTargets([firstTarget, secondTarget]);

    expect(indexed.byNodeId.has('email')).toBe(true);
    expect(indexed.byNodeId.has('secondary_email')).toBe(true);
    expect(indexed.bySemanticKey.size).toBe(1);
    expect(indexed.bySemanticKey.get('person.email')).toBe(firstTarget);
  });

  it('summarizes long strings, arrays, objects, and dirty state for prompt context', () => {
    const summary = summarizeCurrentData({
      email: {
        value: 'x'.repeat(70),
        isDirty: true,
      },
      aliases: {
        value: ['one', 'two'],
      },
      address: {
        value: {
          street: '123 Main',
          city: 'Denver',
          zip: '80202',
          region: 'CO',
          country: 'US',
        },
        isDirty: false,
      },
      ignored: {
        status: 'not included',
      },
    });

    expect(summary).toEqual([
      {
        nodeId: 'email',
        value: `${'x'.repeat(57)}...`,
        isDirty: true,
      },
      {
        nodeId: 'aliases',
        value: '[2 items]',
        isDirty: false,
      },
      {
        nodeId: 'address',
        value: '{street, city, zip, region, ...}',
        isDirty: false,
      },
    ]);
  });
});

describe('continuum execution shared cloning and lookup', () => {
  it('clones views deeply before mutations', () => {
    const originalView = {
      viewId: 'profile',
      version: '1',
      nodes: nestedNodes,
    };

    const clonedView = cloneView(originalView);
    clonedView.nodes[0].label = 'Updated profile';

    expect(originalView.nodes[0].label).toBe('Profile');
    expect(clonedView.nodes[0].label).toBe('Updated profile');
  });

  it('finds nodes by canonical id through nested rows and collection templates', () => {
    expect(findNodeByCanonicalId(nestedNodes, 'profile/contact_row/email')).toMatchObject({
      id: 'email',
      semanticKey: 'person.email',
    });

    expect(findNodeByCanonicalId(nestedNodes, 'profile/dependents/dependent/name')).toMatchObject(
      {
        id: 'name',
        semanticKey: 'dependent.name',
      }
    );

    expect(findNodeByCanonicalId(nestedNodes, 'profile/missing')).toBeNull();
  });
});
