import { useStore } from 'zustand';
import { createDocumentRegistry } from '../lib/document-registry';
import { openPdf } from '../lib/pdfjs';
import type { SampleId } from '../lib/sample-catalog';
import { createEditorStore, type EditorActions, type EditorState } from './editorStore';

/** The app's single store instance and document registry. */
export const documentRegistry = createDocumentRegistry();
export const editorStore = createEditorStore({ registry: documentRegistry, open: openPdf });

export function useEditor<T>(selector: (state: EditorState & EditorActions) => T): T {
  return useStore(editorStore, selector);
}

/** Generates a sample on the device (lazy-loaded so pdf-lib stays out of the initial bundle) and opens it. */
export async function openSample(id: SampleId): Promise<void> {
  const { getSample } = await import('../lib/sample-documents');
  const sample = getSample(id);
  const bytes = await sample.build();
  await editorStore.getState().openBytes({ name: sample.fileName, type: 'application/pdf' }, bytes);
}
