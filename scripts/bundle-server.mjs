import { build } from 'esbuild';

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
  ],
  banner: {
    js: [
      'import { createRequire } from "module";',
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
});

console.log('Server bundled to server/bundle/index.mjs');
