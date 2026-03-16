import type { NodeValue } from '@continuum-dev/contract';

/**
 * Models an AI-suggested value alongside the current user value.
 * Used by conflict-resolution and diff-based approval flows.
 */
export interface ProposedValue {
  /**
   * Target node id.
   */
  nodeId: string;
  /**
   * Proposed replacement value.
   */
  proposedValue: NodeValue;
  /**
   * Current active value.
   */
  currentValue: NodeValue;
  /**
   * Proposal timestamp.
   */
  proposedAt: number;
  /**
   * Optional proposal source identifier.
   */
  source?: string;
}
