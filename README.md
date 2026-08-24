# Gazy — LinkedIn Profile Finder

Chrome (Manifest V3) extension: extracts LinkedIn people-search results, scores
them against a job description / keywords / Boolean rule, and exports to CSV.

Written in **TypeScript**. There is a compile step — Chrome loads the compiled
JavaScript in `dist/`, not the `src/` TypeScript.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the module layout and conventions
to follow when adding new features.

## Install (no build required)

A prebuilt copy lives in **`dist/`**, so you don't need Node or a build step just
to use the extension.

**Recommended — clone once, then update in place (no re-downloading).** If you
install by cloning the repo, staying current is a one-click pull instead of a
fresh download + unzip every time (see "Staying up to date" below):

1. Install **Git** (GitHub Desktop is the easy GUI: <https://desktop.github.com>).
2. Clone `khoryik96-creator/Gazy` to a permanent folder (e.g. `Documents\Gazy`).
3. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select
   the **`dist/`** folder inside the clone. Do this **once**.
4. Open the popup on `linkedin.com`, paste a job description or keywords, and
   click **Search LinkedIn**.

**Or just download once:** green **Code → Download ZIP**, unzip, and Load unpacked
the **`dist/`** subfolder (the one containing `manifest.json`).

> Loading the top-level folder gives "Manifest file is missing or unreadable" —
> pick the `dist/` subfolder.

## Staying up to date (no re-downloading)

Because `dist/` is committed, getting a new version is just pulling the repo — no
ZIP, no extraction, and Chrome keeps the extension registered from the same folder.

- **Easiest:** double-click **`update.bat`** (Windows) or run **`./update.sh`**
  (macOS/Linux) in the folder. It pulls the latest and reminds you what to do next.
- **GitHub Desktop:** click **Fetch/Pull origin**.
- **Command line:** `git pull` in the folder.

Then, in Chrome (~10 seconds): open `chrome://extensions`, click the **↻ reload**
icon on the Gazy card, and refresh your LinkedIn tab. That reload is the one step
Chrome can't skip for a locally-loaded extension.

## Develop (build from source)

Written in **TypeScript**; Chrome loads the compiled JS in `dist/`, not `src/`.

```
npm install --legacy-peer-deps   # one-time (see TypeScript note below for the flag)
npm run build                    # compiles src/ (TypeScript) → dist/
```

Re-run `npm run build` after changing any `src/**/*.ts` (or `npx tsc --watch`),
then hit the reload icon on the extension card. **Commit the rebuilt `dist/`** so
the no-build install above stays current.

## Scripts

| Command                | What it does                                             |
| ---------------------- | -------------------------------------------------------- |
| `npm run build`        | Compile TS and copy assets (+ icons) into `dist/`        |
| `npm run icons`        | Regenerate the PNG icons from `scripts/gen-icons.mjs`    |
| `npm run typecheck`    | Type-check only, no output (`tsc --noEmit`)              |
| `npm run lint`         | Lint with ESLint + typescript-eslint (type-checked)      |
| `npm run lint:fix`     | Lint and auto-fix what it can                            |
| `npm run format`       | Format the repo with Prettier                            |
| `npm run format:check` | Check formatting without writing                         |
| `npm run check`        | format + typecheck + lint + build + unit tests (CI gate) |
| `npm test`             | Alias for `npm run check`                                |
| `npm run test:e2e`     | Build, then run the Playwright popup smoke tests         |
| `npm run clean`        | Remove `dist/`                                           |

Formatting is Prettier's job and linting is ESLint's; `eslint-config-prettier`
keeps them from fighting. A Husky `pre-push` hook runs `npm run check` before any
push, so failures surface locally, not just in CI.

> **TypeScript version:** pinned to 6.0.x on purpose. typescript-eslint does not
> yet support the TS 7 native compiler, so type-checked linting needs TS 6. Because
> of that peer-range mismatch, install with `npm install --legacy-peer-deps`. Once
> typescript-eslint supports TS 7.1+, bumping back is a one-line change.

## Tests

The pure-logic modules (`shared/booleanExpression`, `shared/keywordExtraction`,
`shared/timing`, `background/scoring`) have unit tests that run in plain Node
(`node --test`) against the compiled output:

```
npm test
```

These cover the Boolean parser, keyword derivation, scoring, and the randomised
scraping delays — the places where a subtle change silently breaks matching.

There is also a **Playwright smoke test** (`npm run test:e2e`) that loads the built
extension in a real Chromium and checks the popup renders its controls without a JS
error. Locally, point it at a full Chromium: `PW_CHROMIUM_PATH=/path/to/chrome`.

Neither test can exercise the actual LinkedIn scraping — that needs a logged-in
session in a real browser. See [`docs/QA_CHECKLIST.md`](./docs/QA_CHECKLIST.md) for
the manual pass to run before shipping scraping/scoring changes.
