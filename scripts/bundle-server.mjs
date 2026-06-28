import { build } from 'esbuild';
import { cpSync, mkdirSync, existsSync, readdirSync, rmSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

await build({
  entryPoints: ['server/src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'server/bundle/index.mjs',
  sourcemap: false,
  minify: false,
  external: [
    'puppeteer-core',
    'sharp',
  ],
  banner: {
    js: [
      'import { createRequire } from "module";',
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
});

console.log('Server bundled to server/bundle/index.mjs');

// Copy sharp + native bindings for Electron packaging
const dest = join(root, 'server', 'node_modules_electron');
if (existsSync(dest)) rmSync(dest, { recursive: true });
mkdirSync(dest, { recursive: true });

const pnpmStore = join(root, 'node_modules', '.pnpm');
if (existsSync(pnpmStore)) {
  const sharpEntries = readdirSync(pnpmStore).filter(e => e.startsWith('sharp@'));
  if (sharpEntries.length) {
    const sharpSrc = join(pnpmStore, sharpEntries[0], 'node_modules', 'sharp');
    if (existsSync(sharpSrc)) {
      cpSync(sharpSrc, join(dest, 'sharp'), { recursive: true, dereference: true });
    }
  }

  mkdirSync(join(dest, '@img'), { recursive: true });
  const imgEntries = readdirSync(pnpmStore).filter(e => e.startsWith('@img+sharp-'));
  for (const entry of imgEntries) {
    const imgSrc = join(pnpmStore, entry, 'node_modules', '@img');
    if (!existsSync(imgSrc)) continue;
    for (const pkg of readdirSync(imgSrc)) {
      const pkgDest = join(dest, '@img', pkg);
      if (existsSync(pkgDest)) rmSync(pkgDest, { recursive: true });
      cpSync(join(imgSrc, pkg), pkgDest, { recursive: true, dereference: true });
    }
  }

  const sharpPeerDeps = ['detect-libc', 'semver'];
  for (const dep of sharpPeerDeps) {
    const entries = readdirSync(pnpmStore).filter(e => e.startsWith(`${dep}@`));
    if (entries.length) {
      const src = join(pnpmStore, entries[0], 'node_modules', dep);
      if (existsSync(src)) cpSync(src, join(dest, dep), { recursive: true, dereference: true });
    }
  }

  // Copy @img/colour
  const colourEntries = readdirSync(pnpmStore).filter(e => e.startsWith('@img+colour@'));
  for (const entry of colourEntries) {
    const src = join(pnpmStore, entry, 'node_modules', '@img', 'colour');
    if (existsSync(src)) {
      mkdirSync(join(dest, '@img', 'colour'), { recursive: true });
      cpSync(src, join(dest, '@img', 'colour'), { recursive: true, dereference: true });
    }
  }

  // Recursively copy a package and all its dependencies from pnpm store
  function copyPkg(name, visited = new Set()) {
    if (visited.has(name)) return;
    visited.add(name);

    // Handle scoped packages like @puppeteer/browsers → @puppeteer+browsers@
    const storePrefix = name.replace(/\//g, '+');
    const entries = readdirSync(pnpmStore).filter(e => e.startsWith(`${storePrefix}@`));
    if (!entries.length) return;

    const entry = entries[entries.length - 1];
    const nmDir = join(pnpmStore, entry, 'node_modules');
    if (!existsSync(nmDir)) return;

    // Copy the package itself
    const parts = name.split('/');
    let pkgSrc, pkgDest;
    if (parts.length === 2) {
      pkgSrc = join(nmDir, parts[0], parts[1]);
      const scopeDir = join(dest, parts[0]);
      if (!existsSync(scopeDir)) mkdirSync(scopeDir, { recursive: true });
      pkgDest = join(dest, parts[0], parts[1]);
    } else {
      pkgSrc = join(nmDir, name);
      pkgDest = join(dest, name);
    }

    if (!existsSync(pkgSrc)) return;
    if (existsSync(pkgDest)) rmSync(pkgDest, { recursive: true });
    cpSync(pkgSrc, pkgDest, { recursive: true, dereference: true });

    // Recursively copy dependencies
    const pkgJsonPath = join(pkgDest, 'package.json');
    if (existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
        for (const dep of Object.keys(pkg.dependencies || {})) {
          copyPkg(dep, visited);
        }
      } catch {}
    }
  }

  // Copy puppeteer-core and all its transitive dependencies
  const visited = new Set();
  copyPkg('puppeteer-core', visited);
  console.log(`Puppeteer-core + ${visited.size} deps copied to server/node_modules_electron/`);

  console.log('Sharp native deps copied to server/node_modules_electron/');
}
