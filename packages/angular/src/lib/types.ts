import type { ViewNode, NodeValue } from '@continuum/contract';
import type { SessionOptions } from '@continuum/session';
import type { Type } from '@angular/core';

export interface ContinuumNodeProps<T = NodeValue> {
  value: T | undefined;
  onChange: (value: T) => void;
  definition: ViewNode;
  children?: unknown;
  [prop: string]: unknown;
}

export type ContinuumNodeMap = Record<
  string,
  Type<ContinuumNodeProps<unknown>>
>;

export interface ContinuumPersistError {
  reason: 'size_limit' | 'storage_error';
  key: string;
  attemptedBytes?: number;
  maxBytes?: number;
  cause?: unknown;
}

export interface ContinuumProviderOptions {
  components: ContinuumNodeMap;
  persist?: 'sessionStorage' | 'localStorage' | false;
  storageKey?: string;
  maxPersistBytes?: number;
  onPersistError?: (error: ContinuumPersistError) => void;
  sessionOptions?: SessionOptions;
}
