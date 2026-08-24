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

> ⚠️ **BIG CHANGE (2026-08-20): the repo is now TypeScript with a build step.**
> Source is `src/**/*.ts`; Chrome loads the compiled **`dist/`** folder, not the
> repo root. Run `npm install` then `npm run build` before loading. Edit `.ts`,
> not `.js`. Import specifiers still use `.js` (TS ESM convention). Tests run via
> `npm test` (builds first). `dist/` and `node_modules/` are gitignored. See the
> 2026-08-20 TS-migration entry below and the rewritten `ARCHITECTURE.md`.

> 🔖 **Versioning: bump on every shipped change.** Keep `src/manifest.json` and
> `package.json` in the SAME semver, bumped in the same PR as the change:
> **patch** (x.y.Z) for fixes/tweaks, **minor** (x.Y.0) for a new user-facing
> feature. `npm version <v> --no-git-tag-version` updates package.json + lock;
> hand-edit `src/manifest.json` to match, then `npm run build` so `dist/manifest.json`
> updates too. Current: **1.16.1**.

> 🧱 **Every feature must be modular, efficient, and non-regressing** (owner's
> standing rule, 2026-08-24). New work goes in its OWN file in the right layer
> (`shared` / `background` / `popup` / `content`) per `ARCHITECTURE.md` — don't
> bolt it onto an unrelated file. Put pure logic in `shared/` and unit-test it.
> Reuse existing helpers instead of duplicating. It must NOT break or slow down
> existing features — `npm run check` (typecheck + lint + build + tests) must stay
> green, and prefer additive changes behind a flag/toggle over rewrites. Ship
> big/independent features as their own PR so a regression is easy to isolate.

## Status log

