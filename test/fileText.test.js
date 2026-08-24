import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeXmlEntities,
  docxXmlToText,
  readPdfString,
  pdfContentToText,
  collapseWhitespace,
} from '../dist/shared/fileText.js';

test('decodeXmlEntities handles named and numeric entities', () => {
  assert.equal(
    decodeXmlEntities('A &amp; B &lt;x&gt; &quot;q&quot; &apos;a&apos;'),
    'A & B <x> "q" \'a\'',
  );
  assert.equal(decodeXmlEntities('&#65;&#x42;'), 'AB');
});

test('docxXmlToText: paragraphs, tabs and breaks become whitespace', () => {
  const xml =
    '<w:body><w:p><w:r><w:t>Senior Engineer</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Go</w:t><w:tab/><w:t>AWS</w:t><w:br/><w:t>Remote</w:t></w:r></w:p></w:body>';
  assert.equal(docxXmlToText(xml), 'Senior Engineer\nGo\tAWS\nRemote');
});

test('docxXmlToText decodes entities inside text', () => {
  const xml = '<w:p><w:r><w:t>R&amp;D &amp; Ops</w:t></w:r></w:p>';
  assert.equal(docxXmlToText(xml), 'R&D & Ops');
});

test('docxXmlToText drops tracked-change deletions and field codes', () => {
  const xml =
    '<w:p><w:r><w:t>Keep this</w:t></w:r>' +
    '<w:del><w:r><w:delText> removed</w:delText></w:r></w:del>' +
    '<w:r><w:instrText> HYPERLINK "http://x" </w:instrText></w:r>' +
    '<w:r><w:t> and this</w:t></w:r></w:p>';
  assert.equal(docxXmlToText(xml), 'Keep this and this');
});

test('docxXmlToText ignores tab-stop definitions, keeps inline tabs', () => {
  const xml =
    '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>' +
    '<w:r><w:t>Go</w:t><w:tab/><w:t>AWS</w:t></w:r></w:p>';
  assert.equal(docxXmlToText(xml), 'Go\tAWS');
});

test('readPdfString handles escapes, nesting and octal', () => {
  assert.deepEqual(readPdfString('(hello)', 0), { str: 'hello', next: 7 });
  assert.equal(readPdfString('(a\\(b\\)c)', 0).str, 'a(b)c');
  assert.equal(readPdfString('(nest (ed) ok)', 0).str, 'nest (ed) ok');
  assert.equal(readPdfString('(A\\101)', 0).str, 'AA'); // \101 octal = 'A'
});

test('readPdfString treats backslash-CR/CRLF as a line continuation', () => {
  assert.equal(readPdfString('(ab\\\r\ncd)', 0).str, 'abcd'); // CRLF
  assert.equal(readPdfString('(ab\\\rcd)', 0).str, 'abcd'); // bare CR
});

test('pdfContentToText extracts Tj and TJ text with kerning spaces', () => {
  const content = 'BT (Senior) Tj (Engineer) Tj ET [(Go)-250(AWS)] TJ';
  assert.equal(pdfContentToText(content), 'Senior Engineer Go AWS');
});

test('pdfContentToText keeps small kerns tight but splits large gaps', () => {
  assert.equal(pdfContentToText('[(Wa)-40(ter)] TJ'), 'Water'); // small kern, no space
  assert.equal(pdfContentToText('[(one)-300(two)] TJ'), 'one two'); // large gap, space
});

test('pdfContentToText reads hex strings but skips << >> dicts', () => {
  assert.equal(pdfContentToText('<4869> Tj'), 'Hi'); // <48 69> = "Hi"
  // The ActualText dict must not leak; only the shown string survives.
  assert.equal(pdfContentToText('/Span <</ActualText <00480049>>> BDC (Hi) Tj'), 'Hi');
});

test('collapseWhitespace tidies runs and blank lines', () => {
  assert.equal(collapseWhitespace('a   b\t c'), 'a b c');
  assert.equal(collapseWhitespace('a\n\n\n\nb'), 'a\n\nb');
});
