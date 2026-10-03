// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useStore } from 'zustand';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Banner } from '../../../src/components/Banner';
import { PDFUploader } from '../../../src/components/PDFUploader';
import { createDocumentRegistry } from '../../../src/lib/document-registry';
import { LOAD_ERROR_MESSAGES } from '../../../src/lib/load-errors';
import { createEditorStore } from '../../../src/store/editorStore';

afterEach(cleanup);

const dataTransfer = (files: File[]) => ({ types: ['Files'], files, dropEffect: 'none' });
const pdf = (name: string) => new File(['%PDF-1.7'], name, { type: 'application/pdf' });

describe('PDFUploader (5.6)', () => {
  it('shows a drop highlight while files are dragged over and hides it on leave', () => {
    render(<PDFUploader hasDocument={false} onFiles={vi.fn()} onOpenClick={vi.fn()} onLoadSample={vi.fn()} />);
    const target = screen.getByTestId('drop-target');
    fireEvent.dragEnter(target, { dataTransfer: dataTransfer([]) });
    expect(screen.getByTestId('drop-highlight')).toBeTruthy();
    fireEvent.dragLeave(target, { dataTransfer: dataTransfer([]) });
    expect(screen.queryByTestId('drop-highlight')).toBeNull();
  });

  it('dropping two files shows "Drop one PDF at a time" and opens nothing', async () => {
    const open = vi.fn();
    const store = createEditorStore({ open, registry: createDocumentRegistry() });
    function Harness() {
      const error = useStore(store, (s) => s.error);
      return (
        <>
          {error && <Banner tone="error">{LOAD_ERROR_MESSAGES[error]}</Banner>}
          <PDFUploader
            hasDocument={false}
            onFiles={(files) => void store.getState().openFiles(files)}
            onOpenClick={vi.fn()}
            onLoadSample={vi.fn()}
          />
        </>
      );
    }
    render(<Harness />);
    fireEvent.drop(screen.getByTestId('drop-target'), { dataTransfer: dataTransfer([pdf('a.pdf'), pdf('b.pdf')]) });
    expect((await screen.findByRole('alert')).textContent).toBe('Drop one PDF at a time.');
    expect(open).not.toHaveBeenCalled();
  });

  it('empty state offers the file picker and the three samples', () => {
    const onLoadSample = vi.fn();
    const onOpenClick = vi.fn();
    render(<PDFUploader hasDocument={false} onFiles={vi.fn()} onOpenClick={onOpenClick} onLoadSample={onLoadSample} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Invoice' }));
    expect(onOpenClick).toHaveBeenCalled();
    expect(onLoadSample).toHaveBeenCalledWith('invoice');
  });
});
