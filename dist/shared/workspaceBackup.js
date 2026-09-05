// Workspace backup: serialize the user's Gazy data + preferences to a single
// JSON string, and parse one back for restore. Pure (no chrome.* / DOM) so the
// envelope + validation are unit-tested directly; the dashboard does the actual
// storage read/write around these.
//
// Everything lives only in chrome.storage.local, so a profile reset or reinstall
// wipes folders, shortlists, scores, and settings with no recovery. This gives
// the user an explicit export/import safety net.
//
// The DeepSeek API key (`aiKey`) is deliberately NOT included — a backup file is
// meant to be shareable/portable, and a secret shouldn't travel in it. The
// ephemeral one-level undo snapshot (`lastRemoved`) is excluded too.
// The storage keys captured in a backup. Order is stable for readable output.
export const WORKSPACE_KEYS = [
    'profiles',
    'profileScores',
    'aiEvals',
    'shortlist',
    'folders',
    'templates',
    'formData',
    'aiModel',
    'aiUsage',
    'aiPrices',
    'usdToMyr',
    'uiTheme',
    'scanPages',
];
const FORMAT = 'gazy-workspace';
const FORMAT_VERSION = 1;
const KEY_SET = new Set(WORKSPACE_KEYS);
// Keep only recognised workspace keys with a defined value — never `aiKey` or any
// stray key, even if a hand-edited file includes them.
function pickKnown(source) {
    const out = {};
    for (const key of WORKSPACE_KEYS) {
        if (key in source && source[key] !== undefined)
            out[key] = source[key];
    }
    return out;
}
/**
 * Serialize a workspace to a pretty JSON string with a versioned envelope.
 * `appVersion` is recorded for humans reading the file; it isn't used on import.
 */
export function serializeWorkspace(data, appVersion = '') {
    const envelope = {
        format: FORMAT,
        version: FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        app: appVersion,
        data: pickKnown(data),
    };
    return JSON.stringify(envelope, null, 2);
}
/**
 * Parse a backup file's text back into the data object to hand
 * chrome.storage.local.set. Throws a friendly Error on anything that isn't a
 * recognisable Gazy workspace file, so the caller can show the message as-is.
 */
export function parseWorkspace(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new Error("That file isn't valid JSON — pick a Gazy backup file.");
    }
    if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Unrecognised backup file.');
    }
    const env = parsed;
    if (env.format !== FORMAT) {
        throw new Error("This doesn't look like a Gazy workspace backup.");
    }
    if (typeof env.version !== 'number' || env.version > FORMAT_VERSION) {
        throw new Error('This backup was made by a newer version of Gazy. Update the extension, then import again.');
    }
    if (typeof env.data !== 'object' || env.data === null) {
        throw new Error('Backup file has no data.');
    }
    const data = pickKnown(env.data);
    return {
        data,
        exportedAt: typeof env.exportedAt === 'string' ? env.exportedAt : '',
        keyCount: Object.keys(data).length,
    };
}
/** True if a storage key is safe to include in a backup (used by callers/tests). */
export function isWorkspaceKey(key) {
    return KEY_SET.has(key);
}
/**
 * The workspace keys a restore must CLEAR: those the backup doesn't carry.
 *
 * A restore replaces the workspace (that's what the confirm dialog promises), so
 * simply writing the file's keys isn't enough — any key absent from the backup
 * would keep its current value and survive alongside the restored data. Restoring
 * a backup taken before you had folders, for example, must leave you with no
 * folders rather than your current ones.
 *
 * Never includes `aiKey`: it isn't a workspace key, so a restore leaves the
 * user's API key alone.
 */
export function keysToClearOnRestore(data) {
    return WORKSPACE_KEYS.filter((key) => !(key in data));
}
