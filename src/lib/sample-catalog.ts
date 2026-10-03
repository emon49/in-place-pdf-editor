/** Sample ids and titles; safe to import eagerly (the builders in sample-documents.ts are lazy-loaded). */
export type SampleId = 'academic-paper' | 'invoice' | 'tech-spec';

export interface SampleInfo {
  readonly id: SampleId;
  readonly title: string;
  readonly fileName: string;
}

export const SAMPLE_CATALOG: readonly SampleInfo[] = [
  { id: 'academic-paper', title: 'Academic Research Paper', fileName: 'academic-research-paper.pdf' },
  { id: 'invoice', title: 'Invoice', fileName: 'invoice.pdf' },
  { id: 'tech-spec', title: 'Technical Spec', fileName: 'technical-spec.pdf' },
];
