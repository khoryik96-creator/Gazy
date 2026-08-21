# Gazy — LinkedIn Profile Finder

Chrome (Manifest V3) extension: extracts LinkedIn people-search results, scores
them against a job description / keywords / Boolean rule, and exports to CSV.

Written in **TypeScript**. There is a compile step — Chrome loads the compiled
JavaScript in `dist/`, not the `src/` TypeScript.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the module layout and conventions
to follow when adding new features.

## Build & load it

```
npm install      # one-time: TypeScript + chrome type defs
npm run build    # compiles src/ (TypeScript) → dist/ (loadable extension)
```

Then in Chrome:

1. `chrome://extensions` → enable Developer Mode → **Load unpacked** → select
   the **`dist/`** folder (it contains the compiled `manifest.json`).
2. Open the popup on `linkedin.com`, paste a job description or keywords, and
   click **Search LinkedIn**.

Re-run `npm run build` after changing any `src/**/*.ts` (or use `npx tsc --watch`
during development), then hit the reload icon on the extension card.

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
