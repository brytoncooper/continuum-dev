import { createContext } from 'react';
import type { NodeValue } from '@continuum-dev/core';

export interface NodeStateScope {
  subscribeNode: (nodeId: string, listener: () => void) => () => void;
  getNodeValue: (nodeId: string) => NodeValue | undefined;
  setNodeValue: (nodeId: string, value: NodeValue) => void;
}

/**
 * Internal scope context used by collection item renderers to map local node ids
 * onto collection-backed values.
 */
export const NodeStateScopeContext = createContext<NodeStateScope | null>(null);
