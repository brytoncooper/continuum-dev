import type { ContinuumExecutionMode } from './planner-types.js';

export function getAvailableContinuumExecutionModes(args: {
  hasCurrentView?: boolean;
  hasStateTargets?: boolean;
} = {}): ContinuumExecutionMode[] {
  const availableModes: ContinuumExecutionMode[] = [];

  if (args.hasStateTargets) {
    availableModes.push('state');
  }

  if (args.hasCurrentView) {
    availableModes.push('patch');
    availableModes.push('transform');
  }

  availableModes.push('view');
  return availableModes;
}
