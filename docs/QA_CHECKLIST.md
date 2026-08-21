# Manual QA checklist

The automated tests cover the pure logic (`npm test`) and that the popup loads and
renders (`npm run test:e2e`). They **cannot** cover the LinkedIn scraping path —
that needs a real, logged-in LinkedIn session in a real browser. Run this list
before shipping a change that touches search, extraction, scraping, or scoring.

## Setup

1. `npm run build`
2. `chrome://extensions` → Developer Mode → **Load unpacked** → select `dist/`.
3. Be logged into `linkedin.com` in that same Chrome profile.

## Search & extraction

- [ ] Enter keywords, click **Search LinkedIn** → a people-search tab opens and
      auto-scrolls, and the popup fills with profile URLs.
- [ ] The result count matches roughly what the page shows.
- [ ] No obvious non-result links (nav, "People you may know", footer) leak into
      the list.

## Scoring

- [ ] With a JD or keywords set, click **Score Profiles** → progress bar advances,
      ETA updates, profiles get %.
- [ ] A profile that genuinely doesn't match shows `0% ❌`; one that fails to load
      shows `⚠️ failed` (not `0%`). Use the 🔍 debug button to see what was scraped.
- [ ] **Boolean rule** (e.g. `"React" AND "AWS" NOT "Intern"`) filters as expected.
- [ ] **Country filter** set to a real location keeps matching profiles and zeroes
      the rest; cleared filter scores everyone.
- [ ] Close and reopen the popup mid-run → progress UI is restored (not reset).
- [ ] **Stop** halts scoring.

## Export & persistence

- [ ] **Export CSV** downloads a file that opens with real rows/columns
      (URL, Name, Score, Location, Status) — not one mangled line.
- [ ] **Copy All** copies newline-separated URLs.
- [ ] Save / load / delete a **template** round-trips all four fields.
- [ ] Reload the popup → last profiles, scores, and form inputs persist.
- [ ] **Clear Cache** empties scores but keeps templates.

## Notes

If scores are all `0%` or `⚠️ failed`, the cause is upstream scraping
(`background/pageExtractor.ts` + `profileFetcher.ts`) — the LinkedIn DOM selectors
are the fragile part and drift when LinkedIn changes its markup.
