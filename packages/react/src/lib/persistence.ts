import { useEffect } from 'react';
import type { Session } from '@continuum/session';

export function usePersistence(
  session: Session,
  storage: Storage | null,
  key: string
): void {
  useEffect(() => {
    if (!storage) return;

    const unsubscribe = session.onSnapshot(() => {
      try {
        storage.setItem(key, JSON.stringify(session.serialize()));
      } catch {
        // storage full or unavailable -- silently skip
      }
    });

    return unsubscribe;
  }, [session, storage, key]);
}
