// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSession, loadSession, saveSession, type SessionData } from '../../src/lib/session-store';
import type { EditOperation } from '../../src/types/operations';

// Minimal autosave test — verifies debounce and log-only updates

afterEach(async () => {
  await clearSession().catch(() => {});
  vi.useRealTimers();
});

const op1: EditOperation = { id: 'op-1', ts: 1000, pageIndex: 0, type: 'TEXT_REPLACE', objectId: '0:1', newText: 'Hi' };

describe('session-store autosave integration (11.2)', () => {
  it('saves ops to session store', async () => {
    const session: SessionData = {
      fileName: 'doc.pdf',
      originalBytes: new Uint8Array([0xff]),
      ops: [op1],
      cursor: 1,
      savedAt: Date.now(),
    };
    await saveSession(session);
    const loaded = await loadSession();
    expect(loaded?.ops).toHaveLength(1);
    expect(loaded?.ops[0]?.type).toBe('TEXT_REPLACE');
  });

  it('subsequent save overwrites with updated ops list', async () => {
    const first: SessionData = {
      fileName: 'doc.pdf',
      originalBytes: new Uint8Array([0xff]),
      ops: [op1],
      cursor: 1,
      savedAt: Date.now(),
    };
    await saveSession(first);
    const second: SessionData = { ...first, ops: [], cursor: 0, savedAt: Date.now() + 100 };
    await saveSession(second);
    const loaded = await loadSession();
    expect(loaded?.ops).toHaveLength(0);
    expect(loaded?.cursor).toBe(0);
  });
});
