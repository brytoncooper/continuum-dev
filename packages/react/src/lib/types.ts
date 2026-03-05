import type { ViewNode, NodeValue } from '@continuum/contract';
import type { SessionOptions } from '@continuum/session';
import type { ComponentType } from 'react';

export interface ContinuumNodeProps<T = NodeValue> {
  value: T | undefined;
  onChange: (value: T) => void;
  definition: ViewNode;
  nodeId?: string;
  children?: React.ReactNode;
  [prop: string]: unknown;
}

export type ContinuumNodeMap = Record<
  string,
  ComponentType<ContinuumNodeProps<any>>
>;

export type ContinuumComponentProps<T = NodeValue> = ContinuumNodeProps<T>;
export type ContinuumComponentMap = ContinuumNodeMap;

export interface ContinuumPersistError {
  reason: 'size_limit' | 'storage_error';
  key: string;
  attemptedBytes?: number;
  maxBytes?: number;
  cause?: unknown;
}

export interface ContinuumProviderProps {
  components: ContinuumNodeMap;
  persist?: 'sessionStorage' | 'localStorage' | false;
  storageKey?: string;
  maxPersistBytes?: number;
  onPersistError?: (error: ContinuumPersistError) => void;
  sessionOptions?: SessionOptions;
  children: React.ReactNode;
}
