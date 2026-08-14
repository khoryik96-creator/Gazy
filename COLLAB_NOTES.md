# Collaboration Notes

More than one Claude Code session/account may work on this repo at the same
time. This file is a lightweight shared log so agents don't duplicate or
collide on the same files — check it before starting work, update it when
your status changes.

## Protocol

1. Before starting a change, skim the **Status log** below for entries whose
   scope overlaps the file(s)/module(s) you're about to touch.
2. Add a row for your session before making changes: date, branch, what
   you're doing, which module(s) (see `ARCHITECTURE.md` for the module map).
3. Stick to the module boundaries in `ARCHITECTURE.md` — most collisions
   between two agents can be avoided just by keeping changes inside one
   module (`shared/`, `background/`, `popup/`, `content/`).
4. Update your row to "done" (or delete it) once your work is merged to
   `main`, so the log doesn't go stale.
5. If you see an "in progress" row on the same module you're about to edit,
   flag it to the human running you instead of proceeding — let them decide
   how to split the work.

## Status log

| Date       | Branch                                  | Scope                              | Status |
|------------|------------------------------------------|-------------------------------------|--------|
| 2026-08-03 | claude/multi-account-project-rcmfpz     | popup/templates.js, background/scoring.js | merged (PR #2) |
| 2026-08-14 | claude/multi-account-project-rcmfpz     | scoring, scoringEngine, popup render/csv/scoringUI, content/extractor, pageExtractor, shared/booleanExpression, test/ | done (unmerged) |

### 2026-08-03 — bug fixes (branch `claude/multi-account-project-rcmfpz`)

Three issues reported by the human; two needed code, one didn't.

1. **Template save now prefills the selected template name.**
   `popup/templates.js` → `saveTemplate()`: `prompt()` now defaults to
   `dom.templateSelect.value`, so if you're on a saved template, clicking
   Save shows its name pre-filled — press OK to overwrite, or edit to save
   under a new name. (The existing "already exists — overwrite?" confirm
   still fires.)

2. **Country dropdown on LinkedIn** — no change. Confirmed working as-is.

3. **All profiles scored 0%.** Root cause (most likely): `background/scoring.js`
   `computeScore()` gated every profile to 0 when the scraped `location`
   field didn't contain the country filter string. `location` comes from
   fragile selectors in `background/pageExtractor.js` and is frequently
   empty, so with any country filter set, every profile failed the gate.
   Fix: the country check now also matches against the full page text
   (`text`) as a fallback.
   - **Note for the other agent:** if 0% persists even with the country
     filter cleared, the cause is upstream scraping (empty `fullText` /
     login-wall), which lives in `background/pageExtractor.js` +
     `profileFetcher.js` — use the 🔍 debug button on a result row to see the
     first 200 chars actually scraped. Not yet touched, so it's free to pick up.
   - Also a known minor limitation (untouched): the keyword regex in
     `computeScore` uses `\b` boundaries, so symbol keywords like `c++`/`c#`
     won't match. Flag before anyone "fixes" it to avoid double work.

### 2026-08-14 — review-driven fixes (branch `claude/multi-account-project-rcmfpz`)

Second pass, from the "what can be improved" review. All landed together;
`npm test` (19 tests, `node --test`) passes.

1. **CSV `Location` column was always empty.** `csvExport.js` read a
   `scores[url + '_location']` key the engine never wrote. Reworked the score
   map into one structured entry per URL — `{ score, location, debug, success }`
   — in `background/scoringEngine.js`. New popup helper `popup/scores.js`
   (`scoreEntry`) reads it and also tolerates the old flat format, so a stale
   `profileScores` in storage still renders. CSV now has a real Location column
   plus a Status column.
2. **Symbol keywords now score.** `background/scoring.js`: replaced the
   `\b…\b` wrapper (see the limitation flagged above — this is the fix) with
   `boundedRegex()`, which uses `(?<![a-z0-9])…(?![a-z0-9])`. `c++`, `c#`,
   `.net`, `node.js` now match. Locked by `test/scoring.test.js`.
3. **Country filter no longer over-matches.** The 2026-08-03 fix (match country
   against full page text) made short filters false-positive: `us` matched
   "hoUSton". Now uses the same bounded-token match. **Trade-off to know:** a
   2-letter code like `us` will *not* match the words "United States" — the
   filter expects the actual place token to appear. Acceptable for a heuristic.
4. **In-progress scoring now survives a popup reopen.** The checkpoint machinery
   existed in `scoringEngine.js` but nothing consumed it. `popup/index.js` now
   calls `rehydrateScoringStatus()` (`scoringUI.js`) → sends `GET_SCORING_STATUS`
   and restores the progress bar / Stop button. `restoreCheckpoint()` also
   restores the total so it reads "X of Y", not "of 0".
5. **Failed scrape vs genuine 0.** `render.js` shows `⚠️ failed` (amber) when
   `success === false`, distinct from `0% ❌`. "Hide 0%" no longer hides
   failed rows.
6. **Boolean parser: binary `NOT` now works.** Uncovered by the tests: the
   parser only accepted prefix `NOT "x"`, so `"A" NOT "B"` (and the module's
   OWN doc example `"React" AND "AWS" NOT "Intern"`) threw. `parseAnd` in
   `shared/booleanExpression.js` now treats `A NOT B` as `A AND NOT B`.
7. **Hygiene:** `content/extractor.js` broad fallback selector is now scoped to
   a results container (`RESULT_ROOTS`) so it can't scrape nav/sidebar/footer
   `/in/` links; extra location selectors in `pageExtractor.js`; removed stray
   `console.log`s; manifest renamed to "Gazy — LinkedIn Profile Finder", v1.3.0.

**Still open / free to pick up (not touched):**
- Upstream scraping reliability (`pageExtractor.js` + `profileFetcher.js`) —
  the selector changes are *best-effort and unverified* against live LinkedIn
  (no Chrome/LinkedIn in this env). If scores are still 0/failed, this is the
  place. Use the 🔍 debug button to see the first 200 chars scraped.
- `profileFetcher.js` opens one real tab per profile serially — slow and
  visible for large result sets; no rework attempted.
