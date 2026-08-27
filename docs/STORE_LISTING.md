# Chrome Web Store listing — draft copy

Draft text for the Gazy listing. Review and adjust before submitting. See
`docs/PUBLISHING.md` for the step-by-step submission checklist.

## Name

Gazy — LinkedIn Profile Finder

## Category

Productivity (Workflow & Planning)

## Short description (≤132 characters)

> Extract LinkedIn people-search results, score them against a job description,
> organise into folders, and export to Excel/CSV.

(129 characters.)

## Detailed description

> Gazy turns a LinkedIn people search into a workspace for sourcing candidates.
>
> • Extract profiles — scan multiple pages of people-search results into one
> de-duplicated candidate list.
> • Score against the role — paste a job description, keywords, or a Boolean
> filter and Gazy scores each profile so the strongest matches rise to the top.
> • Optional AI evaluation — bring your own AI API key to get a fit score and a
> short rationale per candidate. This is entirely optional; without a key,
> nothing is sent to any AI provider.
> • Organise — shortlist candidates and file them into as many named folders as
> you like. Removing from your results keeps folder/shortlist saves intact.
> • Export — download the current view to CSV or to a real Excel file with
> sortable/filterable Score and AI-Score columns and clickable profile links.
> • Backup — export your whole workspace (folders, shortlist, scores, settings)
> to a JSON file and restore it on any machine. Your API key is never included.
>
> Privacy: everything is stored locally on your device. Gazy has no server and no
> analytics. Data leaves your browser only for the LinkedIn pages you're browsing
> and — only if you use AI evaluation — the AI provider whose key you configure.
> See the privacy policy: <link to PRIVACY.md once hosted>.

## Permission justifications (for the review form)

- **storage** — persist the candidate list, folders, shortlist, and settings on
  the user's device.
- **scripting / activeTab / tabs** — read the LinkedIn people-search and profile
  pages the user is sourcing from, and open background tabs to scrape the
  profiles the user chooses to score.
- **clipboard-write** — copy candidate data on a user-invoked copy action.
- **host permission `www.linkedin.com`** — the site the extension sources
  candidates from.
- **host permission `api.deepseek.com`** — the default AI provider endpoint for
  the optional AI-evaluation feature (only used when the user supplies a key and
  triggers it).

## Single purpose (Web Store requires one)

> Gazy's single purpose is to help a user source candidates from LinkedIn
> people-search results: extract, score, organise, and export them.

## Assets needed before submission

- **Icon**: 128×128 PNG (already in `src/icons/icon128.png`).
- **Screenshots**: 1280×800 (or 640×400), at least one, up to five. Suggested:
  1. The dashboard with a scored candidate list (Score / AI Score columns).
  2. The left rail with a job description + Boolean filter.
  3. Folders + shortlist in action.
  4. The Excel export opened with the filter arrows.
- **Small promo tile** (optional): 440×280 PNG.
