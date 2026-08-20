import { CACHE_EXPIRY_MS } from '../shared/constants.js';
import type { ProfilePageData } from '../shared/types.js';

interface CacheEntry {
  data: ProfilePageData;
  timestamp: number;
}

/** In-memory TTL cache for scraped profile data, keyed by profile URL. */
export class ProfileCache {
  #store = new Map<string, CacheEntry>();
  #ttlMs: number;

  constructor(ttlMs: number = CACHE_EXPIRY_MS) {
    this.#ttlMs = ttlMs;
  }

  get(url: string): ProfilePageData | undefined {
    const entry = this.#store.get(url);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp >= this.#ttlMs) {
      this.#store.delete(url);
      return undefined;
    }
    return entry.data;
  }

  set(url: string, data: ProfilePageData): void {
    this.#store.set(url, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.#store.clear();
  }
}

export const profileCache = new ProfileCache();
