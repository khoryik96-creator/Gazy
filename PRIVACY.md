# Privacy Policy — Gazy

_Last updated: 2026-08-26_

Gazy is a Chrome extension that helps you source candidates from LinkedIn
people-search results: it extracts profile URLs, scores them against a job
description, optionally evaluates them with an AI model you configure, and lets
you organise them into folders and a shortlist.

This policy explains exactly what data Gazy handles and where it goes. The short
version: **your data stays on your device**, and nothing is sent anywhere except
(a) the LinkedIn pages you are already browsing, and (b) the AI provider you
explicitly configure, only when you press the AI-evaluate button.

## What Gazy stores, and where

Everything Gazy saves lives in your browser's local extension storage
(`chrome.storage.local`) **on your device**. It is not uploaded to us — Gazy has
no server and no account system. This includes:

- **Extracted candidate URLs** from LinkedIn people-search results.
- **Scraped profile text** used to score candidates (headline, location, and the
  visible profile text), and the resulting keyword scores.
- **AI evaluation results** (fit score and rationale) when you use that feature.
- **Your organisation data**: shortlist, folders, and saved search templates.
- **Your settings**: job description / keywords / Boolean filter / location, UI
  theme, pages-to-scan, chosen AI model.
- **Your AI API key**, if you enter one (see below).

You can export all of this to a JSON file at any time (dashboard → **Backup**),
and clear it via your browser's "remove extension data" controls. Backups you
create **do not** include your API key.

## What Gazy transmits, and to whom

Gazy has no backend of its own and collects no analytics or telemetry. Data
leaves your browser in only two ways:

1. **LinkedIn** (`https://www.linkedin.com`): Gazy reads the people-search and
   profile pages you are browsing, in order to extract and score candidates.
   This is the same data your browser already loads; Gazy does not log in on your
   behalf or access anything you can't already see while signed in.

2. **Your chosen AI provider — only if you use AI Evaluate.** If you add an API
   key and run an AI evaluation, Gazy sends the relevant profile text and your
   job requirements to that provider's API (by default, DeepSeek at
   `https://api.deepseek.com`) to obtain a fit score. This happens only when you
   trigger it. Your use of that provider is governed by _their_ privacy policy
   and terms. If you never enter a key or never press AI Evaluate, no profile
   data is sent to any AI provider.

## Your AI API key

If you choose to use AI evaluation, your API key is stored only in your browser's
local extension storage on your device. It is sent solely to the AI provider's
API endpoint to authenticate your own requests. It is never transmitted to us
(there is no "us" server), never shared with third parties, and never included in
the workspace backup file.

## Permissions and why they're needed

- **`storage`** — save your candidates, folders, shortlist, and settings on your
  device.
- **`scripting`** / **`activeTab`** / **`tabs`** — read the LinkedIn pages you're
  sourcing from and open background tabs to scrape profiles you ask it to score.
- **`clipboard-write`** — copy candidate data when you use a copy action.
- **Host access to `www.linkedin.com`** — the site Gazy sources candidates from.
- **Host access to `api.deepseek.com`** — the default AI provider endpoint for
  the optional AI-evaluate feature.

## Data sharing and selling

Gazy does not sell your data, does not share it with third parties, and does not
use it for advertising. The only outbound transfers are the two described above,
both of which you initiate.

## Children

Gazy is a professional sourcing tool and is not directed to children.

## Changes to this policy

If this policy changes materially, the updated version will be published in this
repository with a new "Last updated" date.

## Contact

Questions about this policy: **&lt;add your contact email before publishing&gt;**.
