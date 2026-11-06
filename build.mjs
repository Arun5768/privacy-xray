import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('src/manifest.json', 'dist/manifest.json');
cpSync('src/popup/popup.html', 'dist/popup.html');
cpSync('src/popup/popup.css', 'dist/popup.css');
cpSync('src/welcome/welcome.html', 'dist/welcome.html');
cpSync('src/welcome/welcome.css', 'dist/welcome.css');
cpSync('src/icons', 'dist/icons', { recursive: true });
cpSync('src/audit/audit.html', 'dist/audit.html');
cpSync('src/audit/audit.css', 'dist/audit.css');
// Extension pages share the website's design system and bundled fonts.
cpSync('site/assets/app.css', 'dist/app.css');
for (const [from, to] of [
  ['@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2', 'space-grotesk.woff2'],
  ['@fontsource/pixelify-sans/files/pixelify-sans-latin-500-normal.woff2', 'pixelify-500.woff2'],
  ['@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff2', 'pixelify-700.woff2'],
  ['@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', 'jetbrains-mono.woff2'],
]) cpSync(`node_modules/${from}`, `dist/fonts/${to}`);
// The website uses the same logo.
cpSync('src/icons/logo.svg', 'docs/img/logo.svg');
cpSync('src/icons/icon-32.png', 'docs/favicon.png');

// Website pages from site/ (layout + pages) into docs/, published by GitHub Pages.
await import('./scripts/site.mjs');

const options = {
  entryPoints: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    inject: 'src/inject.ts',
    popup: 'src/popup/popup.ts',
    welcome: 'src/welcome/welcome.ts',
    audit: 'src/audit/audit.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome111',
  logLevel: 'info',
};

// Website scripts: the registry (reads Arkiv) and the exposure scan (reads public RPCs).
const site = {
  entryPoints: { 'registry/registry': 'site/registry.ts', 'scan/scan': 'site/scan.ts' },
  outdir: 'docs',
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  logLevel: 'info',
};

if (watch) {
  await (await esbuild.context(options)).watch();
  await (await esbuild.context(site)).watch();
} else {
  await esbuild.build(options);
  await esbuild.build(site);
}