| 2026-08-24 | claude/multi-account-project-rcmfpz | FILE-IMPORT REVIEW FIXES (v1.16.1): PDF gate now BT/Tj/TJ (TJ-only streams no longer dropped); TJ kerning gaps → spaces (words stop merging); skip <<..>> dicts (ActualText no leak); FlateDecode scanned over whole object + /Length bounds stream (ignores indirect); stream regex whole-word (not 'endstream'); readPdfString CR/CRLF continuation; docx drops delText/instrText, tab regex only bare <w:tab/>; sidebar dragleave relatedTarget (no flicker). +tests. | done |
| 2026-08-24 | claude/multi-account-project-rcmfpz | WIDER RAIL + JD FILE DROP (v1.16.0): sidebar widened (380px, bigger inputs/JD box). Drop or attach .txt/.docx/.pdf as the JD. New shared/fileText.ts (pure docxXmlToText/pdf content-stream parser +7 tests) + dashboard/fileImport.ts (zero-dep unzip DOCX + inflate PDF FlateDecode via DecompressionStream). .doc → friendly "save as docx/pdf" msg; scanned PDF → warn. Text lands in the editable JD box. | done |
| 2026-08-24 | claude/multi-account-project-rcmfpz | OPTION A — SIDEBAR CONSOLE DASHBOARD (v1.15.0): dashboard is now a full workspace. New dashboard/sidebar.ts owns criteria (JD/keywords/Boolean/location), templates, settings (theme/pages/aiKey/model) — persists to the SAME storage keys as popup (formData/templates/aiKey/aiModel/uiTheme/scanPages), stays in sync. Search from dashboard runs in a fresh tab (searchSession newTab flag) so the dashboard isn't navigated away; sidebar shows SEARCH_PROGRESS. Two-column layout (sticky rail + results), responsive stack <820px. | done |
| 2026-08-24 | claude/multi-account-project-rcmfpz | BULK SELECT (v1.14.0): dashboard row checkboxes + select-all header (indeterminate), bulk bar → add/remove shortlist, add-to-folder via new openFolderPickMenu (click folder / create), clear. New pure folders.addMembership (idempotent, +test). Selection ephemeral, prunes on data change. | done |
| 2026-08-24 | claude/multi-account-project-rcmfpz | FIX "Failed to start: unknown" (v1.13.1): startScoring/startAiEval no longer awaited across the whole run — split into sync kickoff (throws validation) + detached loop (runScoringLoop/runAiEvalLoop); messaging acks 'started' synchronously. MV3 worker recycling mid-run no longer drops the response (hit on dashboard long AI runs). | done |
| 2026-08-24 | claude/multi-account-project-rcmfpz | FOLDER/VIEW CSV EXPORT (v1.13.0): shared/nameFormat (handleOf/prettyName/nameFromUrl, popup render now reuses it) + shared/candidateExport (buildCandidateRows/Csv/exportFilename, lean cols Name/URL/Score/Location +AI/Folders when present) both tested; dashboard "⬇ Export CSV" button exports the active view (all/shortlist/folder). | done |
| 2026-08-24 | claude/multi-account-project-rcmfpz | LARGE-RUN GUARD (v1.12.1): shared/runGuard(+4 tests, isLargeRun/estimate/largeRunWarning, threshold 25) wired into all 4 Score/AI-Evaluate confirms (popup Score had none before) — warns on time+LinkedIn footprint (score) / API credits (ai) | done |
| 2026-08-24 | claude/multi-account-project-rcmfpz | MULTI-PAGE SCAN (v1.12.0): shared/pagination(+6 tests, pure url/merge/stop logic), background/searchSession (walks &page=N via active tab, randomised nav delays, accumulates union), content now sends PAGE_EXTRACTED (collectProfiles, no self-messaging), popup START_SEARCH + SEARCH_PROGRESS + "Pages to scan" setting (default/max 10, key `scanPages`). Fixes page-1-only extraction. | done |
| 2026-08-24 | claude/multi-account-project-rcmfpz | DASHBOARD SCORE BTN (v1.11.0): ⭐ Score button beside AI Evaluate on dashboard — reuses shared getScoringKeywords + background scoringEngine, reads stored formData, acts on active view, live status via SCORING_PROGRESS/COMPLETE + storage.onChanged | done. NOTE: extraction still page-1 only (LinkedIn paginates ~10/page) — multi-page follow-up pending user decision on scan depth. |
| 2026-08-24 | claude/multi-account-project-rcmfpz | SHORTLIST FOLDERS (v1.10.0): shared/folders(+12 tests, pure multi-tag store), dashboard/folderMenu (assign popover), dashboard folder bar/chips/column, rename+delete, storage key `folders`, live storage.onChanged sync; additive over flat shortlist | done |
| 2026-08-24 | claude/multi-account-project-rcmfpz | DASHBOARD AI EVAL (v1.9.0): AI-Evaluate button on full-tab dashboard — reuses background aiEvalEngine, reads stored aiKey/aiModel/formData, evaluates all/shortlist tab, live status + storage.onChanged render | done |
| 2026-08-24 | claude/multi-account-project-rcmfpz | THEMES: popup.css+dashboard.css tokenized, shared/themes(+test), popup/themeManager, render classes, settings picker; retired dark toggle | done (unmerged) |

