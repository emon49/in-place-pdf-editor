// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearSession, loadSession, saveSession, type SessionData } from '../../src/lib/session-store';
import type { EditOperation } from '../../src/types/operations';

const testOps: EditOperation[] = [
  { id: 'op-1', ts: 1000, pageIndex: 0, type: 'TEXT_REPLACE', objectId: '0:1', newText: 'Hello' },
];

const testSession: SessionData = {
  fileName: 'test.pdf',
  originalBytes: new Uint8Array([1, 2, 3, 4]),
  ops: testOps,
  cursor: 1,
  savedAt: Date.now(),
};

beforeEach(async () => {
  await clearSession().catch(() => {});
});
afterEach(async () => {
  await clearSession().catch(() => {});
});

describe('session-store (11.1)', () => {
  it('loadSession returns null when nothing saved', async () => {
    const result = await loadSession();
    expect(result).toBeNull();
  });

  it('save then load round-trips all fields', async () => {
    await saveSession(testSession);
    const loaded = await loadSession();
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    expect(loaded.fileName).toBe('test.pdf');
    expect(loaded.cursor).toBe(1);
    expect(loaded.ops).toHaveLength(1);
    expect(loaded.ops[0]?.type).toBe('TEXT_REPLACE');
    expect(Array.from(loaded.originalBytes)).toEqual([1, 2, 3, 4]);
  });

  it('clearSession removes saved data', async () => {
    await saveSession(testSession);
    await clearSession();
    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });

  it('save overwrites previous session', async () => {
    await saveSession(testSession);
    const updated: SessionData = { ...testSession, cursor: 5, ops: [], fileName: 'new.pdf' };
    await saveSession(updated);
    const loaded = await loadSession();
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    expect(loaded.fileName).toBe('new.pdf');
    expect(loaded.cursor).toBe(5);
    expect(loaded.ops).toHaveLength(0);
  });
});
