// Runs the extension's audit agent end to end in a throwaway Brave profile and
// prints what it found. Saves a screenshot of the report to test/audit.png.
import puppeteer from 'puppeteer-core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = fileURLToPath(new URL('../dist', import.meta.url));
const BROWSER = process.env.BROWSER ?? 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'oxray-audit-'));
const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: false,
  userDataDir: profile,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run', '--window-size=1200,900'],
});
try {
  const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto(`chrome-extension://${extId}/audit.html?start`);
  let audit;
  for (let i = 0; i < 90; i++) {
    await sleep(4000);
    audit = (await page.evaluate(() => chrome.runtime.sendMessage({ type: 'audit:get' }))).audit;
    const done = audit?.sites.filter((s) => s.status === 'done' || s.status === 'error').length ?? 0;
    process.stdout.write(`\r${done}/${audit?.sites.length ?? '?'} sites`);
    if (audit && !audit.running && audit.finishedAt) break;
  }
  console.log('');
  for (const s of audit.sites) {
    console.log(`${s.name}: ${s.status}, ${s.recipients.length} recipient(s)${s.error ? ' · ' + s.error : ''}`);
    for (const r of s.recipients) console.log(`   ${r.host} | ${r.company} | ${r.encodings.join(', ')} | ${r.outcome}`);
  }
  await page.bringToFront();
  await sleep(800);
  await page.screenshot({ path: 'test/audit.png', fullPage: true });
  const ok = audit.sites.every((s) => s.status === 'done' || s.status === 'error') && !audit.running;
  console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
