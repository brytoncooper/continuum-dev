import type { NodeValue, SessionOptions, ViewNode } from '@continuum-dev/core';
import type { ComponentType } from 'react';

/**
 * Props passed to node renderer components in the Continuum map.
 *
 * @template T Node value shape consumed by the component.
 */
export interface ContinuumNodeProps<T = NodeValue> {
  /** Current node value from session state. */
  value: T | undefined;
  /** Writes a new node value into session state. */
  onChange: (value: T) => void;
  /** Raw node definition from the active view. */
  definition: ViewNode;
  /** Canonical node id, including parent path for nested nodes. */
  nodeId?: string;
  /** Rendered children for container-like nodes. */
  children?: React.ReactNode;
  /** Additional mapped props provided by renderers/integrations. */
  [prop: string]: unknown;
}

/**
 * Component registry keyed by Continuum node `type`.
 */
export type ContinuumNodeMap = Record<
  string,
  ComponentType<ContinuumNodeProps<any>>
>;

/**
 * Backward-compatible alias for `ContinuumNodeProps`.
 *
 * @template T Node value shape consumed by the component.
 */
export type ContinuumComponentProps<T = NodeValue> = ContinuumNodeProps<T>;
/**
 * Backward-compatible alias for `ContinuumNodeMap`.
 */
export type ContinuumComponentMap = ContinuumNodeMap;

/**
 * Error metadata emitted when persistence fails in the provider.
 */
export interface ContinuumPersistError {
  /** Persistence failure category. */
  reason: 'size_limit' | 'storage_error';
  /** Storage key used for persistence. */
  key: string;
  /** Serialized payload size in bytes. */
  attemptedBytes?: number;
  /** Configured max byte limit for persistence. */
  maxBytes?: number;
  /** Original error/cause when available. */
  cause?: unknown;
}

/**
 * Props for `ContinuumProvider`.
 */
export interface ContinuumProviderProps {
  /** Node type to component map used by `ContinuumRenderer`. */
  components: ContinuumNodeMap;
  /** Optional browser persistence mode. */
  persist?: 'sessionStorage' | 'localStorage' | false;
  /** Storage key for persisted session data. */
  storageKey?: string;
  /** Maximum serialized bytes allowed for persisted payloads. */
  maxPersistBytes?: number;
  /** Callback invoked when persistence errors occur. */
  onPersistError?: (error: ContinuumPersistError) => void;
  /** Options forwarded to `@continuum-dev/core`. */
  sessionOptions?: SessionOptions;
  /** React subtree that consumes Continuum context. */
  children: React.ReactNode;
}
