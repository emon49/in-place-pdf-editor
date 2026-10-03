// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = { needRefresh: false };
const setNeedRefresh = vi.fn((v: boolean) => (state.needRefresh = v));
const updateServiceWorker = vi.fn(async () => undefined);

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [state.needRefresh, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

const { UpdatePrompt } = await import('../../../src/components/UpdatePrompt');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('UpdatePrompt (6.3)', () => {
  it('shows nothing until a new version is waiting', () => {
    state.needRefresh = false;
    render(<UpdatePrompt />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('appears on needRefresh as a non-blocking status and reloads only on click', () => {
    state.needRefresh = true;
    render(<UpdatePrompt />);
    expect(screen.getByRole('status').textContent).toContain('A new version of the editor is available.');
    expect(updateServiceWorker).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload to update' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('can be dismissed without reloading', () => {
    state.needRefresh = true;
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });
});
