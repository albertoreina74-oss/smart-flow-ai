import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { markdownTableToCsv, markdownTableToRows, rowsToCsv } from './markdownTable.ts';

const RECEIPT_TABLE = `| Data | Nome Esercente | Voce/Descrizione | Importo | IVA |
| --- | --- | --- | --- | --- |
| 03/03/2026 | Bar Centrale | Caffè | 1.20 | 22 |
| 03/03/2026 | Bar Centrale | Cornetto | 1.50 | 10 |`;

describe('markdownTableToRows', () => {
  it('parses a receipt table, dropping the separator row', () => {
    assert.deepEqual(markdownTableToRows(RECEIPT_TABLE), [
      ['Data', 'Nome Esercente', 'Voce/Descrizione', 'Importo', 'IVA'],
      ['03/03/2026', 'Bar Centrale', 'Caffè', '1.20', '22'],
      ['03/03/2026', 'Bar Centrale', 'Cornetto', '1.50', '10'],
    ]);
  });

  it('keeps every row the same width as the header', () => {
    const rows = markdownTableToRows(RECEIPT_TABLE);
    const width = rows[0].length;
    for (const row of rows) {
      assert.equal(row.length, width);
    }
  });

  it('handles alignment markers in the separator row', () => {
    const table = `| A | B |\n|:---|---:|\n| 1 | 2 |`;
    assert.deepEqual(markdownTableToRows(table), [
      ['A', 'B'],
      ['1', '2'],
    ]);
  });

  it('falls back to one column per line when there is no table', () => {
    // The user may have edited the result into prose; the export should still
    // produce something usable rather than an empty file.
    assert.deepEqual(markdownTableToRows('Prima riga\n\nSeconda riga'), [
      ['Prima riga'],
      ['Seconda riga'],
    ]);
  });

  it('never returns an empty row set for non-empty input', () => {
    assert.ok(markdownTableToRows('qualsiasi cosa').length > 0);
  });
});

describe('rowsToCsv', () => {
  it('quotes cells containing a comma, quote or newline', () => {
    const csv = rowsToCsv([
      ['piano', 'nota'],
      ['uno, due', 'lui ha detto "ok"'],
      ['riga\nspezzata', 'semplice'],
    ]);
    const lines = csv.split('\n');
    assert.equal(lines[0], 'piano,nota');
    assert.equal(lines[1], '"uno, due","lui ha detto ""ok"""');
    assert.ok(csv.includes('"riga\nspezzata"'));
  });

  it('leaves plain cells unquoted', () => {
    assert.equal(rowsToCsv([['a', 'b']]), 'a,b');
  });
});

describe('markdownTableToCsv', () => {
  it('produces one CSV line per table row', () => {
    const csv = markdownTableToCsv(RECEIPT_TABLE);
    assert.equal(csv.split('\n').length, 3);
    assert.ok(csv.startsWith('Data,Nome Esercente'));
  });
});
