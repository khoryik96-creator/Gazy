// Typed wrappers around chrome.storage.local. The one place the raw
// `{ [key: string]: any }` from chrome.storage is narrowed, so call sites read
// storage with real types instead of ad-hoc `as unknown as { ... }` casts.
//
// `folders` / `aiUsage` / `aiPrices` / `lastRemoved` are typed loosely where the
// caller runs a tolerant normaliser/validator over them anyway.
/**
 * Read the given keys, typed. Returns a partial (a key absent from storage is
 * simply absent from the result), exactly like chrome.storage.local.get.
 */
export async function getStorage(keys) {
    const raw = await chrome.storage.local.get(keys);
    return raw;
}
/** Read a single key, typed. */
export async function getStorageKey(key) {
    const raw = await chrome.storage.local.get(key);
    return raw[key];
}
/** Write a typed subset of the workspace. */
export function setStorage(items) {
    return chrome.storage.local.set(items);
}
