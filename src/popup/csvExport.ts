import { state } from './state.js';
import { setStatus } from './status.js';
import { scoreEntry } from './scores.js';

function csvField(value: string | number): string {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

export function exportCSV(): void {
  if (!state.extractedProfiles.length) {
    setStatus('No profiles to export.', 'error');
    return;
  }

  const scores = state.profileScores;
  const rows: (string | number)[][] = [['URL', 'Name', 'Score', 'Location', 'Status']];

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
    rows.push([url, name, score, location, status]);
  });

  // Real newlines (the original built literal "\\n" text instead of line breaks).
  const csv = rows.map((row) => row.map(csvField).join(',')).join('\n');
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
