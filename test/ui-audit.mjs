// Evaluator-style UI audit: every site page + extension pages, desktop and phone.
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5173/';
const EXT = 'C:/Users/anshu/privacy-xray/dist';
const SHOTS = 'C:/Users/anshu/AppData/Local/Temp/claude/C--Users-anshu/f5264437-b7a3-4058-97a4-b1838f54c341/scratchpad/shots';
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAGES = ['', 'scan/', 'how/', 'registry/', 'teams/', 'demo/'];
const SIZES = [{ n: 'desk', width: 1440, height: 900 }, { n: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }];
const issues = [];
const add = (where, msg) => { issues.push(`${where}: ${msg}`); };

const profile = mkdtempSync(join(tmpdir(), 'oxray-ui-'));
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe', headless: false, userDataDir: profile, protocolTimeout: 120000, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run'] });

async function inspect(p, where) {
  return p.evaluate(() => {
    const out = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`horizontal scroll: scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.right > vw + 2 && !el.closest('[aria-hidden=true],.mesh,canvas,.marquee,.ticker')) {
        let o = el, clipped = false;
        while ((o = o.parentElement)) { const s = getComputedStyle(o); if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) { clipped = true; break; } }
        if (!clipped) out.push(`overflows right (${Math.round(r.right)}>${vw}): <${el.tagName.toLowerCase()} class="${el.className}"> ${el.textContent.trim().slice(0, 40)}`);
      }
    }
    for (const img of document.images) if (img.complete && !img.naturalWidth && img.src && !img.src.startsWith('data:,')) out.push(`broken image ${img.src}`);
    for (const a of document.querySelectorAll('a')) if (!a.getAttribute('href')) out.push(`link without href: ${a.textContent.trim().slice(0, 30)}`);
    for (const el of document.querySelectorAll('button,a')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && r.height < 24 && innerWidth < 500 && getComputedStyle(el).display !== 'inline') out.push(`small tap target ${Math.round(r.height)}px: ${el.textContent.trim().slice(0, 30)}`);
    }
    return { out: [...new Set(out)].slice(0, 25), links: [...document.querySelectorAll('a[href]')].map((a) => a.href) };
  });
}

const links = new Set();
try {
  const sw = await b.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  for (const size of SIZES) {
    for (const path of PAGES) {
      const where = `${size.n} /${path}`;
      console.error('>', where);
      const p = await b.newPage();
      await p.setViewport(size);
      p.on('console', (m) => m.type() === 'error' && !/demotrack\.invalid|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED/.test(m.text()) && add(where, `console error: ${m.text().slice(0, 160)}`));
      p.on('pageerror', (e) => add(where, `page error: ${e.message.slice(0, 160)}`));
      p.on('requestfailed', (r) => !/demotrack\.invalid|127\.0\.0\.1:5174/.test(r.url()) && add(where, `request failed ${r.url()} ${r.failure()?.errorText}`));
      p.on('response', (r) => r.status() >= 400 && add(where, `HTTP ${r.status()} ${r.url()}`));
      await p.bringToFront();
      await p.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 30000 }).catch((e) => add(where, `goto: ${e.message}`));
      await sleep(1500);
      if (path === 'scan/') { await p.click('#sample').catch(() => add(where, 'no #sample')); await sleep(12000); }
      if (path === 'registry/') await sleep(5000);
      if (path === 'demo/') { await p.click('#demoWallet'); await sleep(3000); }
      // scroll through so reveal animations fire
      console.error('  loaded');
      await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
      const h = await p.evaluate(() => document.documentElement.scrollHeight);
      console.error('  h', h);
      for (let y = 0; y < h; y += size.height * 0.7) { await p.evaluate((y) => scrollTo(0, y), y); await sleep(120); }
      await sleep(800);
      console.error('  scrolled');
      const r = await inspect(p, where).catch((e) => ({ out: ['inspect failed ' + e.message.slice(0, 80)], links: [] }));
      r.out.forEach((m) => add(where, m));
      r.links.forEach((l) => links.add(l));
      await p.evaluate(() => scrollTo(0, 0));
      await sleep(400);
      await p.screenshot({ path: `${SHOTS}/${size.n}-${path.replace(/\W/g, '') || 'home'}.png`, fullPage: true, captureBeyondViewport: true }).catch((e) => add(where, 'shot ' + e.message));
      await p.close();
    }
  }
  // extension pages
  for (const page of ['welcome.html', 'popup.html', 'audit.html']) {
    const where = `ext ${page}`;
    const p = await b.newPage();
    await p.setViewport({ width: page === 'popup.html' ? 400 : 1280, height: 800 });
    p.on('console', (m) => m.type() === 'error' && add(where, `console error: ${m.text().slice(0, 160)}`));
    p.on('pageerror', (e) => add(where, `page error: ${e.message.slice(0, 160)}`));
    await p.goto(`chrome-extension://${extId}/${page}`, { waitUntil: 'networkidle0' }).catch((e) => add(where, e.message));
    await sleep(1500);
    (await inspect(p, where)).out.forEach((m) => add(where, m));
    await p.screenshot({ path: `${SHOTS}/ext-${page.replace('.html', '')}.png`, fullPage: true });
    await p.close();
  }
  // link check
  for (const l of links) {
    if (!/^https?:/.test(l) || /mailto|twitter|x\.com|linkedin/.test(l)) continue;
    const u = l.split('#')[0];
    try {
      const res = await fetch(u, { method: 'GET', redirect: 'follow' });
      if (res.status >= 400) add('links', `${res.status} ${u}`);
    } catch (e) { add('links', `fetch fail ${u} ${e.message}`); }
  }
} finally {
  await b.close();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
console.log([...new Set(issues)].join('\n') || 'NO ISSUES');
