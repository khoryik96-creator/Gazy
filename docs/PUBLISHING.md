# Publishing Gazy to the Chrome Web Store

A checklist for the owner. Most steps are one-time; after that, publishing an
update is just steps 6–8. Items marked **(owner)** need a human — I can't do them.

## One-time setup

1. **(owner)** Create a Chrome Web Store developer account and pay the one-time
   registration fee at <https://chrome.google.com/webstore/devconsole>.
2. **(owner)** Host the privacy policy at a public URL. The simplest option:
   enable GitHub Pages for this repo, or just link to `PRIVACY.md` on GitHub. Fill
   in the contact email placeholder in `PRIVACY.md` first.
3. **(owner)** Take 1–5 screenshots at 1280×800 (see `docs/STORE_LISTING.md` for
   suggested shots). Load the built `dist/` as an unpacked extension, open the
   dashboard with some sample data, and capture.

## Build the package

4. Produce the upload zip. Either:
   - **Tag a release**: `git tag vX.Y.Z && git push origin vX.Y.Z` — the
     `release.yml` workflow builds, tests, zips (`gazy-X.Y.Z.zip`, manifest at the
     zip root), and attaches it to a GitHub Release. Download that asset. **Or**
   - **Locally**: `npm ci --legacy-peer-deps && npm run build && (cd dist && zip -r ../gazy.zip .)`.

   Either way the zip must have `manifest.json` at its **root** (not nested under
   a `dist/` folder) — the release workflow already does this.

## Submit

5. **(owner)** In the Developer Dashboard, create a new item and upload the zip.
6. **(owner)** Fill in the listing from `docs/STORE_LISTING.md`: name, short and
   detailed description, category, single purpose, and screenshots. Link the
   privacy policy URL from step 2.
7. **(owner)** Complete the privacy/permissions form. Use the
   "Permission justifications" in `docs/STORE_LISTING.md`. Declare that data is
   stored locally and that profile text is sent to the user-configured AI
   provider only when the user runs AI evaluation. Declare **no** data is sold or
   used for unrelated purposes.
8. **(owner)** Submit for review. Review typically takes a few days; the more
   precise the permission justifications, the smoother it goes.

## Updating later

- Bump the version (already part of every change here), rebuild, and upload the
  new zip to the **same** item. The store requires the version to increase, which
  the project's "bump on every change" rule already guarantees.

## Notes / likely review questions

- **Why host access to LinkedIn?** Sourcing candidates from people-search — the
  core purpose. Answer plainly.
- **Why an AI endpoint?** Optional AI evaluation with the user's own key; no data
  goes there unless the user opts in and triggers it.
- **Remote code?** None. The extension bundles all its code; it makes API calls
  but does not load or execute remote scripts (MV3-compliant).
