// Shortlist folders — a multi-tag layer over candidates. A candidate can belong
// to any number of named folders at once (e.g. "Phone screen", "Strong",
// "Backend"), independent of the flat ⭐ shortlist. This module is pure and
// storage-agnostic: it owns the data shape and returns NEW stores rather than
// mutating, so callers persist the result to chrome.storage themselves.

export interface FolderStore {
  /** Folder names in display order. */
  order: string[];
  /** Folder name → the candidate URLs it contains. */
  members: Record<string, string[]>;
}

const MAX_NAME_LEN = 40;

export function emptyFolderStore(): FolderStore {
  return { order: [], members: {} };
}

/** Collapses whitespace and trims a folder name to a sane length. */
export function normalizeFolderName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN);
}

/**
 * Tolerant loader for whatever is in storage. Keeps only string folder names
 * that have a matching members array, dedupes URLs, and drops orphans — so a
 * malformed or partially-written store can never crash the UI.
 */
export function normalizeFolderStore(raw: unknown): FolderStore {
  const store = emptyFolderStore();
  if (!raw || typeof raw !== 'object') return store;
  const r = raw as { order?: unknown; members?: unknown };
  const members =
    r.members && typeof r.members === 'object' ? (r.members as Record<string, unknown>) : {};
  const rawOrder = Array.isArray(r.order) ? r.order : Object.keys(members);
  const seen = new Set<string>();
  for (const nameRaw of rawOrder) {
    const name = normalizeFolderName(nameRaw);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const urls = Array.isArray(members[name]) ? (members[name] as unknown[]) : [];
    store.order.push(name);
    store.members[name] = [...new Set(urls.filter((u): u is string => typeof u === 'string'))];
  }
  return store;
}

function clone(store: FolderStore): FolderStore {
  const members: Record<string, string[]> = {};
  for (const name of store.order) members[name] = [...(store.members[name] || [])];
  return { order: [...store.order], members };
}

/** Adds a new empty folder. No-op if the name is blank or already exists. */
export function createFolder(store: FolderStore, rawName: string): FolderStore {
  const name = normalizeFolderName(rawName);
  if (!name || store.order.includes(name)) return store;
  const next = clone(store);
  next.order.push(name);
  next.members[name] = [];
  return next;
}

/** Renames a folder, preserving its position and members. No-op on collision. */
export function renameFolder(store: FolderStore, from: string, rawTo: string): FolderStore {
  const to = normalizeFolderName(rawTo);
  if (!to || !store.order.includes(from) || from === to || store.order.includes(to)) return store;
  const next = clone(store);
  next.order = next.order.map((n) => (n === from ? to : n));
  next.members[to] = next.members[from];
  delete next.members[from];
  return next;
}

/** Removes a folder and its membership entirely. Candidates are untouched. */
export function deleteFolder(store: FolderStore, name: string): FolderStore {
  if (!store.order.includes(name)) return store;
  const next = clone(store);
  next.order = next.order.filter((n) => n !== name);
  delete next.members[name];
  return next;
}

/** Adds or removes a candidate from a folder (toggle). No-op for unknown folders. */
export function toggleMembership(store: FolderStore, name: string, url: string): FolderStore {
  if (!store.order.includes(name)) return store;
  const next = clone(store);
  const urls = next.members[name];
  const i = urls.indexOf(url);
  if (i === -1) urls.push(url);
  else urls.splice(i, 1);
  return next;
}

/** The folders a given candidate belongs to, in display order. */
export function foldersForUrl(store: FolderStore, url: string): string[] {
  return store.order.filter((name) => store.members[name]?.includes(url));
}

/** How many candidates are in a folder. */
export function folderCount(store: FolderStore, name: string): number {
  return store.members[name]?.length ?? 0;
}
