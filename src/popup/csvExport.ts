import { state } from './state.js';
import { setStatus } from './status.js';
import { scoreEntry } from './scores.js';
import { isShortlisted } from './shortlist.js';
import { toCsv } from '../shared/csv.js';

export function exportCSV(): void {
  if (!state.extractedProfiles.length) {
    setStatus('No profiles to export.', 'error');
    return;
  }

  const scores = state.profileScores;
  const aiEvals = state.aiEvals;
  // Only include the AI columns when at least one profile was AI-evaluated, so
  // exports without AI stay lean.
  const hasAi = Object.keys(aiEvals).length > 0;

  const header = ['URL', 'Name', 'Score', 'Location', 'Status', 'Shortlisted'];
  if (hasAi) header.push('AI Score', 'AI Reason', 'AI Matched', 'AI Missing');
  const rows: (string | number)[][] = [header];

  state.extractedProfiles.forEach((url) => {
    const name = url.split('/in/')[1]?.split('/')[0] || 'Unknown';
    const entry = scoreEntry(scores, url);
    let score: string | number = '—';
    let status = 'not scored';
    if (entry) {
      if (entry.success === false) status = 'scrape failed';
      else {
        score = entry.score;
        status = 'scored';
      }
    }
    const location = entry?.location || '';
    const row: (string | number)[] = [
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
        row.push('—', '', '', '');
      } else if (ai.error) {
        row.push('failed', ai.error, '', '');
      } else {
        row.push(ai.score, ai.reason, ai.matched.join('; '), ai.missing.join('; '));
      }
    }

    rows.push(row);
  });

  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'profiles_' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('📊 CSV exported!', 'success');
}

export async function copyAllURLs(): Promise<void> {
  if (!state.extractedProfiles.length) {
    setStatus('No profiles to copy', 'error');
    return;
  }
  await navigator.clipboard.writeText(state.extractedProfiles.join('\n'));
  setStatus('Copied ' + state.extractedProfiles.length + ' URLs!', 'success');
  setTimeout(() => setStatus('Ready', 'info'), 2000);
}
