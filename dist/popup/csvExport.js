import { state } from './state.js';
import { setStatus } from './status.js';
import { scoreEntry } from './scores.js';
import { isShortlisted } from './shortlist.js';
import { toCsv } from '../shared/csv.js';
import { buildXlsx } from '../shared/xlsx.js';
// Builds the export grid. `blank` is what a missing Score/AI cell becomes:
// '—' reads clearly in CSV, '' leaves a real blank so Excel sorts the numeric
// Score / AI Score columns numerically. Present scores stay numbers either way.
function buildExportRows(blank) {
    const scores = state.profileScores;
    const aiEvals = state.aiEvals;
    // Only include the AI columns when at least one profile was AI-evaluated, so
    // exports without AI stay lean.
    const hasAi = Object.keys(aiEvals).length > 0;
    const header = ['URL', 'Name', 'Score', 'Location', 'Status', 'Shortlisted'];
    if (hasAi)
        header.push('AI Score', 'AI Reason', 'AI Matched', 'AI Missing');
    const rows = [header];
    state.extractedProfiles.forEach((url) => {
        const name = url.split('/in/')[1]?.split('/')[0] || 'Unknown';
        const entry = scoreEntry(scores, url);
        let score = blank;
        let status = 'not scored';
        if (entry) {
            if (entry.success === false)
                status = 'scrape failed';
            else {
                score = entry.score;
                status = 'scored';
            }
        }
        const location = entry?.location || '';
        const row = [
            url,
            name,
            score,
            location,
            status,
            isShortlisted(url) ? 'yes' : 'no',
        ];
        if (hasAi) {
            const ai = aiEvals[url];
            if (!ai) {
                row.push(blank, '', '', '');
            }
            else if (ai.error) {
                row.push('failed', ai.error, '', '');
            }
            else {
                row.push(ai.score, ai.reason, ai.matched.join('; '), ai.missing.join('; '));
            }
        }
        rows.push(row);
    });
    return rows;
}
function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}
export function exportCSV() {
    if (!state.extractedProfiles.length) {
        setStatus('No profiles to export.', 'error');
        return;
    }
    download(new Blob([toCsv(buildExportRows('—'))], { type: 'text/csv' }), 'profiles_' + Date.now() + '.csv');
    setStatus('📊 CSV exported!', 'success');
}
// Real .xlsx with the header row's filter/sort arrows, so Score and AI Score can
// be ordered highest/lowest in Excel. Numeric cells sort as numbers.
export function exportXLSX() {
    if (!state.extractedProfiles.length) {
        setStatus('No profiles to export.', 'error');
        return;
    }
    const bytes = buildXlsx(buildExportRows(''), 'Candidates');
    download(new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }), 'profiles_' + Date.now() + '.xlsx');
    setStatus('📊 Excel exported!', 'success');
}
export async function copyAllURLs() {
    if (!state.extractedProfiles.length) {
        setStatus('No profiles to copy', 'error');
        return;
    }
    await navigator.clipboard.writeText(state.extractedProfiles.join('\n'));
    setStatus('Copied ' + state.extractedProfiles.length + ' URLs!', 'success');
    setTimeout(() => setStatus('Ready', 'info'), 2000);
}
