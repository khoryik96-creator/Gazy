// Deriving a readable candidate name from a LinkedIn profile URL. Pure and
// shared so the popup list, the dashboard, and CSV export all render names the
// same way (no chrome.* / DOM here).

/** The `/in/<slug>` handle from a profile URL, or '' if there isn't one. */
export function handleOf(url: string): string {
  return url.split('/in/')[1]?.split('/')[0] || '';
}

/**
 * Turn a URL slug into a readable name: "sarah-chen" → "Sarah Chen". Drops
 * trailing id-ish tokens (those containing digits), falling back to the slug.
 */
export function prettyName(slug: string): string {
  const words = slug
    .split('-')
    .filter((w) => w.length > 0 && !/\d/.test(w))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(' ') || slug;
}

/** Readable name straight from a profile URL. */
export function nameFromUrl(url: string): string {
  return prettyName(handleOf(url) || url);
}
