// Builds the website in docs/ from site/layout.html + site/pages/*.html.
// Each page starts with a JSON comment: <!-- {"title": "...", "description": "...", "path": "scan/", "scripts": ["scan.js"]} -->
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const layout = readFileSync('site/layout.html', 'utf8');

for (const file of readdirSync('site/pages').filter((f) => f.endsWith('.html'))) {
  const src = readFileSync(join('site/pages', file), 'utf8');
  const m = src.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
  if (!m) throw new Error(`${file}: missing JSON header comment`);
  const meta = JSON.parse(m[1]);
  const body = src.slice(m[0].length);
  const depth = meta.path ? meta.path.split('/').filter(Boolean).length : 0;
  const root = depth ? '../'.repeat(depth) : './';
  const scripts = (meta.scripts ?? []).map((s) => `  <script src="${s}"></script>`).join('\n');
  const html = layout
    .replaceAll('{{title}}', meta.title)
    .replaceAll('{{description}}', meta.description)
    .replaceAll('{{page}}', meta.page ?? file.replace('.html', ''))
    .replace('{{content}}', body)
    .replace('{{scripts}}', scripts)
    .replaceAll('{{root}}', root);
  const outDir = join('docs', meta.path ?? '');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
  console.log(`site: docs/${meta.path ?? ''}index.html`);
}

mkdirSync('docs/assets/fonts', { recursive: true });
cpSync('site/assets/app.css', 'docs/assets/app.css');
cpSync('site/assets/app.js', 'docs/assets/app.js');
for (const [from, to] of [
  ['@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2', 'space-grotesk.woff2'],
  ['@fontsource/pixelify-sans/files/pixelify-sans-latin-500-normal.woff2', 'pixelify-500.woff2'],
  ['@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff2', 'pixelify-700.woff2'],
  ['@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', 'jetbrains-mono.woff2'],
]) {
  cpSync(join('node_modules', from), join('docs/assets/fonts', to));
}
