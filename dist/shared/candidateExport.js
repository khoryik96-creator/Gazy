// Builds spreadsheet rows for exporting candidates. Pure (no DOM/chrome) so it's
// unit-tested; the caller turns the rows into CSV text with shared/csv.ts and
// downloads them. Columns are intentionally lean — URL, name, score, location —
// with AI and Folders added only when there's data worth a column.
import { nameFromUrl } from './nameFormat.js';
import { toCsv } from './csv.js';
// Shared row builder. `blank` is what a missing Score/AI cell becomes: '—' reads
// clearly in CSV, while '' leaves a real blank so Excel sorts the numeric columns
// numerically (see buildCandidateSheet).
function candidateRows(cands, blank) {
    const hasAi = cands.some((c) => c.ai !== null);
    const hasFolders = cands.some((c) => c.folders.length > 0);
    const header = ['Name', 'URL', 'Score', 'Location'];
    if (hasAi)
        header.push('AI Score');
    if (hasFolders)
        header.push('Folders');
    const rows = [header];
    for (const c of cands) {
        const row = [
            nameFromUrl(c.url),
            c.url,
            c.score === null ? blank : c.score,
            c.location || '',
        ];
        if (hasAi)
            row.push(c.ai === null ? blank : c.ai);
        if (hasFolders)
            row.push(c.folders.join('; '));
        rows.push(row);
    }
    return rows;
}
/**
 * Header + data rows for CSV. The AI column appears only if at least one
 * candidate has an AI score; the Folders column only if at least one is filed.
 * Missing Score/AI cells fall back to '—' so blanks read clearly.
 */
export function buildCandidateRows(cands) {
    return candidateRows(cands, '—');
}
/**
 * Same columns as buildCandidateRows, but missing Score/AI cells are left blank
 * ('') and present ones stay numbers — so the .xlsx export sorts those columns
 * numerically (highest/lowest) via Excel's filter arrows.
 */
export function buildCandidateSheet(cands) {
    return candidateRows(cands, '');
}
/** Full CSV text for the given candidates. */
export function buildCandidateCsv(cands) {
    return toCsv(buildCandidateRows(cands));
}
/**
 * A filesystem-safe CSV filename for an export scope (a folder name, "shortlist",
 * or "all"). e.g. exportFilename('Phone screen') → 'gazy_phone-screen_<ts>.csv'.
 */
export function exportFilename(scope, now = Date.now(), ext = 'csv') {
    const slug = scope
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'candidates';
    return 'gazy_' + slug + '_' + now + '.' + ext;
}
