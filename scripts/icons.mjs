// Renders src/icons/logo.svg to the PNG sizes the extension manifest needs.
//   node scripts/icons.mjs
// Uses the same Chromium browser as the tests (BROWSER env var to override).
import puppeteer from 'puppeteer-core';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BROWSER = process.env.BROWSER ?? 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const svg = readFileSync('src/icons/logo.svg', 'utf8');
const profile = mkdtempSync(join(tmpdir(), 'oxray-icons-'));
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, userDataDir: profile });
try {
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 128]) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: `src/icons/icon-${size}.png`, omitBackground: true });
    console.log(`src/icons/icon-${size}.png`);
  }
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
