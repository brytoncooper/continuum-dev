import type { ViewNode, NodeValue } from '@continuum/contract';
import type { SessionOptions } from '@continuum/session';
import type { ComponentType } from 'react';

export interface ContinuumNodeProps<T = NodeValue> {
  value: T | undefined;
  onChange: (value: T) => void;
  definition: ViewNode;
  children?: React.ReactNode;
  [prop: string]: unknown;
}

export type ContinuumNodeMap = Record<
  string,
  ComponentType<ContinuumNodeProps<any>>
>;

export type ContinuumComponentProps<T = NodeValue> = ContinuumNodeProps<T>;
export type ContinuumComponentMap = ContinuumNodeMap;

export interface ContinuumProviderProps {
  components: ContinuumNodeMap;
  persist?: 'sessionStorage' | 'localStorage' | false;
  storageKey?: string;
  sessionOptions?: SessionOptions;
  children: React.ReactNode;
}
