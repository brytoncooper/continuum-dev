export type {
  ContinuumViewPatch,
  ContinuumViewPatchOperation,
  ContinuumViewPatchPosition,
} from './types.js';
export { collectContinuumViewPatchAffectedNodeIds } from './affected-node-ids.js';
export { patchViewDefinition, patchViewNode } from './merge.js';
export { applyContinuumViewPatch } from './apply.js';
