// End-to-end check: load the extension in a throwaway Brave profile, run the demo
// dApp with Protect off and on, and compare what the tracker server received.
import puppeteer from 'puppeteer-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = process.argv[2] ?? fileURLToPath(new URL('../dist', import.meta.url));
const BROWSER = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const trackerLog = async () => (await fetch('http://127.0.0.1:5174/log')).json();

const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: false,
  userDataDir: mkdtempSync(join(tmpdir(), 'pxr-')),
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run', '--window-size=1200,800'],
});

try {
  const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  console.log('extension loaded:', extId);

  const ext = await browser.newPage();
  await ext.goto(`chrome-extension://${extId}/popup.html`);
  const call = (msg) => ext.evaluate((m) => chrome.runtime.sendMessage(m), msg);

  const dapp = await browser.newPage();
  async function runOnce(label) {
    await fetch('http://127.0.0.1:5174/reset');
    await dapp.goto('http://localhost:5173/demo/', { waitUntil: 'load' });
    await dapp.bringToFront();
    const t0 = Date.now();
    await dapp.click('#demoWallet');
    await sleep(2500);
    const tabId = await ext.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:5173/*' }))[0]?.id);
    const view = await call({ type: 'get', tabId });
    const log = await trackerLog();
    console.log(`\n=== ${label} ===`);
    console.log('tracker received:', log.length, log.map((e) => `${e.method} ${e.path}`));
    console.log('popup leaks:', view.leaks.length, 'addresses:', view.addresses);
    for (const l of view.leaks) console.log(` - ${l.company} | ${l.location} | ${l.transform} | ${l.blocked ? 'BLOCKED' : 'sent'} | by ${l.initiatorScript ?? '?'}\n   ${l.method} ${l.requestUrl}`);
    console.log('raw address present in stored leaks?', JSON.stringify(view.leaks).toLowerCase().includes('52908400098527886e0f7030069857d2e4169ee7'));
    return { log, view, ms: Date.now() - t0 };
  }

  const off = await runOnce('Protect OFF');
  await call({ type: 'setProtect', on: true });
  const on = await runOnce('Protect ON');
  await dapp.screenshot({ path: 'test/e2e-dapp.png' });
  await call({ type: 'setProtect', on: false });

  const ok =
    off.log.length === 3 && off.view.leaks.length === 3 && on.log.length === 0 && on.view.leaks.length === 3 && on.view.leaks.every((l) => l.blocked);
  console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
} finally {
  await browser.close();
}
