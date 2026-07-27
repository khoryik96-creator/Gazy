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
