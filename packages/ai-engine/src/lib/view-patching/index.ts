export { applyPatchPlanToView } from './apply/apply.js';
export { buildPatchContext } from './context/context.js';
export { buildDetachedFieldHints } from './detached-fields/detached-fields.js';
export {
  buildPatchSystemPrompt,
  buildPatchUserMessage,
  VIEW_PATCH_OUTPUT_CONTRACT,
} from './prompts/prompt.js';
export {
  isViewPatchPlan,
  normalizeViewPatchOperation,
  normalizeViewPatchPlan,
} from './normalize/normalize.js';
export type {
  CompactPatchNode,
  PatchContextPayload,
  PatchNodeHint,
  ViewPatchOperation,
  ViewPatchPlan,
} from './types.js';
