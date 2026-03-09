import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  CollectionNodeState,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import { createSession } from '@continuum-dev/session';
import type { Session } from '@continuum-dev/session';
import { describe, expect, it, vi } from 'vitest';
import { ContinuumProvider } from './context.js';
import { useContinuumSession, useContinuumState } from './hooks.js';
import { ContinuumRenderer } from './renderer.js';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function readStringNodeValue(value: NodeValue | undefined): string {
  if (typeof value?.value === 'string') return value.value;
  return '';
}

function renderIntoDom(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function requireSession(session: Session | null): Session {
  if (!session) throw new Error('Expected session to be captured');
  return session;
}

type CollectionValue = NodeValue<{
  items: Array<{ values: Record<string, NodeValue> }>;
}>;

function collectionMap(overrides?: Record<string, React.ComponentType<any>>) {
  return {
    collection: ({
      children,
      onAdd,
      onRemove,
      canAdd,
      canRemove,
      definition,
      nodeId,
    }: {
      children?: ReactNode;
      onAdd?: () => void;
      onRemove?: (index: number) => void;
      canAdd?: boolean;
      canRemove?: boolean;
      definition: { id: string };
      nodeId?: string;
    }) => (
      <div data-testid={`collection-${definition.id}`} data-nodeid={nodeId}>
        {children}
        <button
          data-testid={`add-${definition.id}`}
          onClick={onAdd}
          disabled={!canAdd}
        >
          add
        </button>
        <span data-testid={`canAdd-${definition.id}`}>{String(canAdd)}</span>
        <span data-testid={`canRemove-${definition.id}`}>
          {String(canRemove)}
        </span>
      </div>
    ),
    group: ({
      children,
      nodeId,
      onRemove,
      canRemove,
      itemIndex,
    }: {
      children?: ReactNode;
      nodeId?: string;
      onRemove?: () => void;
      canRemove?: boolean;
      itemIndex?: number;
    }) => (
      <div
        data-testid="item-group"
        data-nodeid={nodeId}
        data-item-index={itemIndex}
      >
        {children}
        {canRemove !== undefined && (
          <button data-testid="remove-item" onClick={onRemove}>
            remove
          </button>
        )}
      </div>
    ),
    field: ({
      value,
      onChange,
      definition,
      nodeId,
    }: {
      value: NodeValue | undefined;
      onChange: (next: NodeValue) => void;
      definition: { id: string };
      nodeId?: string;
    }) => (
      <div
        data-testid={`field-${definition.id}`}
        data-nodeid={nodeId}
        data-value={readStringNodeValue(value)}
      >
        <span data-testid={`value-${definition.id}`}>
          {readStringNodeValue(value)}
        </span>
        <button
          data-testid={`set-${definition.id}`}
          onClick={() => onChange({ value: `edited-${definition.id}` })}
        >
          set
        </button>
      </div>
    ),
    ...overrides,
  };
}

function makeCollectionView(opts: {
  collectionId?: string;
  templateId?: string;
  fieldId?: string;
  minItems?: number;
  maxItems?: number;
  defaultValue?: unknown;
  children?: ViewNode[];
}): ViewDefinition {
  const {
    collectionId = 'items',
    templateId = 'row',
    fieldId = 'name',
    minItems,
    maxItems,
    defaultValue,
    children,
  } = opts;
  const templateChildren: ViewNode[] = children ?? [
    {
      id: fieldId,
      type: 'field',
      dataType: 'string',
      ...(defaultValue !== undefined ? { defaultValue } : {}),
    } as ViewNode,
  ];
  return {
    viewId: 'test-view',
    version: '1',
    nodes: [
      {
        id: collectionId,
        type: 'collection',
        ...(minItems !== undefined ? { minItems } : {}),
        ...(maxItems !== undefined ? { maxItems } : {}),
        template: {
          id: templateId,
          type: 'group',
          children: templateChildren,
        },
      } as ViewNode,
    ],
  };
}

function renderApp(
  view: ViewDefinition,
  map: Record<string, React.ComponentType<any>>
) {
  let capturedSession: Session | null = null;
  function App() {
    const session = useContinuumSession();
    capturedSession = session;
    if (!session.getSnapshot()) {
      session.pushView(view);
    }
    return <ContinuumRenderer view={view} />;
  }
  const rendered = renderIntoDom(
    <ContinuumProvider components={map}>
      <App />
    </ContinuumProvider>
  );
  return { rendered, getSession: () => requireSession(capturedSession) };
}

describe('renderer', () => {
  describe('deepCloneValues', () => {
    it('41: keeps nested collection state isolated when one outer item changes', () => {
      const deepNestedView: ViewDefinition = {
        viewId: 'deep-nested-view',
        version: '1',
        nodes: [
          {
            id: 'weeks',
            type: 'collection',
            minItems: 2,
            template: {
              id: 'week_item',
              type: 'group',
              children: [
                {
                  id: 'days',
                  type: 'collection',
                  minItems: 1,
                  template: {
                    id: 'day_item',
                    type: 'group',
                    children: [
                      {
                        id: 'task',
                        type: 'field',
                        dataType: 'string',
                        defaultValue: '',
                      } as ViewNode,
                    ],
                  },
                } as ViewNode,
              ],
            },
          } as ViewNode,
        ],
      };
      let clickCount = 0;
      const map = {
        collection: ({
          children,
          onAdd,
          canAdd,
          definition,
        }: {
          children?: ReactNode;
          onAdd?: () => void;
          canAdd?: boolean;
          definition: { id: string };
        }) => (
          <div data-testid={`collection-${definition.id}`}>
            {children}
            <button
              data-testid={`add-${definition.id}`}
              onClick={onAdd}
              disabled={!canAdd}
            >
              add
            </button>
          </div>
        ),
        group: ({ children }: { children?: ReactNode }) => (
          <div>{children}</div>
        ),
        field: ({
          value,
          onChange,
        }: {
          value: NodeValue | undefined;
          onChange: (next: NodeValue) => void;
        }) => (
          <button
            data-testid="task-field"
            onClick={() => {
              clickCount += 1;
              onChange({ value: `Task-${clickCount}`, isDirty: true });
            }}
          >
            {readStringNodeValue(value)}
          </button>
        ),
      };

      const { rendered } = renderApp(deepNestedView, map);

      const taskFields = rendered.container.querySelectorAll(
        '[data-testid="task-field"]'
      );
      expect(taskFields).toHaveLength(2);

      act(() => {
        (taskFields[0] as HTMLButtonElement).click();
      });

      const fieldsAfterEdit = rendered.container.querySelectorAll(
        '[data-testid="task-field"]'
      );
      expect((fieldsAfterEdit[0] as HTMLButtonElement).textContent).toBe(
        'Task-1'
      );
      expect((fieldsAfterEdit[1] as HTMLButtonElement).textContent).toBe('');

      const addDaysButtons = rendered.container.querySelectorAll(
        '[data-testid="add-days"]'
      );
      expect(addDaysButtons).toHaveLength(2);
      act(() => {
        (addDaysButtons[0] as HTMLButtonElement).click();
      });

      const fieldsAfterAdd = rendered.container.querySelectorAll(
        '[data-testid="task-field"]'
      );
      expect(fieldsAfterAdd).toHaveLength(3);
      expect((fieldsAfterAdd[0] as HTMLButtonElement).textContent).toBe(
        'Task-1'
      );
      expect((fieldsAfterAdd[1] as HTMLButtonElement).textContent).toBe('');
      expect((fieldsAfterAdd[2] as HTMLButtonElement).textContent).toBe('');
      rendered.unmount();
    });

    it('43: handles empty collection template defaults', () => {
      const view = makeCollectionView({ minItems: 1 });
      const { rendered } = renderApp(view, collectionMap());

      const values = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(values).toHaveLength(1);
      expect((values[0] as HTMLElement).textContent).toBe('');

      rendered.unmount();
    });
  });

  describe('toCanonicalId', () => {
    it('44: top-level node gets id as-is', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [
          { id: 'topfield', type: 'field', dataType: 'string' } as ViewNode,
        ],
      };
      const map = {
        field: ({ nodeId }: { nodeId?: string }) => (
          <div data-testid="node-id">{nodeId}</div>
        ),
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      expect(
        rendered.container.querySelector('[data-testid="node-id"]')?.textContent
      ).toBe('topfield');
      rendered.unmount();
    });

    it('45: nested node gets parentPath/id', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [
          {
            id: 'grp',
            type: 'group',
            children: [{ id: 'child', type: 'field', dataType: 'string' }],
          } as ViewNode,
        ],
      };
      const nodeIds: string[] = [];
      const map = {
        group: ({ children }: { children?: ReactNode }) => (
          <div>{children}</div>
        ),
        field: ({ nodeId }: { nodeId?: string }) => {
          if (nodeId) nodeIds.push(nodeId);
          return <div data-testid="nested-id">{nodeId}</div>;
        },
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      expect(nodeIds).toContain('grp/child');
      rendered.unmount();
    });

    it('46: deeply nested path produces correct canonical id', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [
          {
            id: 'a',
            type: 'group',
            children: [
              {
                id: 'b',
                type: 'group',
                children: [{ id: 'c', type: 'field', dataType: 'string' }],
              },
            ],
          } as ViewNode,
        ],
      };
      const nodeIds: string[] = [];
      const map = {
        group: ({ children }: { children?: ReactNode }) => (
          <div>{children}</div>
        ),
        field: ({ nodeId }: { nodeId?: string }) => {
          if (nodeId) nodeIds.push(nodeId);
          return <div />;
        },
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      expect(nodeIds).toContain('a/b/c');
      rendered.unmount();
    });
  });

  describe('normalizeCollectionNodeValue', () => {
    it('47: collection with undefined state renders 0 items', () => {
      const view = makeCollectionView({});
      const rendered = renderIntoDom(
        <ContinuumProvider components={collectionMap()}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(0);
      rendered.unmount();
    });

    it('48: collection with non-array items renders 0 items', () => {
      const view = makeCollectionView({});
      const { rendered, getSession } = renderApp(view, collectionMap());
      act(() => {
        getSession().updateState('items', { value: { items: 'not-an-array' } });
      });
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(0);
      rendered.unmount();
    });

    it('49: passes normalized collection state to collection components', () => {
      const view = makeCollectionView({});
      let capturedValue: NodeValue<CollectionNodeState> | undefined;
      const map = collectionMap({
        collection: ({
          value,
          children,
        }: {
          value: NodeValue<CollectionNodeState> | undefined;
          children?: ReactNode;
        }) => {
          capturedValue = value;
          return <div data-testid="captured-collection">{children}</div>;
        },
      });
      const { rendered, getSession } = renderApp(view, map);

      act(() => {
        getSession().updateState('items', {
          value: { items: 'not-an-array' } as unknown as CollectionNodeState,
          suggestion: {
            items: [{ values: { 'row/name': { value: 'draft' } } }],
          },
          isDirty: true,
        });
      });

      expect(capturedValue).toEqual({
        value: { items: [] },
        suggestion: {
          items: [{ values: { 'row/name': { value: 'draft' } } }],
        },
        isDirty: true,
      });
      rendered.unmount();
    });

    it('50: non-object item becomes empty values', () => {
      const view = makeCollectionView({});
      const { rendered, getSession } = renderApp(view, collectionMap());
      act(() => {
        getSession().updateState('items', {
          value: { items: ['not-an-object', null, 42] },
        });
      });
      const groups = rendered.container.querySelectorAll(
        '[data-testid="item-group"]'
      );
      expect(groups).toHaveLength(3);
      rendered.unmount();
    });

    it('51: item with null values becomes empty values', () => {
      const view = makeCollectionView({});
      const { rendered, getSession } = renderApp(view, collectionMap());
      act(() => {
        getSession().updateState('items', {
          value: { items: [{ values: null }] },
        });
      });
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(1);
      expect((fields[0] as HTMLElement).textContent).toBe('');
      rendered.unmount();
    });

    it('52: preserves metadata while normalizing item state for child reads', () => {
      const view = makeCollectionView({ minItems: 1, defaultValue: 'x' });
      const { rendered, getSession } = renderApp(view, collectionMap());
      act(() => {
        getSession().updateState('items', {
          value: {
            items: [{ values: null }],
          } as unknown as CollectionNodeState,
          isDirty: true,
        });
      });
      const snapshot = getSession().getSnapshot();
      const cv = snapshot?.data.values['items'] as CollectionValue | undefined;
      expect(cv?.isDirty).toBe(true);
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(1);
      expect((fields[0] as HTMLElement).textContent).toBe('x');
      rendered.unmount();
    });
  });

  describe('toRelativeNodeId', () => {
    it('53: collection scope returns undefined for collection id itself', () => {
      const view = makeCollectionView({ minItems: 1 });
      let scopeValue: NodeValue | undefined = undefined;
      const map = collectionMap({
        group: ({ children }: { children?: ReactNode }) => (
          <div>{children}</div>
        ),
        field: ({ value }: { value: NodeValue | undefined }) => {
          scopeValue = value;
          return <div data-testid="scope-probe" />;
        },
      });

      const fieldThatReadsCollectionId = {
        id: 'items',
        type: 'field' as const,
        dataType: 'string' as const,
      } as ViewNode;

      const hackedView: ViewDefinition = {
        viewId: 'test-view',
        version: '1',
        nodes: [
          {
            id: 'items',
            type: 'collection',
            minItems: 1,
            template: {
              id: 'row',
              type: 'group',
              children: [fieldThatReadsCollectionId],
            },
          } as ViewNode,
        ],
      };

      const { rendered } = renderApp(hackedView, map);
      expect(scopeValue).toBeUndefined();
      rendered.unmount();
    });

    it('54: collection scope returns correct relative id for child', () => {
      const view = makeCollectionView({ minItems: 1, defaultValue: 'hello' });
      const { rendered } = renderApp(view, collectionMap());
      const val = rendered.container.querySelector(
        '[data-testid="value-name"]'
      );
      expect((val as HTMLElement).textContent).toBe('hello');
      rendered.unmount();
    });

    it('55: collection scope returns undefined for unrelated node id', () => {
      let probeValue: NodeValue | undefined = { value: 'should-be-undefined' };
      const map = collectionMap({
        field: ({
          value,
          definition,
        }: {
          value: NodeValue | undefined;
          definition: { id: string };
        }) => {
          if (definition.id === 'unrelated') {
            probeValue = value;
          }
          return <div data-testid={`field-${definition.id}`} />;
        },
      });

      const view: ViewDefinition = {
        viewId: 'test-view',
        version: '1',
        nodes: [
          {
            id: 'col',
            type: 'collection',
            minItems: 1,
            template: {
              id: 'row',
              type: 'group',
              children: [
                {
                  id: 'unrelated',
                  type: 'field',
                  dataType: 'string',
                } as ViewNode,
              ],
            },
          } as ViewNode,
        ],
      };

      function App() {
        const session = useContinuumSession();
        if (!session.getSnapshot()) {
          session.pushView(view);
          session.updateState('totally_outside', { value: 'external' });
        }
        return <ContinuumRenderer view={view} />;
      }

      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <App />
        </ContinuumProvider>
      );
      expect(probeValue).toBeUndefined();
      rendered.unmount();
    });

    it('56: nested collection path extraction works', () => {
      const nestedView: ViewDefinition = {
        viewId: 'nested-col',
        version: '1',
        nodes: [
          {
            id: 'outer',
            type: 'collection',
            minItems: 1,
            template: {
              id: 'outer_item',
              type: 'group',
              children: [
                {
                  id: 'inner',
                  type: 'collection',
                  minItems: 1,
                  template: {
                    id: 'inner_item',
                    type: 'group',
                    children: [
                      {
                        id: 'leaf',
                        type: 'field',
                        dataType: 'string',
                        defaultValue: 'deep',
                      } as ViewNode,
                    ],
                  },
                } as ViewNode,
              ],
            },
          } as ViewNode,
        ],
      };
      const { rendered } = renderApp(nestedView, collectionMap());
      const val = rendered.container.querySelector(
        '[data-testid="value-leaf"]'
      );
      expect((val as HTMLElement).textContent).toBe('deep');
      rendered.unmount();
    });
  });

  describe('normalizeMinItems / normalizeMaxItems', () => {
    it('57: collection with undefined minItems renders 0 initial items', () => {
      const view = makeCollectionView({});
      const { rendered } = renderApp(view, collectionMap());
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(0);
      rendered.unmount();
    });

    it('58: collection with negative minItems renders 0 initial items', () => {
      const view = makeCollectionView({ minItems: -3 });
      const { rendered } = renderApp(view, collectionMap());
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(0);
      rendered.unmount();
    });

    it('59: collection with fractional minItems (2.7) floors to 2', () => {
      const view = makeCollectionView({ minItems: 2.7, defaultValue: 'f' });
      const { rendered } = renderApp(view, collectionMap());
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(2);
      rendered.unmount();
    });

    it('60: collection with undefined maxItems has no add limit', () => {
      const view = makeCollectionView({ minItems: 0 });
      const { rendered } = renderApp(view, collectionMap());
      const addBtn = rendered.container.querySelector(
        '[data-testid="add-items"]'
      ) as HTMLButtonElement;
      for (let i = 0; i < 10; i++) {
        act(() => {
          addBtn.click();
        });
      }
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(10);
      rendered.unmount();
    });

    it('61: collection with negative maxItems has no add limit', () => {
      const view = makeCollectionView({ minItems: 0, maxItems: -5 });
      const { rendered } = renderApp(view, collectionMap());
      const addBtn = rendered.container.querySelector(
        '[data-testid="add-items"]'
      ) as HTMLButtonElement;
      for (let i = 0; i < 5; i++) {
        act(() => {
          addBtn.click();
        });
      }
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(5);
      rendered.unmount();
    });

    it('62: collection with fractional maxItems (2.7) floors to 2', () => {
      const view = makeCollectionView({ minItems: 0, maxItems: 2.7 });
      const { rendered } = renderApp(view, collectionMap());
      const addBtn = rendered.container.querySelector(
        '[data-testid="add-items"]'
      ) as HTMLButtonElement;
      act(() => {
        addBtn.click();
      });
      act(() => {
        addBtn.click();
      });
      act(() => {
        addBtn.click();
      });
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(2);
      rendered.unmount();
    });
  });

  describe('createInitialCollectionState', () => {
    it('63: creates correct number of items from minItems', () => {
      const view = makeCollectionView({ minItems: 3 });
      const { rendered } = renderApp(view, collectionMap());
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(3);
      rendered.unmount();
    });

    it('64: creates 0 items when minItems is undefined', () => {
      const view = makeCollectionView({});
      const { rendered } = renderApp(view, collectionMap());
      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(0);
      rendered.unmount();
    });

    it('65: each item has values populated from template defaults', () => {
      const view = makeCollectionView({ minItems: 2, defaultValue: 'preset' });
      const { rendered } = renderApp(view, collectionMap());
      const values = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(values).toHaveLength(2);
      expect((values[0] as HTMLElement).textContent).toBe('preset');
      expect((values[1] as HTMLElement).textContent).toBe('preset');
      rendered.unmount();
    });

    it('66: nested collection templates get recursive default state', () => {
      const nestedView: ViewDefinition = {
        viewId: 'nested-default',
        version: '1',
        nodes: [
          {
            id: 'outer',
            type: 'collection',
            minItems: 1,
            template: {
              id: 'outer_item',
              type: 'group',
              children: [
                {
                  id: 'inner',
                  type: 'collection',
                  minItems: 2,
                  template: {
                    id: 'inner_item',
                    type: 'group',
                    children: [
                      {
                        id: 'leaf',
                        type: 'field',
                        dataType: 'string',
                        defaultValue: 'nested-default',
                      } as ViewNode,
                    ],
                  },
                } as ViewNode,
              ],
            },
          } as ViewNode,
        ],
      };
      const { rendered } = renderApp(nestedView, collectionMap());
      const leaves = rendered.container.querySelectorAll(
        '[data-testid="value-leaf"]'
      );
      expect(leaves).toHaveLength(2);
      expect((leaves[0] as HTMLElement).textContent).toBe('nested-default');
      expect((leaves[1] as HTMLElement).textContent).toBe('nested-default');
      rendered.unmount();
    });
  });

  describe('collectTemplateDefaults', () => {
    it('67: field with defaultValue shows default in initial render', () => {
      const view = makeCollectionView({
        minItems: 1,
        defaultValue: 'mydefault',
      });
      const { rendered } = renderApp(view, collectionMap());
      const val = rendered.container.querySelector(
        '[data-testid="value-name"]'
      );
      expect((val as HTMLElement).textContent).toBe('mydefault');
      rendered.unmount();
    });

    it('68: field without defaultValue shows empty', () => {
      const view = makeCollectionView({ minItems: 1 });
      const { rendered } = renderApp(view, collectionMap());
      const val = rendered.container.querySelector(
        '[data-testid="value-name"]'
      );
      expect((val as HTMLElement).textContent).toBe('');
      rendered.unmount();
    });

    it('69: group template with children recurses defaults', () => {
      const view: ViewDefinition = {
        viewId: 'grouped-defaults',
        version: '1',
        nodes: [
          {
            id: 'col',
            type: 'collection',
            minItems: 1,
            template: {
              id: 'tmpl',
              type: 'group',
              children: [
                {
                  id: 'inner_group',
                  type: 'group',
                  children: [
                    {
                      id: 'deep_field',
                      type: 'field',
                      dataType: 'string',
                      defaultValue: 'deep-val',
                    } as ViewNode,
                  ],
                } as ViewNode,
              ],
            },
          } as ViewNode,
        ],
      };
      const map = collectionMap({
        group: ({ children }: { children?: ReactNode }) => (
          <div>{children}</div>
        ),
      });
      const { rendered } = renderApp(view, map);
      const val = rendered.container.querySelector(
        '[data-testid="value-deep_field"]'
      );
      expect((val as HTMLElement).textContent).toBe('deep-val');
      rendered.unmount();
    });

    it('70: collection template inside collection gets recursive state', () => {
      const view: ViewDefinition = {
        viewId: 'col-in-col-defaults',
        version: '1',
        nodes: [
          {
            id: 'outer',
            type: 'collection',
            minItems: 1,
            template: {
              id: 'o_item',
              type: 'group',
              children: [
                {
                  id: 'inner',
                  type: 'collection',
                  minItems: 1,
                  template: {
                    id: 'i_item',
                    type: 'group',
                    children: [
                      {
                        id: 'val',
                        type: 'field',
                        dataType: 'string',
                        defaultValue: 'recursive',
                      } as ViewNode,
                    ],
                  },
                } as ViewNode,
              ],
            },
          } as ViewNode,
        ],
      };
      const { rendered } = renderApp(view, collectionMap());
      const val = rendered.container.querySelector('[data-testid="value-val"]');
      expect((val as HTMLElement).textContent).toBe('recursive');
      rendered.unmount();
    });

    it('71: deeply nested template has correct canonical paths', () => {
      const nodeIds: string[] = [];
      const view: ViewDefinition = {
        viewId: 'deep-paths',
        version: '1',
        nodes: [
          {
            id: 'col',
            type: 'collection',
            minItems: 1,
            template: {
              id: 'tmpl',
              type: 'group',
              children: [
                {
                  id: 'sub',
                  type: 'group',
                  children: [
                    {
                      id: 'leaf',
                      type: 'field',
                      dataType: 'string',
                    } as ViewNode,
                  ],
                } as ViewNode,
              ],
            },
          } as ViewNode,
        ],
      };
      const map = collectionMap({
        group: ({ children }: { children?: ReactNode }) => (
          <div>{children}</div>
        ),
        field: ({ nodeId }: { nodeId?: string }) => {
          if (nodeId) nodeIds.push(nodeId);
          return <div data-testid="path-probe" />;
        },
      });
      const { rendered } = renderApp(view, map);
      expect(nodeIds).toContain('col/tmpl/sub/leaf');
      rendered.unmount();
    });

    it('72: template with no children/defaults produces empty items', () => {
      const view: ViewDefinition = {
        viewId: 'no-defaults',
        version: '1',
        nodes: [
          {
            id: 'col',
            type: 'collection',
            minItems: 1,
            template: {
              id: 'tmpl',
              type: 'group',
              children: [
                { id: 'f', type: 'field', dataType: 'string' } as ViewNode,
              ],
            },
          } as ViewNode,
        ],
      };
      const { rendered, getSession } = renderApp(view, collectionMap());
      const snapshot = getSession().getSnapshot();
      const cv = snapshot?.data.values['col'] as CollectionValue | undefined;
      expect(cv?.value.items).toHaveLength(1);
      expect(cv?.value.items[0].values).toEqual({});
      rendered.unmount();
    });
  });

  describe('StatefulNodeRenderer', () => {
    it('73: renders component from componentMap for matching type', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [{ id: 'f', type: 'field', dataType: 'string' } as ViewNode],
      };
      const map = {
        field: () => <div data-testid="matched-component">matched</div>,
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      expect(
        rendered.container.querySelector('[data-testid="matched-component"]')
      ).toBeTruthy();
      rendered.unmount();
    });

    it('74: renders FallbackComponent when type not in map and no default', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [{ id: 'f', type: 'field', dataType: 'string' } as ViewNode],
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={{}}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      expect(
        rendered.container.querySelector('[data-continuum-fallback="field"]')
      ).toBeTruthy();
      rendered.unmount();
    });

    it('75: renders default component when type not in map but default exists', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [
          {
            id: 'f',
            type: 'custom_widget',
            dataType: 'string',
          } as unknown as ViewNode,
        ],
      };
      const map = {
        default: ({ definition }: { definition: { type: string } }) => (
          <div data-testid="default-comp">{definition.type}</div>
        ),
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      const el = rendered.container.querySelector(
        '[data-testid="default-comp"]'
      );
      expect(el).toBeTruthy();
      expect(el?.textContent).toBe('custom_widget');
      rendered.unmount();
    });

    it('76: returns null when definition.hidden is true', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [
          {
            id: 'f',
            type: 'field',
            dataType: 'string',
            hidden: true,
          } as ViewNode,
        ],
      };
      const map = {
        field: () => <div data-testid="should-not-render">visible</div>,
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      expect(
        rendered.container.querySelector('[data-testid="should-not-render"]')
      ).toBeNull();
      rendered.unmount();
    });
  });

  describe('ContainerNodeRenderer', () => {
    it('77: passes undefined value and noop onChange to container component', () => {
      let receivedValue: unknown = 'not-set';
      let receivedOnChange: unknown = null;
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [
          {
            id: 'grp',
            type: 'group',
            children: [{ id: 'f', type: 'field', dataType: 'string' }],
          } as ViewNode,
        ],
      };
      const map = {
        group: ({
          value,
          onChange,
          children,
        }: {
          value: unknown;
          onChange: unknown;
          children?: ReactNode;
        }) => {
          receivedValue = value;
          receivedOnChange = onChange;
          return <div>{children}</div>;
        },
        field: () => <div data-testid="inner-field" />,
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      expect(receivedValue).toBeUndefined();
      expect(typeof receivedOnChange).toBe('function');
      expect((receivedOnChange as () => unknown)()).toBeUndefined();
      rendered.unmount();
    });

    it('78: renders children nodes recursively', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [
          {
            id: 'grp',
            type: 'group',
            children: [
              { id: 'f1', type: 'field', dataType: 'string' },
              { id: 'f2', type: 'field', dataType: 'string' },
            ],
          } as ViewNode,
        ],
      };
      const map = {
        group: ({ children }: { children?: ReactNode }) => (
          <div data-testid="container">{children}</div>
        ),
        field: ({ definition }: { definition: { id: string } }) => (
          <div data-testid={`child-${definition.id}`} />
        ),
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      expect(
        rendered.container.querySelector('[data-testid="child-f1"]')
      ).toBeTruthy();
      expect(
        rendered.container.querySelector('[data-testid="child-f2"]')
      ).toBeTruthy();
      rendered.unmount();
    });

    it('79: returns null when definition.hidden is true', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [
          {
            id: 'grp',
            type: 'group',
            hidden: true,
            children: [{ id: 'f', type: 'field', dataType: 'string' }],
          } as ViewNode,
        ],
      };
      const map = {
        group: ({ children }: { children?: ReactNode }) => (
          <div data-testid="hidden-grp">{children}</div>
        ),
        field: () => <div data-testid="hidden-child" />,
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      expect(
        rendered.container.querySelector('[data-testid="hidden-grp"]')
      ).toBeNull();
      expect(
        rendered.container.querySelector('[data-testid="hidden-child"]')
      ).toBeNull();
      rendered.unmount();
    });

    it('80: passes canonical nodeId to container component', () => {
      let capturedNodeId = '';
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [
          {
            id: 'outer',
            type: 'group',
            children: [
              {
                id: 'inner',
                type: 'group',
                children: [{ id: 'f', type: 'field', dataType: 'string' }],
              },
            ],
          } as ViewNode,
        ],
      };
      const map = {
        group: ({
          nodeId,
          children,
        }: {
          nodeId?: string;
          children?: ReactNode;
        }) => {
          if (nodeId === 'outer/inner') capturedNodeId = nodeId;
          return <div>{children}</div>;
        },
        field: () => <div />,
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      expect(capturedNodeId).toBe('outer/inner');
      rendered.unmount();
    });

    it('81: passes mappedProps through to container component', () => {
      const view = makeCollectionView({ minItems: 1 });
      let capturedItemIndex: number | undefined;
      const map = collectionMap({
        group: ({
          children,
          itemIndex,
        }: {
          children?: ReactNode;
          itemIndex?: number;
        }) => {
          capturedItemIndex = itemIndex;
          return <div>{children}</div>;
        },
      });
      const { rendered } = renderApp(view, map);
      expect(capturedItemIndex).toBe(0);
      rendered.unmount();
    });
  });

  describe('CollectionItemRenderer', () => {
    it('82: collection items provide scoped state to children', () => {
      const view = makeCollectionView({ minItems: 2, defaultValue: 'scoped' });
      const { rendered } = renderApp(view, collectionMap());
      const values = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(values).toHaveLength(2);
      expect((values[0] as HTMLElement).textContent).toBe('scoped');
      expect((values[1] as HTMLElement).textContent).toBe('scoped');
      rendered.unmount();
    });

    it('83: scope reads from correct item index', () => {
      const view = makeCollectionView({ minItems: 2, defaultValue: 'init' });
      const { rendered } = renderApp(view, collectionMap());

      const setBtns = rendered.container.querySelectorAll(
        '[data-testid="set-name"]'
      );
      act(() => {
        (setBtns[1] as HTMLButtonElement).click();
      });

      const values = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect((values[0] as HTMLElement).textContent).toBe('init');
      expect((values[1] as HTMLElement).textContent).toBe('edited-name');
      rendered.unmount();
    });

    it('84: scope falls back to templateDefaults for missing keys', () => {
      const view = makeCollectionView({
        minItems: 0,
        defaultValue: 'fallback-val',
      });
      const { rendered } = renderApp(view, collectionMap());

      const addBtn = rendered.container.querySelector(
        '[data-testid="add-items"]'
      ) as HTMLButtonElement;
      act(() => {
        addBtn.click();
      });

      const val = rendered.container.querySelector(
        '[data-testid="value-name"]'
      );
      expect((val as HTMLElement).textContent).toBe('fallback-val');
      rendered.unmount();
    });

    it('85: scope returns undefined for non-matching prefix', () => {
      let capturedValue: NodeValue | undefined = {
        value: 'should-be-undefined',
      };
      const view: ViewDefinition = {
        viewId: 'prefix-test',
        version: '1',
        nodes: [
          {
            id: 'col',
            type: 'collection',
            minItems: 1,
            template: {
              id: 'tmpl',
              type: 'group',
              children: [
                { id: 'col', type: 'field', dataType: 'string' } as ViewNode,
              ],
            },
          } as ViewNode,
        ],
      };
      const map = collectionMap({
        field: ({
          value,
          definition,
        }: {
          value: NodeValue | undefined;
          definition: { id: string };
        }) => {
          if (definition.id === 'col') capturedValue = value;
          return <div data-testid={`field-${definition.id}`} />;
        },
      });
      const { rendered } = renderApp(view, map);
      expect(capturedValue).toBeUndefined();
      rendered.unmount();
    });

    it('86: scope write to one item preserves other items', () => {
      const view = makeCollectionView({ minItems: 3, defaultValue: 'orig' });
      const { rendered, getSession } = renderApp(view, collectionMap());

      const setBtns = rendered.container.querySelectorAll(
        '[data-testid="set-name"]'
      );
      act(() => {
        (setBtns[1] as HTMLButtonElement).click();
      });

      const snapshot = getSession().getSnapshot();
      const cv = snapshot?.data.values['items'] as CollectionValue | undefined;
      expect(cv?.value.items[0].values['row/name']?.value ?? 'orig').toBe(
        'orig'
      );
      expect(cv?.value.items[1].values['row/name']?.value).toBe('edited-name');
      expect(cv?.value.items[2].values['row/name']?.value ?? 'orig').toBe(
        'orig'
      );
      rendered.unmount();
    });

    it('87: scope pads items array when needed', () => {
      const view = makeCollectionView({});
      const { rendered, getSession } = renderApp(view, collectionMap());

      act(() => {
        getSession().updateState('items', {
          value: { items: [] },
        });
      });

      const addBtn = rendered.container.querySelector(
        '[data-testid="add-items"]'
      ) as HTMLButtonElement;
      act(() => {
        addBtn.click();
      });
      act(() => {
        addBtn.click();
      });

      const setBtns = rendered.container.querySelectorAll(
        '[data-testid="set-name"]'
      );
      act(() => {
        (setBtns[1] as HTMLButtonElement).click();
      });

      const snapshot = getSession().getSnapshot();
      const cv = snapshot?.data.values['items'] as CollectionValue | undefined;
      expect(cv?.value.items).toHaveLength(2);
      expect(cv?.value.items[1].values['row/name']).toEqual({
        value: 'edited-name',
      });
      rendered.unmount();
    });
  });

  describe('CollectionNodeRenderer', () => {
    it('88: addItem appends new item with deep-cloned template defaults', () => {
      const view = makeCollectionView({
        minItems: 1,
        defaultValue: 'tmpl-val',
      });
      const { rendered, getSession } = renderApp(view, collectionMap());

      const addBtn = rendered.container.querySelector(
        '[data-testid="add-items"]'
      ) as HTMLButtonElement;
      act(() => {
        addBtn.click();
      });

      const values = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(values).toHaveLength(2);
      expect((values[1] as HTMLElement).textContent).toBe('tmpl-val');

      const snapshot = getSession().getSnapshot();
      const cv = snapshot?.data.values['items'] as CollectionValue | undefined;
      expect(cv?.value.items).toHaveLength(2);
      rendered.unmount();
    });

    it('89: addItem is no-op when maxItems reached', () => {
      const view = makeCollectionView({ minItems: 2, maxItems: 2 });
      const { rendered } = renderApp(view, collectionMap());

      const addBtn = rendered.container.querySelector(
        '[data-testid="add-items"]'
      ) as HTMLButtonElement;
      act(() => {
        addBtn.click();
      });

      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(2);

      const canAdd = rendered.container.querySelector(
        '[data-testid="canAdd-items"]'
      );
      expect((canAdd as HTMLElement).textContent).toBe('false');
      rendered.unmount();
    });

    it('90: removeItem removes item at index', () => {
      const view = makeCollectionView({ minItems: 0, defaultValue: 'rm' });
      const { rendered } = renderApp(view, collectionMap());

      const addBtn = rendered.container.querySelector(
        '[data-testid="add-items"]'
      ) as HTMLButtonElement;
      act(() => {
        addBtn.click();
      });
      act(() => {
        addBtn.click();
      });
      act(() => {
        addBtn.click();
      });

      const removeBtns = rendered.container.querySelectorAll(
        '[data-testid="remove-item"]'
      );
      expect(removeBtns.length).toBeGreaterThan(0);
      act(() => {
        (removeBtns[0] as HTMLButtonElement).click();
      });

      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(2);
      rendered.unmount();
    });

    it('91: removeItem is no-op at minItems', () => {
      const view = makeCollectionView({ minItems: 2 });
      const { rendered } = renderApp(view, collectionMap());

      const fields = rendered.container.querySelectorAll(
        '[data-testid="value-name"]'
      );
      expect(fields).toHaveLength(2);

      const canRemove = rendered.container.querySelector(
        '[data-testid="canRemove-items"]'
      );
      expect((canRemove as HTMLElement).textContent).toBe('false');
      rendered.unmount();
    });

    it('92: passes canAdd=false at maxItems', () => {
      const view = makeCollectionView({ minItems: 3, maxItems: 3 });
      const { rendered } = renderApp(view, collectionMap());

      const canAdd = rendered.container.querySelector(
        '[data-testid="canAdd-items"]'
      );
      expect((canAdd as HTMLElement).textContent).toBe('false');

      const addBtn = rendered.container.querySelector(
        '[data-testid="add-items"]'
      ) as HTMLButtonElement;
      expect(addBtn.disabled).toBe(true);
      rendered.unmount();
    });

    it('93: surfaces collection item suggestions to nested field renderer props', () => {
      const view = makeCollectionView({ minItems: 1 });

      const map = collectionMap({
        field: ({
          hasSuggestion,
          suggestionValue,
        }: {
          hasSuggestion?: boolean;
          suggestionValue?: unknown;
        }) => (
          <div
            data-testid="collection-suggestion-probe"
            data-has-suggestion={String(hasSuggestion)}
            data-suggestion-value={String(suggestionValue ?? '')}
          />
        ),
      });

      let capturedSession: Session | null = null;
      function App() {
        const session = useContinuumSession();
        capturedSession = session;
        if (!session.getSnapshot()) {
          session.pushView(view);
          session.updateState('items', {
            value: {
              items: [
                {
                  values: {
                    'row/name': { value: 'typed', isDirty: true },
                  },
                },
              ],
            },
            suggestion: {
              items: [
                {
                  values: {
                    'row/name': { value: 'ai-name' },
                  },
                },
              ],
            },
          } as NodeValue<CollectionNodeState>);
        }
        return <ContinuumRenderer view={view} />;
      }

      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <App />
        </ContinuumProvider>
      );

      const probe = rendered.container.querySelector(
        '[data-testid="collection-suggestion-probe"]'
      ) as HTMLElement;
      expect(probe.getAttribute('data-has-suggestion')).toBe('true');
      expect(probe.getAttribute('data-suggestion-value')).toBe('ai-name');

      const snapshot = requireSession(capturedSession).getSnapshot();
      const collection = snapshot?.data.values['items'] as
        | NodeValue<CollectionNodeState>
        | undefined;
      expect(collection?.suggestion).toBeDefined();
      rendered.unmount();
    });

    it('94: accepting nested field suggestion clears collection root suggestion entry', () => {
      const view = makeCollectionView({ minItems: 1 });

      const map = collectionMap({
        field: ({
          value,
          onChange,
          hasSuggestion,
          suggestionValue,
        }: {
          value: NodeValue | undefined;
          onChange: (next: NodeValue) => void;
          hasSuggestion?: boolean;
          suggestionValue?: unknown;
        }) => (
          <button
            data-testid="accept-nested-suggestion"
            data-has-suggestion={String(hasSuggestion)}
            onClick={() =>
              onChange({
                ...(value ?? { value: undefined }),
                value: suggestionValue,
                suggestion: undefined,
                isDirty: true,
              } as NodeValue)
            }
          >
            accept
          </button>
        ),
      });

      let capturedSession: Session | null = null;
      function App() {
        const session = useContinuumSession();
        capturedSession = session;
        if (!session.getSnapshot()) {
          session.pushView(view);
          session.updateState('items', {
            value: {
              items: [
                {
                  values: {
                    'row/name': { value: 'typed', isDirty: true },
                  },
                },
              ],
            },
            suggestion: {
              items: [
                {
                  values: {
                    'row/name': { value: 'ai-name' },
                  },
                },
              ],
            },
          } as NodeValue<CollectionNodeState>);
        }
        return <ContinuumRenderer view={view} />;
      }

      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <App />
        </ContinuumProvider>
      );

      const acceptButton = rendered.container.querySelector(
        '[data-testid="accept-nested-suggestion"]'
      ) as HTMLButtonElement;
      expect(acceptButton.getAttribute('data-has-suggestion')).toBe('true');

      act(() => {
        acceptButton.click();
      });

      const snapshot = requireSession(capturedSession).getSnapshot();
      const collection = snapshot?.data.values['items'] as
        | NodeValue<CollectionNodeState>
        | undefined;
      expect(collection?.value.items[0].values['row/name']?.value).toBe(
        'ai-name'
      );
      expect(collection?.suggestion).toBeUndefined();

      rendered.unmount();
    });
  });

  describe('NodeRenderer dispatch', () => {
    it('93: renders CollectionNodeRenderer for type collection', () => {
      const view = makeCollectionView({ minItems: 1 });
      const { rendered } = renderApp(view, collectionMap());
      expect(
        rendered.container.querySelector('[data-testid="collection-items"]')
      ).toBeTruthy();
      rendered.unmount();
    });

    it('94: renders ContainerNodeRenderer for nodes with children', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [
          {
            id: 'g',
            type: 'group',
            children: [{ id: 'f', type: 'field', dataType: 'string' }],
          } as ViewNode,
        ],
      };
      let containerRendered = false;
      const map = {
        group: ({ children }: { children?: ReactNode }) => {
          containerRendered = true;
          return <div data-testid="container-node">{children}</div>;
        },
        field: () => <div data-testid="leaf-in-container" />,
      };
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <ContinuumRenderer view={view} />
        </ContinuumProvider>
      );
      expect(containerRendered).toBe(true);
      expect(
        rendered.container.querySelector('[data-testid="leaf-in-container"]')
      ).toBeTruthy();
      rendered.unmount();
    });

    it('95: renders StatefulNodeRenderer for leaf nodes', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [{ id: 'leaf', type: 'field', dataType: 'string' } as ViewNode],
      };
      let leafRendered = false;
      const map = {
        field: ({
          value,
          onChange,
        }: {
          value: NodeValue | undefined;
          onChange: (v: NodeValue) => void;
        }) => {
          leafRendered = true;
          return (
            <div data-testid="stateful-leaf">
              <button
                data-testid="leaf-set"
                onClick={() => onChange({ value: 'clicked' })}
              >
                set
              </button>
            </div>
          );
        },
      };
      let capturedSession: Session | null = null;
      function App() {
        const session = useContinuumSession();
        capturedSession = session;
        if (!session.getSnapshot()) {
          session.pushView(view);
        }
        return <ContinuumRenderer view={view} />;
      }
      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <App />
        </ContinuumProvider>
      );
      expect(leafRendered).toBe(true);

      const btn = rendered.container.querySelector(
        '[data-testid="leaf-set"]'
      ) as HTMLButtonElement;
      act(() => {
        btn.click();
      });

      const session = requireSession(capturedSession);
      const snapshot = session.getSnapshot();
      expect(snapshot?.data.values['leaf']).toEqual({ value: 'clicked' });
      rendered.unmount();
    });

    it('96: passes hasSuggestion and suggestionValue to leaf components', () => {
      const view: ViewDefinition = {
        viewId: 'v',
        version: '1',
        nodes: [{ id: 'leaf', type: 'field', dataType: 'string' } as ViewNode],
      };

      const map = {
        field: ({
          hasSuggestion,
          suggestionValue,
        }: {
          hasSuggestion?: boolean;
          suggestionValue?: unknown;
        }) => (
          <div
            data-testid="suggestion-props"
            data-has-suggestion={String(hasSuggestion)}
            data-suggestion-value={String(suggestionValue ?? '')}
          />
        ),
      };

      let capturedSession: Session | null = null;
      function App() {
        const session = useContinuumSession();
        capturedSession = session;
        if (!session.getSnapshot()) {
          session.pushView(view);
          session.updateState('leaf', {
            value: 'user value',
            suggestion: 'ai suggestion',
          } as NodeValue);
        }
        return <ContinuumRenderer view={view} />;
      }

      const rendered = renderIntoDom(
        <ContinuumProvider components={map}>
          <App />
        </ContinuumProvider>
      );

      const el = rendered.container.querySelector(
        '[data-testid="suggestion-props"]'
      ) as HTMLElement;
      expect(el.getAttribute('data-has-suggestion')).toBe('true');
      expect(el.getAttribute('data-suggestion-value')).toBe('ai suggestion');

      const snapshot = requireSession(capturedSession).getSnapshot();
      expect(snapshot?.data.values['leaf']).toEqual({
        value: 'user value',
        suggestion: 'ai suggestion',
      });

      rendered.unmount();
    });
  });
});
