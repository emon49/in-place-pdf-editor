// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, saveSession } from '../../src/lib/session-store';
import type { EditOperation } from '../../src/types/operations';

// Minimal integration test for the restore-session prompt (11.3)

// Mock the editor store so we don't need a real PDF engine
vi.mock('../../src/store/useEditor', async () => {
  const { create } = await import('zustand');
  const store = create(() => ({
    document: null,
    view: { pageIndex: 0, zoom: 1, fitMode: 'width' },
    loading: false,
    error: null,
    notice: null,
    addTextMode: false,
    cursor: 0,
    ops: [] as EditOperation[],
    selection: null,
    pageModels: {},
    openFiles: vi.fn(),
    openBytes: vi.fn().mockResolvedValue(undefined),
    goToPage: vi.fn(),
    nextPage: vi.fn(),
    prevPage: vi.fn(),
    firstPage: vi.fn(),
    lastPage: vi.fn(),
    setZoom: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    setFitMode: vi.fn(),
    applyFitZoom: vi.fn(),
    setError: vi.fn(),
    dismissNotice: vi.fn(),
    ensurePageModel: vi.fn(),
    touchPageModel: vi.fn(),
    selectObject: vi.fn(),
    stepSelection: vi.fn(),
    pushOperation: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    previewLines: vi.fn().mockReturnValue([]),
    setAddTextMode: vi.fn(),
  }));
  return {
    editorStore: { getState: () => store.getState(), setState: store.setState, subscribe: store.subscribe },
    useEditor: store,
    documentRegistry: { get: vi.fn(), register: vi.fn(), release: vi.fn() },
    openSample: vi.fn(),
  };
});

vi.mock('../../src/store/usePageModel', () => ({
  usePageModel: vi.fn().mockReturnValue({ status: 'idle', model: null }),
  usePageSampling: vi.fn(),
}));

vi.mock('../../src/lib/sample-catalog', () => ({
  SAMPLE_CATALOG: [],
}));

const op1: EditOperation = { id: 'op-1', ts: 1000, pageIndex: 0, type: 'TEXT_REPLACE', objectId: '0:1', newText: 'Hi' };

async function renderApp() {
  const { App } = await import('../../src/App');
  return render(<App />);
}

beforeEach(async () => {
  vi.resetModules();
  await clearSession().catch(() => {});
});

afterEach(async () => {
  cleanup();
  await clearSession().catch(() => {});
});

describe('restore prompt (11.3)', () => {
  it('shows restore prompt when a session exists on mount', async () => {
    await saveSession({
      fileName: 'prev.pdf',
      originalBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      ops: [op1],
      cursor: 1,
      savedAt: Date.now(),
    });

    await renderApp();

    await waitFor(() => {
      expect(screen.getByTestId('restore-prompt')).toBeTruthy();
    });
    expect(screen.getByText(/prev\.pdf/)).toBeTruthy();
    expect(screen.getByTestId('restore-button')).toBeTruthy();
    expect(screen.getByTestId('discard-button')).toBeTruthy();
  });

  it('discard clears session and hides prompt', async () => {
    await saveSession({
      fileName: 'prev.pdf',
      originalBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      ops: [op1],
      cursor: 1,
      savedAt: Date.now(),
    });

    await renderApp();

    await waitFor(() => {
      expect(screen.getByTestId('restore-prompt')).toBeTruthy();
    });

    await userEvent.click(screen.getByTestId('discard-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('restore-prompt')).toBeNull();
    });

    const { loadSession } = await import('../../src/lib/session-store');
    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });

  it('does not show restore prompt when no session exists', async () => {
    await renderApp();
    // Give the effect time to run
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('restore-prompt')).toBeNull();
  });
});
