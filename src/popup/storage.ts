/** Thin promise wrappers around chrome.storage.local, used everywhere in the popup. */
export function getStorage(keys: string[]): Promise<Record<string, unknown>> {
  return chrome.storage.local.get(keys);
}

export function setStorage(items: Record<string, unknown>): Promise<void> {
  return chrome.storage.local.set(items);
}

export function removeStorage(keys: string[]): Promise<void> {
  return chrome.storage.local.remove(keys);
}
