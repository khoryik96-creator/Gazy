# Handover — remaining work

Prepared 2026-08-26 by session `claude/chrome-extension-architecture-cj7pul`
for the next account/agent to pick up. Current shipped version: **v1.28.0**
(on `main`). Read `COLLAB_NOTES.md` (protocol + status log) and
`ARCHITECTURE.md` (module map) before starting.

## Ground rules (from the owner, non-negotiable)

- **Bump the version on every shipped change** — `package.json` +
  `src/manifest.json` in the SAME semver, then `npm run build` so
  `dist/manifest.json` matches. Patch for fixes, minor for features.
- **Modular, tested, non-regressing.** New logic goes in its own file in the
  right layer (`shared` / `background` / `popup` / `content`). Put pure logic in
  `shared/` and unit-test it. `npm run check` (format, typecheck, lint, build,
  unit tests) must stay green. Prefer additive changes over rewrites.
- **`dist/` is committed** (no-build install). Always `npm run build` before
  committing so the prebuilt output matches source.
- **Content scripts must stay classic** (no ES `import`/`export` in
  `src/content/*` emitted JS) — Chrome loads them as non-module scripts. Use
  ambient types in `src/types/global.d.ts` instead of imports there.
- Coordinate via a `COLLAB_NOTES.md` status-log row before touching a module.

## Environment quick-start

```
npm ci --legacy-peer-deps      # TS 6 is pinned; legacy-peer-deps is required
npm run check                  # the full gate (must be green before commit)
npm run test:e2e               # Playwright; locally set PW_CHROMIUM_PATH to a
                               # FULL Chromium (not headless_shell), e.g.
                               # /opt/pw-browsers/chromium-*/chrome-linux/chrome
```

## 0. Open loose end (needs the OWNER, not code)

**GitHub Actions isn't auto-running on `main` pushes since the repo went
public.** Code is green locally, but no CI run is created for merges. Fix is a
one-time owner toggle: **Settings → Actions → General → "Allow all actions and
reusable workflows"**, and check the Actions tab for an "enable" banner. No code
change; just confirm CI turns green afterward.

---

## Remaining improvement backlog (prioritised)

Each item is independent and low-risk. Suggested order top-to-bottom.

### A. Data safety — Export / Import workspace (JSON) ⭐ recommended next

**Why:** everything (folders, shortlist, scores, AI evals, settings) lives only
in `chrome.storage.local`. A profile reset or reinstall wipes it with no backup.
**What:** an "Export workspace" button that downloads a single JSON of the
relevant storage keys (`profiles`, `profileScores`, `aiEvals`, `shortlist`,
`folders`, `templates`, `aiPrices`, `usdToMyr`, `uiTheme`, `scanPages` — NOT
`aiKey`), and an "Import" that validates + restores it.
**Approach:** pure `shared/workspaceBackup.ts` — `serializeWorkspace(data)` and
`parseWorkspace(json)` (tolerant validator, versioned envelope) with unit tests.
Wire a button in the dashboard toolbar (reuse the export/download pattern in
`dashboard.ts` `exportCsv`/`exportXlsx`). Import shows a confirm before
overwriting. Est: ~half a day.

### B. Interface & accessibility

**Why:** icon-only buttons (☆ star, 🏷 folder, row checkboxes) have no
screen-reader labels; only a few aria/label signals exist. No keyboard shortcuts.
**What:**

1. Add `aria-label`s to icon-only buttons and visible focus rings (CSS
   `:focus-visible`) in `popup.css` / `dashboard.css`.
2. Add manifest `commands` (e.g. open dashboard, focus search) — new
   `background` handler for `chrome.commands.onCommand`.
3. Post-run **run report**: after scoring/AI, show "N scored · M failed" with a
   per-failure reason tooltip. The data is already in `profileScores`
   (`success:false` + `debug`); a small pure summariser in `shared/` + a status
   line in `dashboard.ts`.

**Approach:** mostly HTML/CSS + a pure summariser (testable). Est: ~1 day.

### C. Chrome Web Store readiness (unblocks real distribution)

**Why:** install is currently git-clone + Load Unpacked. The Web Store needs a
privacy policy (mandatory — the tool reads LinkedIn and sends profile text to
DeepSeek), listing copy, and screenshots. The release workflow
(`.github/workflows/release.yml`) already produces the Web-Store-ready zip.
**What:** draft `PRIVACY.md` (what's collected, that the DeepSeek key + all data
stay device-local, what leaves the device and to whom), store description +
screenshots, and a short publishing checklist in `docs/`. Note: some of this is
owner action (creating the Web Store listing, paying the one-time fee).
**Approach:** docs only, no code. Est: ~half a day to draft.

### D. Code health — typed storage accessor

**Why:** storage reads are littered with `as unknown as { ... }` casts (see
`dashboard.ts` `load()`, `aiEvalEngine.ts`, `scoringEngine.ts`) — shape drift
isn't caught.
**What:** a tiny `shared/storage.ts` `getStorage<K>(keys)` typed against a
central `StorageShape` interface, removing the casts. Pure-ish; migrate call
sites incrementally. Est: ~half a day.

### E. Dashboard render efficiency (future scale)

**Why:** every checkbox click calls `render()`, which rebuilds the ENTIRE table.
Fine at ~100 rows; laggy at 500+.
**What:** incremental row updates (toggle a row's class instead of full rebuild),
or virtualization if lists grow large. Lower priority until users hit big lists.
Est: ~1 day.

---

## What was just shipped (context for the above)

- **v1.27.0** (PR #49): dashboard refactor into tested pure modules
  (`dashboard/rows.ts`, `dashboard/removal.ts`), a Playwright dashboard e2e, the
  scraper retry/backoff (`shared/retry.ts`), and the release workflow.
- **v1.28.0** (PR #50): reliability bundle — DeepSeek 429/5xx retry in
  `deepseek.ts`, empty-page diagnostic (`shared/pageDiagnostics.ts` +
  `content/extractor.pageSignals()`), and the dashboard "↻ Retry failed" button
  (`rows.failedScrapeUrls`).

Test suite is at **123 unit tests + 3 e2e**, all green. Reuse the pure-module +
unit-test pattern these established — it's what keeps edits from regressing.
