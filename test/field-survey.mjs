// Field survey: visit real sites that put an address in the page URL and record
// which third parties receive it. Uses a freshly generated random address that
// belongs to nobody, in a throwaway Brave profile. Writes research/field-test.md.
import puppeteer from 'puppeteer-core';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = fileURLToPath(new URL('../dist', import.meta.url));
const BROWSER = process.env.BROWSER ?? 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const ADDR = '0x' + randomBytes(20).toString('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SITES = [
  ['Etherscan', `https://etherscan.io/address/${ADDR}`],
  ['Blockscout', `https://eth.blockscout.com/address/${ADDR}`],
  ['DeBank', `https://debank.com/profile/${ADDR}`],
  ['Zapper', `https://zapper.xyz/account/${ADDR}`],
  ['Zerion', `https://app.zerion.io/${ADDR}/overview`],
  ['OpenSea', `https://opensea.io/${ADDR}`],
  ['Arkham', `https://intel.arkm.com/explorer/address/${ADDR}`],
  ['OKLink', `https://www.oklink.com/eth/address/${ADDR}`],
];

const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: false,
  userDataDir: mkdtempSync(join(tmpdir(), 'pxr-field-')),
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run', '--window-size=1280,900'],
});

const rows = [];
try {
  const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  const ext = await browser.newPage();
  await ext.goto(`chrome-extension://${extId}/popup.html`);
  const call = (msg) => ext.evaluate((m) => chrome.runtime.sendMessage(m), msg);
  await call({ type: 'addAddress', address: ADDR });

  const page = await browser.newPage();
  for (const [name, url] of SITES) {
    let loadError = '';
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      loadError = e.message.split('\n')[0];
    }
    await sleep(12000);
    const tabId = await ext.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url?.startsWith(u))?.id, new URL(url).origin);
    const view = tabId ? await call({ type: 'get', tabId }) : { leaks: [] };
    const title = await page.title().catch(() => '');
    const recipients = [...new Map(view.leaks.map((l) => [l.recipientHost, l])).values()];
    rows.push({ name, url, title, loadError, leaks: view.leaks, recipients });
    console.log(`${name}: ${view.leaks.length} leaks to ${recipients.length} hosts ${loadError ? '(' + loadError + ')' : ''} [${title}]`);
    for (const r of recipients) {
      const mine = view.leaks.filter((l) => l.recipientHost === r.recipientHost);
      console.log(`   ${r.recipientHost} | ${r.company} | ${r.category} | ${[...new Set(mine.map((l) => `${l.location}:${l.transform}:${l.outcome ?? 'unknown'}`))].join(', ')}`);
    }
  }
} finally {
  await browser.close();
}

const redacted = ADDR.slice(0, 6) + '…' + ADDR.slice(-4);
const md = [
  '# Field test: real sites, observed leaks',
  '',
  `Run: ${new Date().toISOString()} with \`node test/field-survey.mjs\` (Brave, fresh profile, extension built from this repo).`,
  '',
  `Method: a freshly generated random address (${redacted}, owned by nobody) was added as a watched address. Each page was opened with that address in its URL and observed for 12 seconds without any interaction. Only third-party requests that contained the address (in any encoding the detector supports) are listed.`,
  '',
  'These are observations, not accusations: putting an address in a URL is normal for explorers and portfolio pages, and a recipient seeing it may be expected (for example the site\'s own API on another domain). The point is to make visible who receives it. Results vary between runs (consent banners, bot checks, ad loading).',
  '',
  'Outcome: `delivered` = the request completed; `blocked-by-browser` = Brave Shields stopped it after the page tried to send it; `failed` = network error; `unknown` = not reported before the page was left.',
  '',
  '| Site | Page loaded | Recipient host (company) | Where · encoding · outcome |',
  '|---|---|---|---|',
  ...rows.flatMap((r) => {
    const loaded = r.loadError ? 'error: ' + r.loadError.replace(/\|/g, '/') : /just a moment/i.test(r.title) ? 'no (bot check)' : 'yes';
    if (!r.recipients.length) return [`| ${r.name} | ${loaded} | none observed | — |`];
    return r.recipients.map((x) => {
      const mine = r.leaks.filter((l) => l.recipientHost === x.recipientHost);
      const how = [...new Set(mine.map((l) => `${l.location} · ${l.transform} · ${l.outcome ?? 'unknown'}`))].join('; ');
      const who = x.company && x.company !== x.recipientSite ? `${x.recipientHost} (${x.company})` : x.recipientHost;
      return `| ${r.name} | ${loaded} | ${who} | ${how} |`;
    });
  }),
  '',
];
writeFileSync(fileURLToPath(new URL('../research/field-test.md', import.meta.url)), md.join('\n'));
console.log('\nwrote research/field-test.md');
