import { foldersForUrl, folderCount } from '../shared/folders.js';
import type { FolderStore } from '../shared/folders.js';

// Floating folder popovers. Presentation only: they read the store to render and
// report intent through callbacks — the dashboard owns persistence + re-render.
// Two flavours: a per-candidate assign menu (checkboxes) and a bulk pick menu
// (click a folder to add the whole selection to it).

let openEl: HTMLElement | null = null;

/** Closes any open folder popover. */
export function closeFolderMenu(): void {
  openEl?.remove();
  openEl = null;
  document.removeEventListener('mousedown', onDocMouseDown, true);
  document.removeEventListener('keydown', onKeyDown, true);
}

function onDocMouseDown(e: MouseEvent): void {
  if (openEl && !openEl.contains(e.target as Node)) closeFolderMenu();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeFolderMenu();
}

// Appends the menu, positions it under the anchor (nudged in if it would
// overflow the viewport), and wires the dismiss listeners.
function mount(menu: HTMLElement, anchor: HTMLElement): void {
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  const top = r.bottom + window.scrollY + 4;
  const left = Math.min(
    r.left + window.scrollX,
    window.scrollX + window.innerWidth - menu.offsetWidth - 12,
  );
  menu.style.top = top + 'px';
  menu.style.left = Math.max(window.scrollX + 8, left) + 'px';
  openEl = menu;
  document.addEventListener('mousedown', onDocMouseDown, true);
  document.addEventListener('keydown', onKeyDown, true);
}

// A "＋ New folder…" text field that reports its name through onCreate.
function newFolderForm(onCreate: (name: string) => void): {
  form: HTMLFormElement;
  input: HTMLInputElement;
} {
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
      onCreate(name);
      input.value = '';
    }
  });
  return { form, input };
}

interface FolderMenuOptions {
  anchor: HTMLElement;
  url: string;
  store: FolderStore;
  onToggle: (name: string) => void;
  onCreate: (name: string) => void;
}

/** Per-candidate assign menu: a checkbox per folder reflecting membership. */
export function openFolderMenu(opts: FolderMenuOptions): void {
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

  const { form, input } = newFolderForm(opts.onCreate);
  menu.appendChild(form);
  mount(menu, opts.anchor);
  input.focus();
}

interface FolderPickOptions {
  anchor: HTMLElement;
  store: FolderStore;
  /** How many candidates the pick will apply to (for the header). */
  count: number;
  onPick: (name: string) => void;
  onCreate: (name: string) => void;
}

/** Bulk pick menu: click a folder to add the whole selection to it. */
export function openFolderPickMenu(opts: FolderPickOptions): void {
  closeFolderMenu();

  const menu = document.createElement('div');
  menu.className = 'folder-menu';

  const head = document.createElement('div');
  head.className = 'folder-menu-empty';
  head.textContent =
    opts.store.order.length === 0
      ? 'Add ' + opts.count + ' to a new folder:'
      : 'Add ' + opts.count + ' selected to…';
  menu.appendChild(head);

  for (const name of opts.store.order) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'folder-menu-pick';
    const label = document.createElement('span');
    label.textContent = name;
    const n = document.createElement('span');
    n.className = 'folder-menu-count';
    n.textContent = String(folderCount(opts.store, name));
    btn.append(label, n);
    btn.addEventListener('click', () => opts.onPick(name));
    menu.appendChild(btn);
  }

  const { form, input } = newFolderForm(opts.onCreate);
  menu.appendChild(form);
  mount(menu, opts.anchor);
  input.focus();
}
