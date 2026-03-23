import type {
  ContinuumExecutionFinalResult,
  ContinuumExecutionTraceEntry,
} from '../../types.js';

export function createNoopResult(args: {
  source: string;
  status: string;
  reason: string;
  requestedMode: 'state' | 'patch' | 'transform' | 'view';
  trace: ContinuumExecutionTraceEntry[];
}): ContinuumExecutionFinalResult {
  return {
    mode: 'noop',
    source: args.source,
    status: args.status,
    level: 'warning',
    trace: args.trace,
    requestedMode: args.requestedMode,
    reason: args.reason,
  };
}
