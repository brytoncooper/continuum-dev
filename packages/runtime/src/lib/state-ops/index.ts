export {
  collectCanonicalNodeIds,
  collectNodesByCanonicalId,
  resolveNodeLookupEntry,
} from './node-lookup.js';
export {
  applyContinuumNodeValueUpdate,
  applyContinuumViewportStateUpdate,
  classifyContinuumValueIngress,
} from './direct-updates.js';
export { applyContinuumViewStreamPart } from './stream-parts.js';
export { applyContinuumViewUpdate, assertValidView } from './view-updates.js';
export type { ContinuumViewPatchPosition } from '../view-patch/index.js';
export type {
  AppliedContinuumViewState,
  ApplyContinuumNodeValueInput,
  ApplyContinuumNodeValueResult,
  ApplyContinuumViewStreamPartInput,
  ApplyContinuumViewStreamPartResult,
  ApplyContinuumViewUpdateInput,
  ApplyContinuumViewportStateInput,
  ApplyContinuumViewportStateResult,
  ClassifyContinuumValueIngressInput,
  ContinuumValueIngressDecision,
  ContinuumViewStreamPart,
  RuntimeNodeLookupEntry,
} from './types.js';
