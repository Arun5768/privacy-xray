import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('src/manifest.json', 'dist/manifest.json');
cpSync('src/popup/popup.html', 'dist/popup.html');
cpSync('src/popup/popup.css', 'dist/popup.css');

const options = {
  entryPoints: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    inject: 'src/inject.ts',
    popup: 'src/popup/popup.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome111',
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
