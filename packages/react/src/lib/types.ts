import type { ComponentDefinition, ComponentState } from '@continuum/contract';
import type { SessionOptions } from '@continuum/session';
import type { ComponentType } from 'react';

export interface ContinuumComponentProps<T = ComponentState> {
  value: T | undefined;
  onChange: (value: T) => void;
  definition: ComponentDefinition;
  children?: React.ReactNode;
  [prop: string]: unknown;
}

export type ContinuumComponentMap = Record<
  string,
  ComponentType<ContinuumComponentProps<any>>
>;

export interface ContinuumProviderProps {
  components: ContinuumComponentMap;
  persist?: 'sessionStorage' | 'localStorage' | false;
  storageKey?: string;
  sessionOptions?: SessionOptions;
  children: React.ReactNode;
}
