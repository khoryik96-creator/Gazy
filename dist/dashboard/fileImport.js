import { docxXmlToText, pdfContentToText, collapseWhitespace } from '../shared/fileText.js';
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB guard
/** Extension of a filename, lowercased, without the dot. */
function extOf(name) {
    const dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}
/** Inflate bytes with the given DecompressionStream format. */
async function inflate(bytes, format) {
    const ds = new DecompressionStream(format);
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
// ---- DOCX (ZIP) ----
/** Extracts one entry's bytes from a ZIP by scanning the central directory. */
async function readZipEntry(buf, wanted) {
    const bytes = new Uint8Array(buf);
    const dv = new DataView(buf);
    // Find End Of Central Directory (signature 0x06054b50), scanning from the end.
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
        if (dv.getUint32(i, true) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd === -1)
        return null;
    const cdCount = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true); // central directory offset
    const td = new TextDecoder();
    for (let n = 0; n < cdCount; n++) {
        if (dv.getUint32(p, true) !== 0x02014b50)
            break; // central file header sig
        const method = dv.getUint16(p + 10, true);
        const compSize = dv.getUint32(p + 20, true);
        const nameLen = dv.getUint16(p + 28, true);
        const extraLen = dv.getUint16(p + 30, true);
        const commentLen = dv.getUint16(p + 32, true);
        const localOff = dv.getUint32(p + 42, true);
        const name = td.decode(bytes.subarray(p + 46, p + 46 + nameLen));
        if (name === wanted) {
            // Jump to the local header to find where the data actually starts.
            const lNameLen = dv.getUint16(localOff + 26, true);
            const lExtraLen = dv.getUint16(localOff + 28, true);
            const dataStart = localOff + 30 + lNameLen + lExtraLen;
            const raw = bytes.subarray(dataStart, dataStart + compSize);
            return method === 0 ? raw : await inflate(raw, 'deflate-raw');
        }
        p += 46 + nameLen + extraLen + commentLen;
    }
    return null;
}
async function readDocx(buf) {
    const entry = await readZipEntry(buf, 'word/document.xml');
    if (!entry)
        return { text: '', warning: "Couldn't read this .docx — try pasting the text instead." };
    const xml = new TextDecoder().decode(entry);
    return { text: docxXmlToText(xml) };
}
// ---- PDF ----
async function readPdf(buf) {
    const bytes = new Uint8Array(buf);
    const latin1 = new TextDecoder('latin1').decode(bytes);
    const chunks = [];
    // Match the `stream` keyword only as a whole word — the negative lookbehind
    // keeps it from firing on the `stream` inside `endstream`. Indices from the
    // latin1 string map 1:1 to byte offsets.
    const re = /(?<![A-Za-z])stream\r?\n/g;
    let m;
    while ((m = re.exec(latin1)) !== null) {
        const dataStart = m.index + m[0].length;
        // The stream dictionary sits between this object's header and the keyword.
        // Scan the whole object (not a fixed window) so a long dict can't hide the
        // /Filter, and read the declared /Length to bound the stream precisely —
        // scanning for `endstream` can false-match binary bytes inside the data.
        const objStart = latin1.lastIndexOf('obj', m.index);
        const dict = latin1.slice(objStart === -1 ? Math.max(0, m.index - 4000) : objStart, m.index);
        const isFlate = dict.includes('/FlateDecode');
        const lenM = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict); // ignore indirect /Length
        let dataEnd = -1;
        if (lenM) {
            const end = dataStart + parseInt(lenM[1], 10);
            if (end <= bytes.length)
                dataEnd = end;
        }
        if (dataEnd === -1) {
            const endIdx = latin1.indexOf('endstream', dataStart);
            if (endIdx === -1)
                break;
            dataEnd = endIdx;
            if (latin1[dataEnd - 1] === '\n')
                dataEnd--;
            if (latin1[dataEnd - 1] === '\r')
                dataEnd--;
        }
        const raw = bytes.subarray(dataStart, dataEnd);
        let content = null;
        if (isFlate) {
            try {
                content = new TextDecoder('latin1').decode(await inflate(raw, 'deflate'));
            }
            catch {
                content = null; // not our concern — skip unreadable streams
            }
        }
        else {
            content = latin1.slice(dataStart, dataEnd);
        }
        // Any of the text-showing operators means this stream carries page text.
        if (content && /BT|Tj|TJ/.test(content))
            chunks.push(pdfContentToText(content));
        const endKw = latin1.indexOf('endstream', dataEnd);
        re.lastIndex = endKw === -1 ? dataEnd + 1 : endKw + 'endstream'.length;
    }
    const text = collapseWhitespace(chunks.join('\n'));
    if (!text.trim()) {
        return {
            text: '',
            warning: 'No text found in this PDF (a scanned/image PDF?). Try a .docx, .txt, or paste the text.',
        };
    }
    return { text };
}
/** Reads a JD file to text, dispatching on extension. Throws on unusable input. */
export async function readJdFile(file) {
    if (file.size > MAX_BYTES)
        throw new Error('File is too large (max 15 MB).');
    const ext = extOf(file.name);
    if (ext === 'txt' || ext === '' || file.type.startsWith('text/')) {
        return { text: (await file.text()).trim() };
    }
    if (ext === 'docx')
        return readDocx(await file.arrayBuffer());
    if (ext === 'pdf')
        return readPdf(await file.arrayBuffer());
    if (ext === 'doc') {
        throw new Error('Legacy .doc isn’t supported — save it as .docx or .pdf, or paste the text.');
    }
    throw new Error('Unsupported file type “.' + ext + '”. Use .txt, .docx, or .pdf.');
}
