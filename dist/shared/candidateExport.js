// Builds spreadsheet rows for exporting candidates. Pure (no DOM/chrome) so it's
// unit-tested; the caller turns the rows into CSV text with shared/csv.ts and
// downloads them. Columns are intentionally lean — URL, name, score, location —
// with AI and Folders added only when there's data worth a column.
import { nameFromUrl } from './nameFormat.js';
import { toCsv } from './csv.js';
/**
 * Header + data rows for the given candidates. The AI column appears only if at
 * least one candidate has an AI score; the Folders column only if at least one
 * is filed. Score/AI cells fall back to '—' when absent so blanks read clearly.
 */
export function buildCandidateRows(cands) {
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
            c.score === null ? '—' : c.score,
            c.location || '',
        ];
        if (hasAi)
            row.push(c.ai === null ? '—' : c.ai);
        if (hasFolders)
            row.push(c.folders.join('; '));
        rows.push(row);
    }
    return rows;
}
/** Full CSV text for the given candidates. */
export function buildCandidateCsv(cands) {
    return toCsv(buildCandidateRows(cands));
}
/**
 * A filesystem-safe CSV filename for an export scope (a folder name, "shortlist",
 * or "all"). e.g. exportFilename('Phone screen') → 'gazy_phone-screen_<ts>.csv'.
 */
export function exportFilename(scope, now = Date.now()) {
    const slug = scope
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'candidates';
    return 'gazy_' + slug + '_' + now + '.csv';
}
