import { CACHE_EXPIRY_MS } from '../shared/constants.js';

/** In-memory TTL cache for scraped profile data, keyed by profile URL. */
export class ProfileCache {
  #store = new Map();
  #ttlMs;

  constructor(ttlMs = CACHE_EXPIRY_MS) {
    this.#ttlMs = ttlMs;
  }

  get(url) {
    const entry = this.#store.get(url);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp >= this.#ttlMs) {
      this.#store.delete(url);
      return undefined;
    }
    return entry.data;
  }

  set(url, data) {
    this.#store.set(url, { data, timestamp: Date.now() });
  }

  clear() {
    this.#store.clear();
  }
}

export const profileCache = new ProfileCache();
