// Minimal, dependency-free .xlsx writer. Produces a valid single-sheet workbook
// with the header row's AutoFilter enabled, so opening it in Excel or Google
// Sheets shows clickable filter/sort dropdowns on every column (e.g. sort a
// Score column high→low). Numeric cells are written as real numbers so Excel
// sorts them numerically rather than as text.
//
// Entries are stored uncompressed (ZIP "store" method) — no deflate dependency,
// and the XML sits verbatim in the output, which keeps it easy to unit-test.

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 0 → "A", 25 → "Z", 26 → "AA" … (spreadsheet column letters). */
export function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function isNumericCell(v: string | number): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function cellXml(ref: string, value: string | number): string {
  if (value === '' || value === null || value === undefined) return '';
  if (isNumericCell(value)) return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`;
}

function sheetXml(rows: (string | number)[][]): string {
  const rowCount = Math.max(rows.length, 1);
  const colCount = Math.max(1, ...rows.map((r) => r.length));
  const lastRef = columnName(colCount - 1) + rowCount;

  let body = '';
  rows.forEach((row, r) => {
    const cells = row.map((v, c) => cellXml(columnName(c) + (r + 1), v)).join('');
    body += `<row r="${r + 1}">${cells}</row>`;
  });

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${lastRef}"/>` +
    `<sheetData>${body}</sheetData>` +
    // AutoFilter over the whole table (incl. header) = the filter/sort dropdowns.
    `<autoFilter ref="A1:${lastRef}"/>` +
    '</worksheet>'
  );
}

function sanitizeSheetName(name: string): string {
  // Excel forbids : \ / ? * [ ] in sheet names and caps them at 31 chars.
  const cleaned = name
    .replace(/[:\\/?*[\]]/g, ' ')
    .trim()
    .slice(0, 31);
  return cleaned || 'Sheet1';
}

function pushUint16(out: number[], value: number): void {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushUint32(out: number[], value: number): void {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Packages files into a ZIP archive using the "store" (no compression) method. */
function zipStore(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const out: number[] = [];
  const central: number[] = [];
  const offsets: number[] = [];

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    offsets.push(out.length);

    // Local file header.
    pushUint32(out, 0x04034b50);
    pushUint16(out, 20); // version needed
    pushUint16(out, 0); // flags
    pushUint16(out, 0); // compression: store
    pushUint16(out, 0); // mod time
    pushUint16(out, 0); // mod date
    pushUint32(out, crc);
    pushUint32(out, entry.data.length); // compressed size
    pushUint32(out, entry.data.length); // uncompressed size
    pushUint16(out, nameBytes.length);
    pushUint16(out, 0); // extra length
    out.push(...nameBytes);
    out.push(...entry.data);
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);

    pushUint32(central, 0x02014b50);
    pushUint16(central, 20); // version made by
    pushUint16(central, 20); // version needed
    pushUint16(central, 0); // flags
    pushUint16(central, 0); // compression
    pushUint16(central, 0); // mod time
    pushUint16(central, 0); // mod date
    pushUint32(central, crc);
    pushUint32(central, entry.data.length);
    pushUint32(central, entry.data.length);
    pushUint16(central, nameBytes.length);
    pushUint16(central, 0); // extra
    pushUint16(central, 0); // comment
    pushUint16(central, 0); // disk number
    pushUint16(central, 0); // internal attrs
    pushUint32(central, 0); // external attrs
    pushUint32(central, offsets[i]);
    central.push(...nameBytes);
  }

  const centralOffset = out.length;
  out.push(...central);

  // End of central directory.
  pushUint32(out, 0x06054b50);
  pushUint16(out, 0); // disk
  pushUint16(out, 0); // disk with central dir
  pushUint16(out, entries.length);
  pushUint16(out, entries.length);
  pushUint32(out, central.length);
  pushUint32(out, centralOffset);
  pushUint16(out, 0); // comment length

  // Back the result with a plain ArrayBuffer (not ArrayBufferLike) so it's a
  // valid BlobPart for the download.
  const bytes = new Uint8Array(out.length);
  bytes.set(out);
  return bytes;
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const WORKBOOK_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '</Relationships>';

function workbookXml(sheetName: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>'
  );
}

/**
 * Build a .xlsx workbook (as bytes) from a 2D array of cells. Row 0 is the header;
 * AutoFilter is enabled across the whole range so every column gets Excel's
 * sort/filter dropdown. Numbers stay numeric (sortable as numbers); '' is a blank
 * cell.
 */
export function buildXlsx(
  rows: (string | number)[][],
  sheetName = 'Candidates',
): Uint8Array<ArrayBuffer> {
  const name = sanitizeSheetName(sheetName);
  return zipStore([
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml(name)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(WORKBOOK_RELS) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheetXml(rows)) },
  ]);
}
