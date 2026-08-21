var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ProfileCache_store, _ProfileCache_ttlMs;
import { CACHE_EXPIRY_MS } from '../shared/constants.js';
/** In-memory TTL cache for scraped profile data, keyed by profile URL. */
export class ProfileCache {
    constructor(ttlMs = CACHE_EXPIRY_MS) {
        _ProfileCache_store.set(this, new Map());
        _ProfileCache_ttlMs.set(this, void 0);
        __classPrivateFieldSet(this, _ProfileCache_ttlMs, ttlMs, "f");
    }
    get(url) {
        const entry = __classPrivateFieldGet(this, _ProfileCache_store, "f").get(url);
        if (!entry)
            return undefined;
        if (Date.now() - entry.timestamp >= __classPrivateFieldGet(this, _ProfileCache_ttlMs, "f")) {
            __classPrivateFieldGet(this, _ProfileCache_store, "f").delete(url);
            return undefined;
        }
        return entry.data;
    }
    set(url, data) {
        __classPrivateFieldGet(this, _ProfileCache_store, "f").set(url, { data, timestamp: Date.now() });
    }
    clear() {
        __classPrivateFieldGet(this, _ProfileCache_store, "f").clear();
    }
}
_ProfileCache_store = new WeakMap(), _ProfileCache_ttlMs = new WeakMap();
export const profileCache = new ProfileCache();
