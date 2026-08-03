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
| 2026-08-03 | claude/multi-account-project-rcmfpz     | popup/templates.js, background/scoring.js | done (unmerged) |

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
