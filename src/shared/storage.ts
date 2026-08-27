// Typed wrappers around chrome.storage.local. The one place the raw
// `{ [key: string]: any }` from chrome.storage is narrowed, so call sites read
// storage with real types instead of ad-hoc `as unknown as { ... }` casts.
//
// `folders` / `aiUsage` / `aiPrices` / `lastRemoved` are typed loosely where the
// caller runs a tolerant normaliser/validator over them anyway.

import type { ScoresMap, AiEvalMap, AiModel, Template, RemovedSnapshot } from './types.js';

/** The full shape of everything Gazy persists in chrome.storage.local. */
export interface StorageShape {
  profiles: string[];
  profileScores: ScoresMap;
  aiEvals: AiEvalMap;
  shortlist: string[];
  folders: unknown; // normalised via normalizeFolderStore on read
  templates: Record<string, Template>;
  formData: Template;
  aiKey: string;
  aiModel: AiModel;
  aiUsage: unknown; // normalised via normalizeAiUsage
  aiPrices: unknown; // normalised via normalizePrices
  usdToMyr: number;
  uiTheme: string;
  scanPages: number;
  lastRemoved: RemovedSnapshot;
}

export type StorageKey = keyof StorageShape;

/**
 * Read the given keys, typed. Returns a partial (a key absent from storage is
 * simply absent from the result), exactly like chrome.storage.local.get.
 */
export async function getStorage<K extends StorageKey>(
  keys: readonly K[],
): Promise<Partial<Pick<StorageShape, K>>> {
  const raw = await chrome.storage.local.get(keys as unknown as string[]);
  return raw as Partial<Pick<StorageShape, K>>;
}

/** Read a single key, typed. */
export async function getStorageKey<K extends StorageKey>(
  key: K,
): Promise<StorageShape[K] | undefined> {
  const raw = await chrome.storage.local.get(key);
  return (raw as Partial<StorageShape>)[key];
}

/** Write a typed subset of the workspace. */
export function setStorage(items: Partial<StorageShape>): Promise<void> {
  return chrome.storage.local.set(items);
}
