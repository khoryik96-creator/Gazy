// Build the extension: compile TypeScript, then copy the non-TS assets that
// Chrome loads directly (manifest, popup HTML/CSS) into dist/ alongside the
// compiled JS. Run via `npm run build`. Load `dist/` as the unpacked extension.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

// Start clean so removed source files don't linger as stale output.
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1. Compile TypeScript (src/**/*.ts -> dist/**/*.js).
execFileSync('npx', ['tsc', '--project', 'tsconfig.json'], { cwd: root, stdio: 'inherit' });

// 2. Copy the assets tsc doesn't touch. Paths are dist-relative so the manifest
//    loads correctly from the dist root.
const assets = [
  ['src/manifest.json', 'dist/manifest.json'],
  ['src/popup/popup.html', 'dist/popup/popup.html'],
  ['src/popup/popup.css', 'dist/popup/popup.css'],
];
for (const [from, to] of assets) {
  cpSync(resolve(root, from), resolve(root, to));
}

console.log('Build complete → dist/ (Load Unpacked this folder in Chrome).');
