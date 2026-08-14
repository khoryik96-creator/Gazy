# Gazy — LinkedIn Profile Finder

Chrome (Manifest V3) extension: extracts LinkedIn people-search results, scores
them against a job description / keywords / Boolean rule, and exports to CSV.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the module layout and conventions
to follow when adding new features.

## Load it

1. `chrome://extensions` → enable Developer Mode → **Load unpacked** → select
   this repository's root folder (the one containing `manifest.json`).
2. Open the popup on `linkedin.com`, paste a job description or keywords, and
   click **Search LinkedIn**.

## Tests

The pure-logic modules (`shared/booleanExpression.js`, `shared/keywordExtraction.js`,
`background/scoring.js`) have unit tests that run in plain Node with no
dependencies or build step:

```
npm test        # (or: node --test)
```

These cover the Boolean parser, keyword derivation, and scoring — the places
where a subtle change silently breaks matching. Run them before pushing; the
rest of the extension needs Chrome + a logged-in LinkedIn session to exercise.
