import { state } from './state.js';
import { setStatus } from './status.js';

function csvField(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

export function exportCSV() {
  if (!state.extractedProfiles.length) {
    setStatus('No profiles to export.', 'error');
    return;
  }

  const scores = state.profileScores;
  const rows = [['URL', 'Name', 'Score', 'Location']];

  state.extractedProfiles.forEach((url) => {
    const name = url.split('/in/')[1]?.split('/')[0] || 'Unknown';
    const score = scores[url] !== undefined ? scores[url] : '—';
    const location = scores[url + '_location'] || '';
    rows.push([url, name, score, location]);
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

export async function copyAllURLs() {
  if (!state.extractedProfiles.length) {
    setStatus('No profiles to copy', 'error');
    return;
  }
  await navigator.clipboard.writeText(state.extractedProfiles.join('\n'));
  setStatus('Copied ' + state.extractedProfiles.length + ' URLs!', 'success');
  setTimeout(() => setStatus('Ready', 'info'), 2000);
}
