import type { ViewDefinition } from '@continuum-dev/contract';
import type { DetachedRestoreScope } from '../../types.js';
import type { SessionState } from '../state/index.js';
import type { InternalSessionStreamState } from '../streams/types.js';

export function scopeKey(scope: DetachedRestoreScope): string {
  if (scope.kind === 'live') {
    return 'live';
  }
  return `draft:${scope.streamId}`;
}

export interface ScopeSnapshot {
  scope: DetachedRestoreScope;
  view: ViewDefinition;
  data: SessionState['currentData'];
  stream?: InternalSessionStreamState;
}

export function getScopeSnapshot(
  internal: SessionState,
  scope: DetachedRestoreScope
): ScopeSnapshot | null {
  if (scope.kind === 'live') {
    if (!internal.currentView || !internal.currentData) {
      return null;
    }
    return {
      scope,
      view: internal.currentView,
      data: internal.currentData,
    };
  }

  const stream = internal.streams.get(scope.streamId);
  if (
    !stream ||
    stream.status !== 'open' ||
    stream.mode !== 'draft' ||
    !stream.workingView ||
    !stream.workingData
  ) {
    return null;
  }

  return {
    scope,
    view: stream.workingView,
    data: stream.workingData,
    stream,
  };
}

export function collectScopeSnapshots(internal: SessionState): ScopeSnapshot[] {
  const snapshots: ScopeSnapshot[] = [];
  const live = getScopeSnapshot(internal, { kind: 'live' });
  if (live) {
    snapshots.push(live);
  }

  for (const stream of internal.streams.values()) {
    if (
      stream.status === 'open' &&
      stream.mode === 'draft' &&
      stream.workingView &&
      stream.workingData
    ) {
      snapshots.push({
        scope: { kind: 'draft', streamId: stream.streamId },
        view: stream.workingView,
        data: stream.workingData,
        stream,
      });
    }
  }

  return snapshots;
}

export function scopeViewVersion(scopeSnapshot: ScopeSnapshot): string | null {
  return scopeSnapshot.view.version ?? null;
}
