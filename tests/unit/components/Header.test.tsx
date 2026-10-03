// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header, type HeaderProps } from '../../../src/components/Header';

afterEach(cleanup);

function renderHeader(overrides: Partial<HeaderProps> = {}) {
  const props: HeaderProps = {
    documentName: 'doc.pdf',
    pageIndex: 0,
    pageCount: 8,
    zoom: 1,
    fitMode: null,
    onOpenFiles: vi.fn(),
    onLoadSample: vi.fn(),
    onGoToPage: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onActualSize: vi.fn(),
    onFit: vi.fn(),
    addTextMode: false,
    onToggleAddText: vi.fn(),
    editCount: 0,
    ...overrides,
  };
  render(<Header {...props} />);
  return props;
}

const button = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('Header (5.4)', () => {
  it('icon buttons have accessible labels', () => {
    renderHeader();
    for (const name of ['Previous page', 'Next page', 'Zoom in', 'Zoom out', 'Fit to width', 'Fit to page']) {
      expect(button(name)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Open PDF' })).toBeTruthy();
    expect(screen.getByLabelText('Load sample')).toBeTruthy();
    expect(screen.getByLabelText('Page number')).toBeTruthy();
  });

  it('disables previous on the first page and next on the last page', () => {
    renderHeader({ pageIndex: 0 });
    expect(button('Previous page').disabled).toBe(true);
    expect(button('Next page').disabled).toBe(false);
    cleanup();
    renderHeader({ pageIndex: 7 });
    expect(button('Next page').disabled).toBe(true);
  });

  it('disables zoom in at 400% and zoom out at 25%', () => {
    renderHeader({ zoom: 4 });
    expect(button('Zoom in').disabled).toBe(true);
    cleanup();
    renderHeader({ zoom: 0.25 });
    expect(button('Zoom out').disabled).toBe(true);
  });

  it('page input jumps on Enter and reverts invalid numbers', () => {
    const props = renderHeader();
    const input = screen.getByLabelText('Page number') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onGoToPage).toHaveBeenCalledWith(4);
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onGoToPage).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('1');
  });

  it('marks the active fit mode as pressed', () => {
    renderHeader({ fitMode: 'width' });
    expect(button('Fit to width').getAttribute('aria-pressed')).toBe('true');
    expect(button('Fit to page').getAttribute('aria-pressed')).toBe('false');
  });

  it('hides navigation until a document is open', () => {
    renderHeader({ documentName: null });
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });
});
