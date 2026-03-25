export { createStreamContinuumExecutionEnv } from './lib/execution/stream/stream-execution-types.js';
export type {
  SelectedExecutionPlan,
  StreamContinuumExecutionEnv,
} from './lib/execution/stream/stream-execution-types.js';
export { runPatchPhase } from './lib/execution/stream/phases/patch-phase.js';
export { runStatePhase } from './lib/execution/stream/phases/state-phase.js';
export { runTransformPhase } from './lib/execution/stream/phases/transform-phase.js';
export { runViewPhase } from './lib/execution/stream/phases/view-phase.js';
export { normalizeError } from './lib/execution/stream/trace/normalize-error.js';
export { runGenerate } from './lib/execution/stream/trace/trace.js';