| Date       | Branch                                      | Scope                                                                                                                                | Status          |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 2026-08-03 | claude/multi-account-project-rcmfpz         | popup/templates.js, background/scoring.js                                                                                            | merged (PR #2)  |
| 2026-08-14 | claude/multi-account-project-rcmfpz         | scoring, scoringEngine, popup render/csv/scoringUI, content/extractor, pageExtractor, shared/booleanExpression, test/                | merged (PR #3)  |
| 2026-08-20 | claude/multi-account-project-rcmfpz         | shared/constants, shared/timing (new), background/scoringEngine, background/profileFetcher, test/                                    | merged (PR #4)  |
| 2026-08-20 | claude/multi-account-project-rcmfpz         | ENTIRE REPO — TypeScript migration (all src/*.ts, tsconfig, build)                                                                   | merged (PR #5)  |
| 2026-08-21 | claude/chrome-extension-architecture-cj7pul | tooling: ESLint + typescript-eslint, CI workflow, TS pin 6.0.x, lint-driven fixes across src/                                        | merged (PR #6)  |
| 2026-08-21 | claude/chrome-extension-architecture-cj7pul | tooling round 2: Prettier, Husky pre-push, Playwright e2e (e2e/), icons (src/icons + gen script), Dependabot, build.mjs copy fix     | merged (PR #6)  |
| 2026-08-21 | claude/chrome-extension-architecture-cj7pul | popup/scoringUI (Boolean pre-validation), test/booleanExpression                                                                     | merged (PR #11) |
| 2026-08-21 | claude/chrome-extension-architecture-cj7pul | pageExtractor (login detection), committed prebuilt dist/, .gitignore/.gitattributes, README install                                 | merged (PR #11) |
| 2026-08-21 | claude/chrome-extension-architecture-cj7pul | content/autoscroll (dup-extract fix), shared/csv (new, injection-safe) + csvExport, scoring/scoringEngine (compile rule once), test/ | done (unmerged) |
| 2026-08-21 | claude/multi-account-project-rcmfpz         | background/scoring (coverage-based rewrite), test/scoring                                                                            | done (unmerged) |
| 2026-08-21 | claude/multi-account-project-rcmfpz         | AI eval (DeepSeek): shared/aiEvaluation, background/deepseek+aiEvalEngine, popup settings/aiEvalUI, manifest host perm, test/        | done (unmerged) |
| 2026-08-24 | claude/multi-account-project-rcmfpz         | shortlist (popup/shortlist, render/csv/dom/html), COLLAB rule                                                                        | merged (PR #20) |
| 2026-08-24 | claude/multi-account-project-rcmfpz         | dashboard (src/dashboard/*, shared/scoreView, popup button, build copy)                                                              | done (unmerged) |

### 2026-08-21 — correctness bug fixes, round 3 (branch `claude/chrome-extension-architecture-cj7pul`)

From a correctness review of the extension logic. All behaviour-preserving except
where noted; `npm run check` green.

1. **Invalid Boolean rule no longer fails the whole run** (PR #11). Unquoted
   `React AND AWS`, trailing operators, unbalanced parens used to make
   `computeScore` throw for _every_ profile (all rows "⚠️ failed"). The popup now
   validates once with `compileBooleanRule` before starting; the engine also
   compiles once up front (round 3) as a backstop.
2. **Login detection tightened** (PR #11). `pageExtractor` no longer treats any
   `.login` class as an auth wall (could false-positive on real profiles); keys
   off the auth-wall URL or the `session_password` field. **Unverified against
   live LinkedIn** — flag if scraping regresses.
3. **No-build install** (PR #11). Prebuilt `dist/` is committed (un-ignored,
   `linguist-generated`). Rebuild + commit `dist/` when you change `src/`.
4. **autoscroll double-extraction fixed** (round 3). A fallback timer could run
   extraction a second time (duplicate `EXTRACTION_ERROR` on empty results); it's
   now cancelled once the scroll loop extracts, guarded by an `extracted` flag.
5. **CSV formula-injection guard** (round 3). New pure `shared/csv.ts`
   (`csvField`/`toCsv`, unit-tested) prefixes `= + - @`-leading fields with `'`
   so a crafted name can't execute as a spreadsheet formula. `csvExport.ts` uses it.
6. **Boolean rule compiled once per run** (round 3). `computeScore`'s 3rd arg now
   accepts `string | RuleEvaluator`; the engine passes a compiled evaluator so the
   rule is parsed once, not once per profile. String callers (tests) unchanged.

### 2026-08-21 — dev-experience tooling round 2 (branch `claude/chrome-extension-architecture-cj7pul`)

Five additions on top of the lint/CI work, no behaviour change to the extension:

1. **Prettier** (`.prettierrc.json`) + `eslint-config-prettier` (last in the flat
   config so formatting is Prettier's alone). Scripts `format` / `format:check`;
   `format:check` is now the first step of `check`. Whole repo reformatted once.
2. **Husky `pre-push`** runs `npm run check` before any push. `prepare` script is
   `husky || true` (won't break installs where husky is absent).
3. **Playwright smoke test** in `e2e/popup.spec.js` — loads the built `dist/` as a
   real extension, asserts the popup renders its controls with no JS error. Script
   `test:e2e` (build + playwright). Kept OUT of the fast `check` gate; runs as its
   own CI job. Locally needs a full Chromium via `PW_CHROMIUM_PATH` (headless_shell
   can't load extensions). Plus `docs/QA_CHECKLIST.md` for the live-LinkedIn manual
   pass that can't be automated.
4. **Icons** generated from code — `scripts/gen-icons.mjs` (zero-dep PNG encoder)
   writes `src/icons/icon{16,48,128}.png`; manifest now has `icons` +
   `action.default_icon`; `build.mjs` copies `src/icons` → `dist/icons`. Script
   `icons` regenerates. **Note:** `build.mjs`'s asset copy now passes
   `{ recursive: true }` so directory assets copy (was file-only).
5. **Dependabot** (`.github/dependabot.yml`) — weekly npm + github-actions updates,
   lint/format tools grouped into one PR. This is what will surface typescript-eslint
   gaining TS 7 support (→ un-pin TypeScript then).

Cross-cutting files: `package.json` (scripts+devDeps), `eslint.config.js`,
`scripts/build.mjs`, `src/manifest.json`, `.gitignore`, `.prettierignore`. src/
itself only changed via the one-time Prettier reformat.

### 2026-08-21 — linting + CI (branch `claude/chrome-extension-architecture-cj7pul`)

Added ESLint (flat config) with typescript-eslint's **type-checked** rule set,
plus a GitHub Actions workflow. New scripts: `npm run lint`, `lint:fix`, and
`check` (typecheck + lint + build + test — the CI gate). `npm test` now aliases
`check`.

- **TypeScript pinned to `~6.0.3`** (was `^7.0.2`). typescript-eslint hard-refuses
  to load under the TS 7 native compiler (it needs the compiler's JS type API,
  which the Go rewrite doesn't expose yet — tracked in typescript-eslint#10940
  for TS 7.1+). TS 6.0.x is the last JS-based release and sits in the linter's
  supported range. Build + typecheck are byte-for-byte unaffected. **Install now
  needs `--legacy-peer-deps`** (the pin trips typescript-eslint's peer range);
  CI passes the flag too. Revert to TS 7 is a one-line bump once the linter
  supports it.
- **36 lint findings fixed across the popup/background/content modules**, no
  behaviour change. Overwhelmingly `no-floating-promises` on fire-and-forget
  `chrome.*` calls (now explicit `void`), `no-misused-promises` on async event
  listeners (now `() => void fn()`), and a handful of loosely-typed message-field
  concatenations (`unknown` → explicit cast). Details in the diff.
- **Scope note for other agents:** the only cross-cutting change is `package.json`
  (deps/scripts) + new `eslint.config.js` + `.github/workflows/ci.yml`. The src/
  edits are mechanical lint fixes, one idiom repeated. If you have an in-flight
  branch, rebasing should be clean apart from `package.json`/lock.

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
   2-letter code like `us` will _not_ match the words "United States" — the
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
  the selector changes are _best-effort and unverified_ against live LinkedIn
  (no Chrome/LinkedIn in this env). If scores are still 0/failed, this is the
  place. Use the 🔍 debug button to see the first 200 chars scraped.

### 2026-08-20 — anti-detection scraping pace (branch `claude/multi-account-project-rcmfpz`)

The scraper used fixed delays end to end (2s scrape settle, 3s between batches,
3-tab batches), i.e. a near-zero-variance, bursty cadence that's easy for
LinkedIn's anti-automation to fingerprint. Reworked to randomised, sequential
pacing:

- New `shared/timing.js` — `randomDelayMs(min, max)` (inclusive, order-tolerant)
  - `sleep(ms)`. Pure; covered by `test/timing.test.js`.
- `shared/constants.js` — `BATCH_SIZE` 3 → **1** (no simultaneous-tab bursts);
  replaced `SCORING_DELAY_MS` with a `SCORING_DELAY_MIN/MAX_MS` range (3–9s);
  added `SCRAPE_DELAY_MIN/MAX_MS` (1.5–4s) and `RETRY_DELAY_MIN/MAX_MS` (3–6s).
- `scoringEngine.js` between-profile gap and `profileFetcher.js` scrape-settle
  and retry backoff all now draw from those ranges.

Trade-off: **slower** (sequential + jitter — a 30-profile run goes from ~1 min
to a few minutes). Caveats to remember: no timing change makes scraping
_undetectable_ (account-level volume still matters — keep runs modest), and this
cuts against LinkedIn's automation ToS. Ranges are plain constants in
`shared/constants.js` if anyone wants to tune them; a popup control to tune them
live was discussed but not built.

### 2026-08-20 — TypeScript migration (branch `claude/multi-account-project-rcmfpz`)

Migrated the whole extension from plain JS ES modules to **TypeScript**. This is
a repo-wide change and it removes the old "no build step" property.

**What changed**

- All 30 `src/**/*.js` → `.ts`, fully typed under `strict`. Domain types live in
  `src/shared/types.ts` (`ProfilePageData`, `ScoreEntry`, `ScoresMap`,
  `ScoringRequest`, `Template`, `RuntimeMessage`, `ScoringStatus`).
- `tsconfig.json` — target ES2020, module ESNext, `moduleResolution: bundler`,
  `rootDir: src`, `outDir: dist`, strict + `noUnused*`.
- `scripts/build.mjs` — runs `tsc` then copies `manifest.json`, `popup.html`,
  `popup.css` into `dist/`. Wired as `npm run build`.
- `manifest.json` moved to `src/manifest.json` with **dist-relative** paths
  (`background/index.js`, `popup/popup.html`, `content/*.js`).
- `src/types/global.d.ts` — ambient `window.__gazy` typing for the content
  scripts (which stay classic, non-module scripts — verified: `dist/content/*.js`
  contain no `import`/`export`).
- Tests import from **`dist/`** now (not `src/`); `npm test` builds first. 23
  tests still green. Added `test/timing.test.js`.
- `.gitignore` for `dist/` and `node_modules/`; committed `package-lock.json`.

**Gotchas for the next agent**

- Edit `.ts`, then `npm run build` — loading stale `dist/` is the #1 "my change
  didn't show up" trap.
- Import specifiers use `.js` even though files are `.ts` (e.g.
  `import { computeScore } from './scoring.js'`). tsc leaves them as-is.
- Import interfaces with `import type { … }` so they don't become runtime deps.
- Content scripts must stay import/export-free or they'd become ES modules and
  break injection. Communicate via `window.__gazy` (typed in `types/global.d.ts`).
- `pageExtractor.ts`'s `extractProfilePageData` is still serialized into the page
  by `executeScript` — keep it self-contained, no imports/closures.
- `@types/chrome` here renames some members (e.g. no `chrome.tabs.TabChangeInfo`)
  — `profileFetcher.ts` uses a structural `{ status?: string }` type instead.

**Not done:** no TS migration of the `test/` files themselves (they're plain JS
importing compiled JS — fine as is); no bundler/minifier (unnecessary for MV3
native ESM); still no CI (env can't run it).

### 2026-08-21 — scoring accuracy: coverage over frequency (branch `claude/multi-account-project-rcmfpz`)

Human reported scores felt "super inaccurate." Root cause in `background/scoring.ts`
`computeScore`: the keyword score summed **raw occurrences** of all keywords
(`matchCount / (n*3)`), so a profile repeating ONE skill many times could beat a
profile that actually had all the searched skills. It also scored over the whole
`fullText` (includes "people also viewed" etc.).

Rewrote the math to be **coverage-first** (same signature, still accepts
`string | RuleEvaluator` for the compiled-rule optimisation; gates unchanged):

- **coverageScore (0–80)** = fraction of _distinct_ keywords that appear at least
  once × 80. This is now the dominant term — "how many of the searched skills
  does this person have."
- **titleBonus (0–12)** = matched keywords (>3 chars) that also appear in the
  headline × 6, capped.
- **expBonus (0–8)** = plausible years-of-experience tier (3–10y best).
- final = round(min(100, coverage + title + exp)). Full coverage lands ~80–100.

New tests in `test/scoring.test.js` lock it: a broad match beats keyword-spam, and
more distinct skills ⇒ higher score. `npm run check` green (30 tests).

**Still NOT fixed (needs scraper work, flagged for pickup):** scoring still reads
the whole page (`fullText`), so words from other people's cards on the profile
page still count. The real fix is limiting `pageExtractor.ts` to the person's own
sections — unverified against live LinkedIn, left alone. Also JD keyword
extraction is still frequency-based (top-8 words); coverage tolerates the noise
better but better keyword derivation is a separate follow-up.

### 2026-08-21 — optional AI evaluation via DeepSeek (branch `claude/multi-account-project-rcmfpz`)

Human wanted profiles evaluated by an AI provider (they use DeepSeek) for better
judgement than the keyword/coverage score. Added an **optional, opt-in** layer —
the free keyword score is untouched and remains the default.

- **Bring-your-own key.** New ⚙️ settings panel in the popup: DeepSeek API key
  (stored in `chrome.storage.local`, device-only) + two mutually-exclusive
  toggles — ⚡ Fast (`deepseek-chat`) / 🧠 Smarter (`deepseek-reasoner`).
- **"✨ AI Evaluate" button** sends the extracted profiles + the JD/keywords to
  DeepSeek's OpenAI-compatible endpoint; each row gets a purple `✨NN%` plus a 💡
  button showing the reason + matched/missing skills.
- **Pure, tested core:** `shared/aiEvaluation.ts` (`buildEvaluationMessages`,
  `parseEvaluationResponse` — tolerant JSON extraction + score clamp), 6 tests.
- **Background:** `deepseek.ts` (fetch, `response_format: json_object`),
  `aiEvalEngine.ts` (sequential loop; reuses `fetchProfileData` cache so no extra
  LinkedIn hits after a scoring run). New `AI_EVALUATE` / `AI_EVAL_PROGRESS` /
  `AI_EVAL_COMPLETE` messages.
- **Manifest:** added `https://api.deepseek.com/*` host permission.

**Caveats (documented, not fixed):** end-to-end path is **UNVERIFIED** — needs a
real DeepSeek key + live LinkedIn page (no browser/network here). Profile text is
sent to DeepSeek (third-party) — a privacy consideration for candidate data.
Cost is per-call on the user's key; the button confirms count first. Evaluation
reads the same whole-page `fullText` as scoring, so scrape quality still bounds it.

### 2026-08-24 — shortlist + full-page dashboard (branch `claude/multi-account-project-rcmfpz`)

Two owner-requested features, each additive and isolated (per the modularity rule).

1. **Shortlist** (PR #20, v1.5.0). `popup/shortlist.ts` owns a Set of starred
   profile URLs persisted in `chrome.storage.local` under `shortlist`, independent
   of search results. ⭐/☆ per row, a "⭐ Shortlist only" filter, and a CSV
   "Shortlisted" column. render/csv just call the module — no duplicated logic.

2. **Dashboard** (v1.6.0). New `src/dashboard/{dashboard.html,css,ts}` — a full
   browser tab opened by the popup's ⤢ button via
   `chrome.tabs.create(chrome.runtime.getURL('dashboard/dashboard.html'))`. Reads
   the same storage (profiles/scores/aiEvals/shortlist) and shows a sortable table
   with two tabs (All results / Shortlist). Star toggles write back to storage and
   a `chrome.storage.onChanged` listener keeps it live-synced with the popup.
   - `scoreEntry` moved to **`shared/scoreView.ts`** so popup AND dashboard read
     scores identically; `popup/scores.ts` now just re-exports it (render/csvExport
     imports unchanged — no regression).
   - `build.mjs` copies the dashboard html/css into `dist/dashboard/`. No new
     manifest permission needed (extension pages open in a tab as-is).

### 2026-08-24 — theme system: Ledger / Beacon / Nocturne (branch `claude/multi-account-project-rcmfpz`)

Turned the three UI-direction comps into real, switchable themes. Token-based so
it's additive to layout (no structural rewrite).

- **`shared/themes.ts`** (pure, unit-tested): `UI_THEMES` (ledger/beacon/nocturne),
  `normalizeUiTheme`, labels, `DEFAULT_UI_THEME='ledger'`.
- **`popup.css` + `dashboard.css` fully tokenized**: base `body` block = Ledger
  tokens; `body[data-theme="beacon"|"nocturne"]` override only the tokens. Every
  component reads `var(--…)`. All the old `body.dark` rules are gone (Nocturne is
  the dark theme now).
- **`popup/themeManager.ts`** replaces `theme.ts`: reads `uiTheme` from storage,
  sets `document.body.dataset.theme`, and drives a **Theme picker in ⚙️ settings**.
  The old 🌙 light/dark toggle + `theme` storage key are retired (the picker
  supersedes them; `normalizeUiTheme` treats the stale `'dark'` value as default).
- **`render.ts`**: score/AI spans now use CSS classes (`score-good/zero/fail`,
  `profile-ai[.err]`) instead of inline hex, so they follow the theme.
- **Dashboard** reads the same `uiTheme` and applies `data-theme`; a
  `chrome.storage.onChanged` on `uiTheme` keeps it live-synced with the popup.
- Fonts are system stacks (extension CSP can't reliably load web fonts); theme
  identity is colour + accent + radius. Real Google-font faces could be bundled
  later if wanted. v1.7.0.

### 2026-08-24 — popup visual overhaul (branch `claude/multi-account-project-rcmfpz`)

The v1.7 theme pass only swapped colours on the old cramped layout, so it looked
barely different. This is the real structural redesign (approved from a preview),
Beacon set as the default theme.

- **Restructured `popup.html`**: brand header (mark + subtitle) with icon buttons,
  uppercase micro-labels, a two-up Boolean/Location row, an action bar, pill
  action buttons (Score/AI/CSV/Copy), filter chips (`:has(input:checked)`), and a
  status footer. **All element IDs preserved** so the JS wiring is unchanged.
- **`render.ts` rows are now candidate cards**: avatar (initials), a prettified
  name (slug → "Sarah Chen", id-ish tokens dropped) + meta line (location/handle),
  keyword % + ✦AI as chips, a shortlist star, and mini row-actions. Selectors in
  `wireResultRowActions` renamed to match (`.starbtn`, `.iconmini.*`).
- **`popup.css` rewritten** as component styles over the token system; card/pill/
  chip look. Beacon token values refined (weak tints for chips, 16px radius).
- `shared/themes.ts`: `DEFAULT_UI_THEME = 'beacon'`.
- Shortened Score/AI button labels to fit pills (scoringUI/aiEvalUI).
- Still system fonts (extension CSP). Dashboard unchanged this PR — could get the
  same card polish next. v1.8.0.
