import type { Session } from '../../types.js';
import type { SessionState } from '../state/index.js';
import { subscribeSnapshot, subscribeStreams, subscribeIssues } from './index.js';

function assertNotDestroyed(internal: SessionState): void {
  if (internal.destroyed) {
    throw new Error('Session has been destroyed');
  }
}

export function createListenersFacade(internal: SessionState): Pick<Session, 'getIssues' | 'getDiffs' | 'getResolutions' | 'onSnapshot' | 'onStreams' | 'onIssues'> {
  return {
    getIssues() {
      assertNotDestroyed(internal);
      return [
        ...(internal.activeForegroundStreamId &&
        internal.streams.get(internal.activeForegroundStreamId)?.status === 'open'
          ? internal.streams.get(internal.activeForegroundStreamId)?.issues ?? []
          : internal.issues),
      ];
    },
    getDiffs() {
      assertNotDestroyed(internal);
      return [
        ...(internal.activeForegroundStreamId &&
        internal.streams.get(internal.activeForegroundStreamId)?.status === 'open'
          ? internal.streams.get(internal.activeForegroundStreamId)?.diffs ?? []
          : internal.diffs),
      ];
    },
    getResolutions() {
      assertNotDestroyed(internal);
      return [
        ...(internal.activeForegroundStreamId &&
        internal.streams.get(internal.activeForegroundStreamId)?.status === 'open'
          ? internal.streams.get(internal.activeForegroundStreamId)?.resolutions ?? []
          : internal.resolutions),
      ];
    },
    onSnapshot(listener: Parameters<Session['onSnapshot']>[0]) {
      assertNotDestroyed(internal);
      return subscribeSnapshot(internal, listener);
    },
    onStreams(listener: Parameters<Session['onStreams']>[0]) {
      assertNotDestroyed(internal);
      return subscribeStreams(internal, listener);
    },
    onIssues(listener: Parameters<Session['onIssues']>[0]) {
      assertNotDestroyed(internal);
      return subscribeIssues(internal, listener);
    }
  };
}
