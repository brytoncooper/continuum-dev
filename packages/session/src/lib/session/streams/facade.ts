import type { Session } from '../../types.js';
import type { SessionState } from '../state/index.js';
import { beginStream, applyStreamPart, commitStream, abortStream, getPublicStreams } from './index.js';

function assertNotDestroyed(internal: SessionState): void {
  if (internal.destroyed) {
    throw new Error('Session has been destroyed');
  }
}

export function createStreamsFacade(internal: SessionState): Pick<Session, 'beginStream' | 'applyStreamPart' | 'commitStream' | 'abortStream' | 'getStreams'> {
  return {
    beginStream(options: Parameters<Session['beginStream']>[0]) {
      assertNotDestroyed(internal);
      return beginStream(internal, options);
    },
    applyStreamPart(streamId: string, part: Parameters<Session['applyStreamPart']>[1]) {
      assertNotDestroyed(internal);
      applyStreamPart(internal, streamId, part);
    },
    commitStream(streamId: string) {
      assertNotDestroyed(internal);
      return commitStream(internal, streamId);
    },
    abortStream(streamId: string, reason?: string) {
      assertNotDestroyed(internal);
      return abortStream(internal, streamId, reason);
    },
    getStreams() {
      assertNotDestroyed(internal);
      return getPublicStreams(internal);
    }
  };
}
