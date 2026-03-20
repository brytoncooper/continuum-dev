export { applyPatchPlanToView } from './apply.js';
export { buildPatchContext } from './context.js';
export { buildDetachedFieldHints } from './detached-fields.js';
export {
  buildPatchSystemPrompt,
  buildPatchUserMessage,
  VIEW_PATCH_OUTPUT_CONTRACT,
} from './prompt.js';
export {
  isViewPatchPlan,
  normalizeViewPatchOperation,
  normalizeViewPatchPlan,
} from './normalize.js';
export type {
  CompactPatchNode,
  PatchContextPayload,
  PatchNodeHint,
  ViewPatchOperation,
  ViewPatchPlan,
} from './types.js';
