"use strict";
// Global keyboard shortcuts declared in the manifest's `commands`. Chrome fires
// these even when no Gazy UI is focused, so they open the dashboard from
// anywhere. The user can rebind or clear the key at chrome://extensions/shortcuts.
chrome.commands.onCommand.addListener((command) => {
    if (command === 'open-dashboard') {
        void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    }
});
