import { SAMPLE_CATALOG, type SampleId, type SampleInfo } from './sample-catalog';
import { buildAcademicPaper } from './samples/academic-paper';
import { buildInvoice } from './samples/invoice';
import { buildTechSpec } from './samples/tech-spec';

export type { SampleId } from './sample-catalog';

export interface SampleDocument extends SampleInfo {
  readonly build: () => Promise<Uint8Array>;
}

const BUILDERS: Readonly<Record<SampleId, () => Promise<Uint8Array>>> = {
  'academic-paper': buildAcademicPaper,
  invoice: buildInvoice,
  'tech-spec': buildTechSpec,
};

/** Built-in samples, generated on the user's device with pdf-lib (UP-2). Import this module lazily. */
export const SAMPLES: readonly SampleDocument[] = SAMPLE_CATALOG.map((info) => ({ ...info, build: BUILDERS[info.id] }));

export function getSample(id: SampleId): SampleDocument {
  const sample = SAMPLES.find((s) => s.id === id);
  if (!sample) throw new Error(`Unknown sample: ${id}`);
  return sample;
}
