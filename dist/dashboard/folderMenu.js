import { foldersForUrl } from '../shared/folders.js';
let openEl = null;
/** Closes any open folder popover. */
export function closeFolderMenu() {
    openEl?.remove();
    openEl = null;
    document.removeEventListener('mousedown', onDocMouseDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
}
function onDocMouseDown(e) {
    if (openEl && !openEl.contains(e.target))
        closeFolderMenu();
}
function onKeyDown(e) {
    if (e.key === 'Escape')
        closeFolderMenu();
}
export function openFolderMenu(opts) {
    closeFolderMenu();
    const menu = document.createElement('div');
    menu.className = 'folder-menu';
    const mine = new Set(foldersForUrl(opts.store, opts.url));
    if (opts.store.order.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'folder-menu-empty';
        hint.textContent = 'No folders yet — create one:';
        menu.appendChild(hint);
    }
    for (const name of opts.store.order) {
        const row = document.createElement('label');
        row.className = 'folder-menu-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = mine.has(name);
        cb.addEventListener('change', () => opts.onToggle(name));
        const span = document.createElement('span');
        span.textContent = name;
        row.append(cb, span);
        menu.appendChild(row);
    }
    const form = document.createElement('form');
    form.className = 'folder-menu-new';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '＋ New folder…';
    input.maxLength = 40;
    form.appendChild(input);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (name) {
            opts.onCreate(name);
            input.value = '';
        }
    });
    menu.appendChild(form);
    document.body.appendChild(menu);
    // Position under the anchor, nudged left if it would overflow the viewport.
    const r = opts.anchor.getBoundingClientRect();
    const top = r.bottom + window.scrollY + 4;
    const left = Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - menu.offsetWidth - 12);
    menu.style.top = top + 'px';
    menu.style.left = Math.max(window.scrollX + 8, left) + 'px';
    openEl = menu;
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    input.focus();
}
