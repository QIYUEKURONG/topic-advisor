import { build } from 'esbuild';
import { cpSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs';
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
    'puppeteer',
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

  console.log('Sharp native deps copied to server/node_modules_electron/');
}
