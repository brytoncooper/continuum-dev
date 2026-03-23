import { buildDetachedFieldHints } from '../../view-patching/index.js';
import type { ContinuumSessionAdapter } from '../../session/index.js';
import type { ContinuumExecutionContext } from '../types.js';

export function buildContinuumExecutionContext(
  session: ContinuumSessionAdapter
): ContinuumExecutionContext {
  const snapshot = session.getSnapshot();

  return {
    currentView: snapshot?.view,
    currentData: snapshot?.data.values,
    detachedFields: buildDetachedFieldHints(session.getDetachedValues()),
    issues: session.getIssues(),
  };
}
