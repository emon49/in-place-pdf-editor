// Generates the committed test fixtures in tests/fixtures (see tests/fixtures/README.md).
// Requires qpdf (https://qpdf.sourceforge.io) on PATH. All content is fictional.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { encodePng } from './png.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');
mkdirSync(dir, { recursive: true });
const out = (name) => join(dir, name);

const doc = await PDFDocument.create({ updateMetadata: false });
const page = doc.addPage([612, 792]);
const font = await doc.embedFont(StandardFonts.Helvetica);
page.drawText('Fixture document for automated tests.', { x: 72, y: 700, size: 14, font });
page.drawText('Example Co., 1 Placeholder Street, Sampletown.', { x: 72, y: 676, size: 11, font });
const valid = await doc.save({ useObjectStreams: false });
writeFileSync(out('valid.pdf'), valid);

// Truncated: keeps the %PDF- header but loses the body, xref and trailer.
writeFileSync(out('truncated.pdf'), valid.slice(0, 120));

// A PNG renamed to .pdf.
writeFileSync(out('image-renamed.pdf'), encodePng(8, 8, () => [37, 99, 235, 255]));

const qpdf = (...args) => execFileSync('qpdf', args, { stdio: 'inherit' });
qpdf('--encrypt', 'user-pass', 'owner-pass', '256', '--', out('valid.pdf'), out('encrypted-user-aes256.pdf'));
qpdf('--allow-weak-crypto', '--encrypt', 'user-pass', 'owner-pass', '128', '--use-aes=n', '--', out('valid.pdf'), out('encrypted-user-rc4.pdf'));
qpdf('--encrypt', '', 'owner-pass', '256', '--', out('valid.pdf'), out('encrypted-owner-only.pdf'));
console.log(`Fixtures written to ${dir}`);
