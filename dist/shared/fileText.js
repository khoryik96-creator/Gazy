// Pure text extraction from document formats. No DOM / chrome / decompression
// here — the binary plumbing (unzip, inflate) lives in dashboard/fileImport.ts,
// which feeds decoded XML / content-stream strings to these tolerant parsers.
// Kept pure so the fiddly string handling is unit-tested.
/** Decodes the handful of XML entities Word emits in document.xml. */
export function decodeXmlEntities(s) {
    return s
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&amp;/g, '&'); // last, so we don't double-decode
}
/**
 * Text from a DOCX `word/document.xml`. Word keeps visible text in <w:t> nodes;
 * paragraphs (<w:p>), tabs (<w:tab/>) and breaks (<w:br/>) carry the layout.
 * Turn those into real whitespace, drop every other tag, decode entities.
 */
export function docxXmlToText(xml) {
    const withBreaks = xml
        // Drop text the author removed (tracked-change deletions) and field
        // instruction codes (e.g. HYPERLINK/TOC) — both carry text we must not keep.
        .replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText>/g, '')
        .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, '')
        // Only a bare inline tab (<w:tab/>) is a real tab; <w:tab w:val=… w:pos=…/>
        // inside <w:tabs> is a tab-stop definition, not visible text.
        .replace(/<w:tab\s*\/>/g, '\t')
        .replace(/<w:br\b[^>]*\/?>/g, '\n')
        .replace(/<\/w:p>/g, '\n');
    const text = decodeXmlEntities(withBreaks.replace(/<[^>]+>/g, ''));
    return text
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
/**
 * Reads one PDF literal string starting at the opening '(' (index `start`),
 * honouring nested parens, backslash escapes and octal codes. Returns the
 * decoded text and the index just past the closing ')'.
 */
export function readPdfString(s, start) {
    let i = start + 1;
    let depth = 1;
    let out = '';
    const SIMPLE = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        '(': '(',
        ')': ')',
        '\\': '\\',
    };
    while (i < s.length) {
        const c = s[i];
        if (c === '\\') {
            const d = s[i + 1] ?? '';
            if (d in SIMPLE) {
                out += SIMPLE[d];
                i += 2;
            }
            else if (d === '\n') {
                i += 2; // line continuation (LF)
            }
            else if (d === '\r') {
                i += s[i + 2] === '\n' ? 3 : 2; // line continuation (CR or CRLF)
            }
            else if (d >= '0' && d <= '7') {
                let oct = d;
                let k = i + 2;
                while (k < s.length && k < i + 4 && s[k] >= '0' && s[k] <= '7')
                    oct += s[k++];
                out += String.fromCharCode(parseInt(oct, 8) & 0xff);
                i = k;
            }
            else {
                out += d;
                i += 2;
            }
        }
        else if (c === '(') {
            depth++;
            out += c;
            i++;
        }
        else if (c === ')') {
            depth--;
            i++;
            if (depth === 0)
                break;
            out += ')';
        }
        else {
            out += c;
            i++;
        }
    }
    return { str: out, next: i };
}
/**
 * Best-effort text from a decoded PDF content stream. Pulls literal strings from
 * the text-showing operators — `(…) Tj` and `[(…) … (…)] TJ` (and hex `<…>`
 * strings) — joining words with spaces. Glyphs within one `[…]` array belong to
 * the same run so they concatenate; separate shows are space-separated. Layout
 * (exact line breaks) is not recovered, which is fine for keyword extraction and
 * an editable JD box.
 */
// A TJ kerning adjustment at least this negative marks an inter-word gap (units
// are −1/1000 em; word spaces are typically a few hundred).
const TJ_SPACE_THRESHOLD = -100;
export function pdfContentToText(content) {
    let out = '';
    let i = 0;
    const n = content.length;
    let inArray = false;
    while (i < n) {
        const c = content[i];
        if (c === '(') {
            const { str, next } = readPdfString(content, i);
            out += str;
            if (!inArray)
                out += ' ';
            i = next;
        }
        else if (c === '<' && content[i + 1] === '<') {
            // A dictionary (e.g. marked content /Span <</ActualText …>>) — skip it
            // whole so its inner hex/text doesn't leak into the output.
            const end = content.indexOf('>>', i + 2);
            i = end === -1 ? n : end + 2;
        }
        else if (c === '<') {
            const end = content.indexOf('>', i + 1);
            if (end > i) {
                out += decodePdfHexString(content.slice(i + 1, end));
                if (!inArray)
                    out += ' ';
                i = end + 1;
            }
            else
                i++;
        }
        else if (c === '[') {
            inArray = true;
            i++;
        }
        else if (c === ']') {
            inArray = false;
            out += ' ';
            i++;
        }
        else if (inArray && (c === '-' || c === '.' || (c >= '0' && c <= '9'))) {
            // A positioning number between glyph runs; a large negative gap is a space.
            let j = i + 1;
            while (j < n && (content[j] === '.' || (content[j] >= '0' && content[j] <= '9')))
                j++;
            const num = parseFloat(content.slice(i, j));
            if (!Number.isNaN(num) && num <= TJ_SPACE_THRESHOLD)
                out += ' ';
            i = j;
        }
        else {
            i++;
        }
    }
    return collapseWhitespace(out);
}
/** Decodes a PDF hex string body (between < and >) to bytes → chars. */
function decodePdfHexString(hex) {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    const padded = clean.length % 2 ? clean + '0' : clean;
    let out = '';
    for (let i = 0; i < padded.length; i += 2) {
        out += String.fromCharCode(parseInt(padded.slice(i, i + 2), 16));
    }
    return out;
}
/** Collapses runs of spaces/tabs and trims trailing space on lines. */
export function collapseWhitespace(s) {
    return s
        .replace(/[ \t\f\r]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
