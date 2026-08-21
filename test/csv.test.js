import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvField, toCsv } from '../dist/shared/csv.js';

test('quotes fields and escapes embedded quotes', () => {
  assert.equal(csvField('plain'), '"plain"');
  assert.equal(csvField('has "quote"'), '"has ""quote"""');
  assert.equal(csvField(42), '"42"');
});

test('neutralises spreadsheet formula injection', () => {
  // Leading = + - @ (and control chars) are formula triggers in Excel/Sheets.
  assert.equal(csvField('=HYPERLINK("http://evil")'), `"'=HYPERLINK(""http://evil"")"`);
  assert.equal(csvField('+1-555'), `"'+1-555"`);
  assert.equal(csvField('-2'), `"'-2"`);
  assert.equal(csvField('@handle'), `"'@handle"`);
  // A normal value is untouched (aside from quoting).
  assert.equal(csvField('Jane Doe'), '"Jane Doe"');
});

test('toCsv joins rows with real newlines', () => {
  const csv = toCsv([
    ['URL', 'Name'],
    ['https://x/in/jane', 'Jane'],
  ]);
  assert.equal(csv, '"URL","Name"\n"https://x/in/jane","Jane"');
  assert.equal(csv.includes('\\n'), false); // real newline, not literal backslash-n
});
