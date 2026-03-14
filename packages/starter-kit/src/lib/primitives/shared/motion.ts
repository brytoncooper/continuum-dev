import type { CSSProperties } from 'react';
import { nodeDepth } from './node.js';

function hashNodeId(nodeId?: string): number {
  const source = nodeId ?? 'continuum';
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 997;
  }

  return hash;
}

export function streamedNodeMotionStyle(
  nodeId?: string,
  phase: 'shell' | 'content' = 'shell'
): CSSProperties {
  const depth = nodeDepth(nodeId);
  const hash = hashNodeId(nodeId);
  const laneOffset = hash % 6;
  const baseDelay = Math.min(240, depth * 28 + laneOffset * 16);
  const delay = phase === 'shell' ? baseDelay : baseDelay + 90;
  const duration = phase === 'shell' ? 560 : 760;

  return {
    '--continuum-enter-delay': `${delay}ms`,
    '--continuum-enter-duration': `${duration}ms`,
  } as CSSProperties;
}
