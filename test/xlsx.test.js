import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildXlsx, columnName } from '../dist/shared/xlsx.js';

// Entries are stored uncompressed, so the XML sits verbatim in the bytes and we
// can assert on it as latin1 text.
const asText = (bytes) => Buffer.from(bytes).toString('latin1');

test('columnName maps indexes to spreadsheet letters', () => {
  assert.equal(columnName(0), 'A');
  assert.equal(columnName(25), 'Z');
  assert.equal(columnName(26), 'AA');
});

test('buildXlsx returns a ZIP (PK) with the OOXML parts', () => {
  const bytes = buildXlsx([
    ['Name', 'Score'],
    ['Jane', 80],
  ]);
  assert.ok(bytes instanceof Uint8Array);
  // ZIP local-file-header signature "PK\x03\x04".
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const text = asText(bytes);
  assert.ok(text.includes('[Content_Types].xml'));
  assert.ok(text.includes('xl/worksheets/sheet1.xml'));
});

test('header row gets an AutoFilter over the whole table', () => {
  const text = asText(
    buildXlsx([
      ['Name', 'Score', 'AI Score'],
      ['Jane', 80, 66],
      ['Ada', 40, 90],
    ]),
  );
  // 3 columns (A..C), 3 rows incl header → A1:C3.
  assert.ok(text.includes('<autoFilter ref="A1:C3"/>'));
});

test('numbers are numeric cells; strings are inline strings; blanks are omitted', () => {
  const text = asText(
    buildXlsx([
      ['Name', 'Score'],
      ['Jane', 80],
      ['Ada', ''],
    ]),
  );
  assert.ok(text.includes('<v>80</v>')); // numeric cell, sortable as a number
  assert.ok(text.includes('<t xml:space="preserve">Jane</t>')); // inline string
  // The blank score cell (row 3, col B) is omitted entirely.
  assert.ok(!text.includes('r="B3"'));
});

test('XML-special characters in strings are escaped', () => {
  const text = asText(buildXlsx([['Name'], ['A & <b> "c"']]));
  assert.ok(text.includes('A &amp; &lt;b&gt; &quot;c&quot;'));
});

test('URL cells become clickable hyperlinks', () => {
  const bytes = buildXlsx([
    ['Name', 'URL'],
    ['Jane', 'https://www.linkedin.com/in/jane'],
  ]);
  const text = asText(bytes);
  // Worksheet declares a hyperlink on the URL cell (B2) via a relationship.
  assert.ok(text.includes('<hyperlinks>'));
  assert.ok(text.includes('<hyperlink ref="B2" r:id="rId1"/>'));
  // A per-sheet rels part maps rId1 to the external URL.
  assert.ok(text.includes('xl/worksheets/_rels/sheet1.xml.rels'));
  assert.ok(text.includes('Target="https://www.linkedin.com/in/jane" TargetMode="External"'));
  // The cell still shows the URL text.
  assert.ok(text.includes('https://www.linkedin.com/in/jane</t>'));
});

test('no hyperlinks part when there are no URL cells', () => {
  const text = asText(
    buildXlsx([
      ['Name', 'Score'],
      ['Jane', 80],
    ]),
  );
  assert.ok(!text.includes('<hyperlinks>'));
  assert.ok(!text.includes('sheet1.xml.rels'));
});
