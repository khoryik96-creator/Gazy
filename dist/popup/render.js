import { dom } from './dom.js';
import { state } from './state.js';
import { setStorage } from './storage.js';
import { setStatus } from './status.js';
import { scoreEntry } from './scores.js';
import { isShortlisted, toggleShortlist } from './shortlist.js';
import { handleOf, prettyName } from '../shared/nameFormat.js';
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
function initials(name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}
export function renderProfiles() {
    const hideZero = dom.hideZeroCheck.checked;
    const shortlistOnly = dom.shortlistOnlyCheck.checked;
    const scores = state.profileScores;
    let visibleCount = 0;
    let html = '';
    state.extractedProfiles.forEach((url, i) => {
        const entry = scoreEntry(scores, url);
        const score = entry?.score;
        if (hideZero && score === 0 && entry?.success !== false)
            return;
        if (shortlistOnly && !isShortlisted(url))
            return;
        visibleCount++;
        const handle = handleOf(url) || 'profile-' + (i + 1);
        const name = prettyName(handle);
        const starred = isShortlisted(url);
        // Keyword score chip (omitted before a profile is scored).
        let kwChip = '';
        if (entry) {
            if (entry.success === false)
                kwChip = '<span class="kw fail">failed</span>';
            else if (score === 0)
                kwChip = '<span class="kw zero">0%</span>';
            else
                kwChip = '<span class="kw">' + score + '%</span>';
        }
        // Optional DeepSeek evaluation chip + a 💡 "why" button.
        const ai = state.aiEvals[url];
        let aiChip = '';
        let whyBtn = '';
        if (ai) {
            if (ai.error) {
                aiChip = '<span class="ai none" title="' + escapeHtml(ai.error) + '">✦⚠</span>';
            }
            else {
                aiChip = '<span class="ai">✦' + ai.score + '</span>';
                const why = ai.reason +
                    (ai.matched.length ? '\n\n✅ Matched: ' + ai.matched.join(', ') : '') +
                    (ai.missing.length ? '\n\n❌ Missing: ' + ai.missing.join(', ') : '');
                whyBtn =
                    '<button class="iconmini why" data-why="' +
                        encodeURIComponent(why) +
                        '" title="Why this score">💡</button>';
            }
        }
        const debugText = entry?.debug;
        const debugBtn = debugText
            ? '<button class="iconmini debug" data-debug="' +
                encodeURIComponent(debugText) +
                '" title="First 200 chars scraped">🔍</button>'
            : '';
        const meta = entry?.location || '@' + handle;
        html +=
            '<div class="cardrow">' +
                '<span class="av">' +
                escapeHtml(initials(name)) +
                '</span>' +
                '<a class="who" href="' +
                escapeHtml(url) +
                '" target="_blank" rel="noopener" title="' +
                escapeHtml(url) +
                '"><span class="nm">' +
                escapeHtml(name) +
                '</span><span class="meta">' +
                escapeHtml(meta) +
                '</span></a>' +
                '<div class="scorewrap">' +
                kwChip +
                aiChip +
                '</div>' +
                '<div class="rowacts">' +
                '<button class="starbtn' +
                (starred ? '' : ' off') +
                '" data-url="' +
                escapeHtml(url) +
                '" title="' +
                (starred ? 'Remove from shortlist' : 'Add to shortlist') +
                '">' +
                (starred ? '★' : '☆') +
                '</button>' +
                whyBtn +
                debugBtn +
                '<button class="iconmini copy" data-url="' +
                escapeHtml(url) +
                '" title="Copy URL">📋</button>' +
                '<button class="iconmini remove" data-index="' +
                i +
                '" title="Remove">✕</button>' +
                '</div>' +
                '</div>';
    });
    dom.resultsContainer.innerHTML =
        html || '<div class="empty-state"><p>No candidates match the current filter.</p></div>';
    dom.profileCount.textContent = visibleCount + ' candidates';
    wireResultRowActions();
}
function wireResultRowActions() {
    dom.resultsContainer.querySelectorAll('.iconmini.debug').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            alert(decodeURIComponent(target.dataset.debug || ''));
        });
    });
    dom.resultsContainer.querySelectorAll('.iconmini.why').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            alert(decodeURIComponent(target.dataset.why || ''));
        });
    });
    dom.resultsContainer.querySelectorAll('.starbtn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            toggleShortlist(target.dataset.url || '');
            renderProfiles();
        });
    });
    dom.resultsContainer.querySelectorAll('.iconmini.copy').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            void navigator.clipboard.writeText(target.dataset.url || '').then(() => {
                setStatus('URL copied!', 'success');
                setTimeout(() => setStatus('Ready', 'info'), 2000);
            });
        });
    });
    dom.resultsContainer.querySelectorAll('.iconmini.remove').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const idx = parseInt(target.dataset.index || '', 10);
            state.extractedProfiles.splice(idx, 1);
            void setStorage({ profiles: state.extractedProfiles });
            renderProfiles();
            setStatus('Profile removed', 'info');
        });
    });
}
dom.hideZeroCheck.addEventListener('change', renderProfiles);
dom.shortlistOnlyCheck.addEventListener('change', renderProfiles);
