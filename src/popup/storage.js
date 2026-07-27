/** Thin promise wrappers around chrome.storage.local, used everywhere in the popup. */
export function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

export function setStorage(items) {
  return chrome.storage.local.set(items);
}

export function removeStorage(keys) {
  return chrome.storage.local.remove(keys);
}
