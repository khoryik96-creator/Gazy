# Architecture

Manifest V3 Chrome extension written in **TypeScript**. The background service
worker and popup use native ES modules (`import`/`export`); content scripts are
classic scripts (Chrome doesn't support declaring `content_scripts` as modules),
split into files loaded in order and namespaced on `window.__gazy`.

`tsc` compiles `src/**/*.ts` → `dist/`, and `scripts/build.mjs` copies the
non-TS assets (`manifest.json`, `popup.html`, `popup.css`) alongside. **Chrome
loads `dist/`, not the repo root.** Run `npm run build` after editing any `.ts`.

```
tsconfig.json     ESNext modules, bundler resolution, strict
scripts/build.mjs tsc + copy manifest/html/css into dist/
src/
  manifest.json   paths are dist-relative to compiled JS (e.g. "background/index.js")
  types/          global.d.ts — ambient window.__gazy for content scripts
  background/     service worker (type: module)
  popup/          popup UI (type: module, loaded from popup.html)
  content/        content scripts injected into linkedin.com search pages
  shared/         pure logic + types used by more than one context
test/             Node (node:test) unit tests, run against compiled dist/
dist/             build output — gitignored, this is the folder you Load Unpacked
```

**Import specifiers use `.js`, not `.ts`** (e.g. `import … from './scoring.js'`).
That's the TypeScript ESM convention: the source path is `.ts`, but the _emitted_
file is `.js`, and tsc leaves the specifier untouched so it resolves at runtime.

**Import types with `import type { … }`** from `shared/types.ts` so the import is
erased at compile time and never becomes a runtime dependency.

Pure modules (`shared/*`, `background/scoring.ts`) are unit-tested with the
built-in Node test runner — `npm test` builds first, then runs `node --test`
against `dist/`. When you change scoring, keyword extraction, the Boolean parser,
or the timing helpers, add or update a test in `test/`; these are the modules
where a regression is invisible until a recruiter notices every profile scoring
wrong.

## Module boundaries

- **`shared/`** — framework-agnostic, no `chrome.*` calls. `constants.ts`
  (message types, tunables), `keywordExtraction.ts` (stopwords, JD/boolean
  keyword parsing), `booleanExpression.ts` (the Boolean-filter parser).
  Imported by both `background/` and `popup/` so scoring keyword logic can't
  drift between the two — it used to be copy-pasted in both files.
- **`background/`** — one file per responsibility: `cache.ts` (TTL cache),
  `pageExtractor.ts` (the function injected into scraped tabs — must stay a
  pure, self-contained function since it's serialized by
  `chrome.scripting.executeScript`), `profileFetcher.ts` (open tab → scrape →
  close tab), `scoring.ts` (pure scoring math), `scoringEngine.ts` (batch loop
  - state + progress messages), `messaging.ts` (the single
    `chrome.runtime.onMessage` router — the only file that should call
    `addListener`).
- **`popup/`** — `dom.ts` is the only file that touches `document.getElementById`;
  everything else imports element refs from it. `state.ts` is the single
  mutable source of truth for popup UI state. Each feature (`templates.ts`,
  `formData.ts`, `theme.ts`, `csvExport.ts`, `searchUI.ts`, `scoringUI.ts`)
  owns its own DOM wiring and storage keys. `messages.ts` is the only
  `chrome.runtime.onMessage` listener, and just dispatches to the feature
  modules' `handle*Message` functions.
- **`content/`** — `extractor.ts` (DOM scraping + dedup), `autoscroll.ts`
  (scroll-to-load-more UI), `index.ts` (bootstrap + message listener).

## Adding a new feature without breaking existing ones

1. **Pick the layer it belongs to** (background logic, popup UI, content-page
   scraping, or shared pure logic) and give it its own file in that
   directory — don't bolt it onto an existing file unless it's genuinely the
   same responsibility.
2. **New message types** go in `shared/constants.ts`'s `MESSAGE` object, and
   get one `case` in `background/messaging.ts` and/or one `handle*Message`
   function wired into `popup/messages.ts`. Never add a second
   `chrome.runtime.onMessage.addListener` — route through the existing ones.
3. **New popup UI state** goes in `popup/state.ts`, not a new global.
4. **Anything used by both background and popup** (parsing, scoring math,
   constants) belongs in `shared/`, not duplicated.
5. Keep `background/pageExtractor.ts` free of imports/closures — it's
   serialized into the scraped page verbatim and can't reference outer scope.

This isolation means, e.g., changing the CSV export format only touches
`popup/csvExport.ts`, and changing the scoring formula only touches
`background/scoring.ts` — neither can accidentally break search, templates,
or theming.

## Known bugs fixed during this restructure

- CSV export built literal `"\\n"` text instead of real newlines.
- `evaluateBoolean` used `new Function(...)` to run rules, which MV3's CSP
  disallows (`unsafe-eval` isn't permitted) and which also broke on any
  quoted keyword containing the literal substring `AND`/`OR`/`NOT` (e.g.
  `"Brand"`) due to blind string replacement. Replaced with a real tokenizer
  - recursive-descent parser in `shared/booleanExpression.ts`.
- `profileFetcher.ts` closed the scraped tab (`chrome.tabs.remove`) _before_
  running the scraping script against it, so scraping almost always failed.
  The tab is now only closed after scraping finishes (success, error, or
  timeout).
- Scoring progress now checkpoints to `chrome.storage.session` so a popup
  reopened after the service worker is recycled mid-run reflects reality
  instead of silently showing "not running".
