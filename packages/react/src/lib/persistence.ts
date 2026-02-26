import { useEffect } from 'react';
import type { Session } from '@continuum/session';

export function usePersistence(
  session: Session,
  storage: Storage | null,
  key: string
): void {
  useEffect(() => {
    if (!storage) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = session.onSnapshot(() => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        try {
          storage.setItem(key, JSON.stringify(session.serialize()));
        } catch {
        }
      }, 200);
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      unsubscribe();
    };
  }, [session, storage, key]);
}
