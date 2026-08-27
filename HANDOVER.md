# Handover — status & next steps

Prepared by session `claude/chrome-extension-architecture-cj7pul`.
Current shipped version: **v1.29.1** (on `main`). Read `COLLAB_NOTES.md`
(protocol + full status log) and `ARCHITECTURE.md` (module map) before starting.

**The improvement backlog (A–E) is fully cleared** — see "Completed" below.
What remains needs the **owner**, not code.

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

## Open items (need the OWNER, not code)

1. **Chrome Web Store submission.** The code, privacy policy, listing copy, and
   the publishing checklist are all ready — see `PRIVACY.md`,
   `docs/STORE_LISTING.md`, and `docs/PUBLISHING.md`. Owner steps: create a Web
   Store developer account, **fill in the contact-email placeholder in
   `PRIVACY.md`**, host that policy at a public URL, take 1–5 screenshots, tag a
   release (`git tag vX.Y.Z && git push origin vX.Y.Z` → `release.yml` builds the
   upload zip), and submit.

2. **(If it recurs) CI on `main`.** Earlier, GitHub briefly stopped auto-running
   Actions after the repo went public; it recovered and runs are green again. If
   it ever stops creating runs on a push, the fix is a one-time toggle:
   **Settings → Actions → General → "Allow all actions and reusable workflows"**.

## Completed (backlog A–E, all merged)

- **A. Workspace backup** (v1.29.0, PR #52) — `shared/workspaceBackup.ts` +
  dashboard Backup/Restore. Excludes the API key. +7 tests, +1 e2e.
- **B. A11y + keyboard shortcut + run report** (v1.29.0) — aria-labels +
  `:focus-visible`; manifest `commands` open-dashboard (Ctrl/Cmd+Shift+G) via
  `background/commands.ts`; `shared/runReport.ts` "Scored N · M failed". +4 tests.
- **C. Web Store readiness** (docs) — `PRIVACY.md`, `docs/STORE_LISTING.md`,
  `docs/PUBLISHING.md`.
- **D. Typed storage** — `shared/storage.ts` (`StorageShape` + `getStorage`/
  `setStorage`); removed every `as unknown as` storage cast; `RemovedSnapshot`
  moved to `shared/types.ts`.
- **E. Render efficiency** (v1.29.1) — selection toggles repaint only changed
  rows (`refreshSelectionUI` + `rowEls`) instead of rebuilding the table.

Earlier context: **v1.27.0** (PR #49) dashboard refactor into tested pure
modules, scraper retry, and the release workflow; **v1.28.0** (PR #50) DeepSeek
429/5xx retry, empty-page diagnostic, and the "Retry failed" button.

## Where the code lives (quick map)

- Pure, unit-tested logic → `src/shared/` (rows/removal live in `src/dashboard/`
  but are pure). Tests in `test/**.test.js` run against the built `dist/`.
- Background service worker → `src/background/` (messaging, scoring/AI engines,
  scraper, search session, commands).
- UIs → `src/popup/` and `src/dashboard/` (the dashboard is the full workspace).

Test suite: **134 unit tests + 4 e2e**, all green. Reuse the pure-module +
unit-test pattern — it's what keeps edits from regressing.

## Ideas for future work (not started, owner's call)

- Per-failure reason surfacing in the run report (tooltip from `profileScores`
  `debug`).
- "Test key" button for the DeepSeek key in settings.
- Virtualised candidate table if lists ever grow into the thousands.
- Broaden e2e coverage (folder assign/rename, restore round-trip, retry-failed
  actually re-scoring).
