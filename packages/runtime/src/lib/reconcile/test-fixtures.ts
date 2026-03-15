import type {
  DataSnapshot,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import { reconcile as runtimeReconcile } from './index.js';
import type { ReconciliationOptions } from '../types.js';

export const TEST_NOW = 2000;

export function reconcileWithFixedClock(
  newView: ViewDefinition,
  priorView: ViewDefinition | null,
  priorData: DataSnapshot | null,
  options: ReconciliationOptions = {}
) {
  return runtimeReconcile({
    newView,
    priorView,
    priorData,
    options: {
      clock: () => TEST_NOW,
      ...options,
    },
  });
}

export function makeView(
  nodes: ViewNode[],
  viewId = 'view-1',
  version = '1.0'
): ViewDefinition {
  return { viewId, version, nodes };
}

export function makeNode(
  overrides: Partial<ViewNode> & { id: string; type?: ViewNode['type'] }
): ViewNode {
  const { id, type: overrideType, ...rest } = overrides;
  const type = overrideType ?? 'field';
  return {
    id,
    key: rest.key,
    semanticKey: (rest as { semanticKey?: string }).semanticKey,
    hash: rest.hash,
    hidden: rest.hidden,
    migrations: rest.migrations,
    type,
    ...(type === 'field' ? { dataType: 'string' } : {}),
    ...(type === 'group' ? { children: [] as ViewNode[] } : {}),
    ...(type === 'row' ? { children: [] as ViewNode[] } : {}),
    ...(type === 'grid' ? { children: [] as ViewNode[] } : {}),
    ...(type === 'collection'
      ? {
          template: {
            id: `${id}-tpl`,
            type: 'field',
            dataType: 'string',
          } as ViewNode,
        }
      : {}),
    ...(type === 'action' ? { intentId: 'intent-1', label: 'Run' } : {}),
    ...(type === 'presentation' ? { contentType: 'text', content: '' } : {}),
    ...rest,
  } as ViewNode;
}

export function makeData(
  values: Record<string, NodeValue>,
  lineage?: Partial<DataSnapshot['lineage']>,
  valueLineage?: DataSnapshot['valueLineage']
): DataSnapshot {
  return {
    values,
    lineage: {
      timestamp: 1000,
      sessionId: 'test-session',
      ...lineage,
    },
    ...(valueLineage ? { valueLineage } : {}),
  };
}
