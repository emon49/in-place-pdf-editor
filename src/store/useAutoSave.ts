import { useEffect, useRef, useState } from 'react';
import { documentRegistry } from './useEditor';
import { clearSession, loadSession, saveSession } from '../lib/session-store';
import type { EditOperation } from '../types/operations';

export { clearSession, loadSession };

const DEBOUNCE_MS = 1000;

export type AutoSaveStatus = 'idle' | 'saved' | 'quota-exceeded';

interface AutoSaveState {
  documentId: string | null;
  bytesSaved: boolean;
}

/**
 * Debounced autosave hook (ST-6, D8).
 * Watches ops/cursor changes; flushes on beforeunload.
 * Returns status: 'saved' after a successful write, 'quota-exceeded' on failure.
 */
export function useAutoSave(
  documentId: string | null,
  fileName: string | null,
  ops: readonly EditOperation[],
  cursor: number,
): AutoSaveStatus {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AutoSaveState>({ documentId: null, bytesSaved: false });
  const pendingRef = useRef<(() => Promise<void>) | null>(null);
  const [status, setStatus] = useState<AutoSaveStatus>('idle');

  // Reset byte-saved flag when document changes
  useEffect(() => {
    if (documentId !== stateRef.current.documentId) {
      stateRef.current = { documentId, bytesSaved: false };
    }
  }, [documentId]);

  useEffect(() => {
    if (!documentId || !fileName) return;

    const doSave = async () => {
      const handle = documentRegistry.get(documentId);
      if (!handle) return;
      const needBytes = !stateRef.current.bytesSaved || stateRef.current.documentId !== documentId;
      const originalBytes = needBytes ? handle.originalBytes : new Uint8Array(0);
      try {
        await saveSession({
          fileName,
          originalBytes,
          ops: ops.slice(0, cursor) as EditOperation[],
          cursor,
          savedAt: Date.now(),
        });
        if (needBytes) stateRef.current = { documentId, bytesSaved: true };
        setStatus('saved');
      } catch {
        setStatus('quota-exceeded');
      }
    };

    pendingRef.current = doSave;

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void doSave();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [documentId, fileName, ops, cursor]);

  // Flush on beforeunload
  useEffect(() => {
    const onBeforeUnload = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void pendingRef.current?.();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return status;
}
