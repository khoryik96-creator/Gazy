# Architecture

Manifest V3 Chrome extension, no build step — the background service worker and
popup use native ES modules (`import`/`export`); content scripts are classic
scripts (Chrome doesn't support declaring `content_scripts` as modules), split
into files loaded in order and namespaced on `window.__gazy`.

```
manifest.json
src/
  background/   service worker (type: module)
  popup/        popup UI (type: module, loaded from popup.html)
  content/      content scripts injected into linkedin.com search pages
  shared/       pure logic used by more than one context
```

## Module boundaries

- **`shared/`** — framework-agnostic, no `chrome.*` calls. `constants.js`
  (message types, tunables), `keywordExtraction.js` (stopwords, JD/boolean
  keyword parsing), `booleanExpression.js` (the Boolean-filter parser).
  Imported by both `background/` and `popup/` so scoring keyword logic can't
  drift between the two — it used to be copy-pasted in both files.
- **`background/`** — one file per responsibility: `cache.js` (TTL cache),
  `pageExtractor.js` (the function injected into scraped tabs — must stay a
  pure, self-contained function since it's serialized by
  `chrome.scripting.executeScript`), `profileFetcher.js` (open tab → scrape →
  close tab), `scoring.js` (pure scoring math), `scoringEngine.js` (batch loop
  + state + progress messages), `messaging.js` (the single
  `chrome.runtime.onMessage` router — the only file that should call
  `addListener`).
- **`popup/`** — `dom.js` is the only file that touches `document.getElementById`;
  everything else imports element refs from it. `state.js` is the single
  mutable source of truth for popup UI state. Each feature (`templates.js`,
  `formData.js`, `theme.js`, `csvExport.js`, `searchUI.js`, `scoringUI.js`)
  owns its own DOM wiring and storage keys. `messages.js` is the only
  `chrome.runtime.onMessage` listener, and just dispatches to the feature
  modules' `handle*Message` functions.
- **`content/`** — `extractor.js` (DOM scraping + dedup), `autoscroll.js`
  (scroll-to-load-more UI), `index.js` (bootstrap + message listener).

## Adding a new feature without breaking existing ones

1. **Pick the layer it belongs to** (background logic, popup UI, content-page
   scraping, or shared pure logic) and give it its own file in that
   directory — don't bolt it onto an existing file unless it's genuinely the
   same responsibility.
2. **New message types** go in `shared/constants.js`'s `MESSAGE` object, and
   get one `case` in `background/messaging.js` and/or one `handle*Message`
   function wired into `popup/messages.js`. Never add a second
   `chrome.runtime.onMessage.addListener` — route through the existing ones.
3. **New popup UI state** goes in `popup/state.js`, not a new global.
4. **Anything used by both background and popup** (parsing, scoring math,
   constants) belongs in `shared/`, not duplicated.
5. Keep `background/pageExtractor.js` free of imports/closures — it's
   serialized into the scraped page verbatim and can't reference outer scope.

This isolation means, e.g., changing the CSV export format only touches
`popup/csvExport.js`, and changing the scoring formula only touches
`background/scoring.js` — neither can accidentally break search, templates,
or theming.

## Known bugs fixed during this restructure

- CSV export built literal `"\\n"` text instead of real newlines.
- `evaluateBoolean` used `new Function(...)` to run rules, which MV3's CSP
  disallows (`unsafe-eval` isn't permitted) and which also broke on any
  quoted keyword containing the literal substring `AND`/`OR`/`NOT` (e.g.
  `"Brand"`) due to blind string replacement. Replaced with a real tokenizer
  + recursive-descent parser in `shared/booleanExpression.js`.
- `profileFetcher.js` closed the scraped tab (`chrome.tabs.remove`) *before*
  running the scraping script against it, so scraping almost always failed.
  The tab is now only closed after scraping finishes (success, error, or
  timeout).
- Scoring progress now checkpoints to `chrome.storage.session` so a popup
  reopened after the service worker is recycled mid-run reflects reality
  instead of silently showing "not running".
