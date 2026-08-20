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

| Command             | What it does                                            |
|---------------------|---------------------------------------------------------|
| `npm run build`     | Compile TS and copy assets into `dist/`                 |
| `npm run typecheck` | Type-check only, no output (`tsc --noEmit`)             |
| `npm test`          | Build, then run the unit tests against `dist/`          |
| `npm run clean`     | Remove `dist/`                                          |

## Tests

The pure-logic modules (`shared/booleanExpression`, `shared/keywordExtraction`,
`shared/timing`, `background/scoring`) have unit tests that run in plain Node
(`node --test`) against the compiled output:

```
npm test
```

These cover the Boolean parser, keyword derivation, scoring, and the randomised
scraping delays — the places where a subtle change silently breaks matching. Run
them before pushing; the rest of the extension needs Chrome + a logged-in
LinkedIn session to exercise.
