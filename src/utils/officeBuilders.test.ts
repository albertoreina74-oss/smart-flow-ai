import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import JSZip from 'jszip';
import { buildDocxBytes } from './docxBuilder.ts';
import { buildXlsxBytes } from './xlsxBuilder.ts';

// A .docx/.xlsx that Word or Excel refuses to open fails on the user's device,
// long after the export "succeeded". These checks open the produced bytes as a
// zip and assert the parts an Office reader actually requires are present, and
// that the content really made it in.

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

async function openAsZip(bytes: Uint8Array): Promise<JSZip> {
  assert.deepEqual(
    Array.from(bytes.slice(0, 4)),
    ZIP_MAGIC,
    'output is not a zip archive',
  );
  return JSZip.loadAsync(bytes);
}

describe('buildDocxBytes', () => {
  it('produces a zip with the parts Word requires', async () => {
    const zip = await openAsZip(await buildDocxBytes('Ciao mondo'));
    for (const part of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
      assert.ok(zip.file(part), `missing required part: ${part}`);
    }
  });

  it('carries the text through, escaping XML metacharacters', async () => {
    const zip = await openAsZip(await buildDocxBytes('Costi & ricavi <2026> "totali"'));
    const document = await zip.file('word/document.xml')!.async('string');
    assert.ok(document.includes('Costi &amp; ricavi'), 'ampersand not escaped');
    assert.ok(document.includes('&lt;2026&gt;'), 'angle brackets not escaped');
    // A raw `&` or a stray `<` would make the part unparseable for Word.
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(document), 'unescaped ampersand present');
  });

  it('keeps paragraphs separate', async () => {
    const zip = await openAsZip(await buildDocxBytes('Prima\nSeconda\nTerza'));
    const document = await zip.file('word/document.xml')!.async('string');
    const paragraphs = document.match(/<w:p[ >]/g) ?? [];
    assert.ok(paragraphs.length >= 3, `expected at least 3 paragraphs, got ${paragraphs.length}`);
  });

  it('handles empty text without throwing', async () => {
    await openAsZip(await buildDocxBytes(''));
  });
});

describe('buildXlsxBytes', () => {
  const ROWS = [
    ['Data', 'Esercente', 'Importo'],
    ['03/03/2026', 'Bar Centrale', '1.20'],
  ];

  it('produces a zip with the parts Excel requires', async () => {
    const zip = await openAsZip(await buildXlsxBytes(ROWS));
    for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']) {
      assert.ok(zip.file(part), `missing required part: ${part}`);
    }
  });

  it('writes every cell of every row', async () => {
    const zip = await openAsZip(await buildXlsxBytes(ROWS));
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    for (const value of ROWS.flat()) {
      assert.ok(sheet.includes(value), `missing cell value: ${value}`);
    }
    const rowCount = (sheet.match(/<row[ >]/g) ?? []).length;
    assert.equal(rowCount, ROWS.length);
  });

  it('escapes XML metacharacters in cells', async () => {
    const zip = await openAsZip(await buildXlsxBytes([['Ferramenta & Co', 'a<b']]));
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    assert.ok(sheet.includes('Ferramenta &amp; Co'));
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(sheet), 'unescaped ampersand present');
  });

  it('handles an empty sheet without throwing', async () => {
    await openAsZip(await buildXlsxBytes([]));
  });
});
