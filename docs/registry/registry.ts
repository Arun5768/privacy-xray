// Website registry page: reads observations from Arkiv in the visitor's browser.
// Uses the public Arkiv endpoint (no key in this page). Bundled by build.mjs.
import { createPublicClient } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { and, desc, eq, gt } from '@arkiv-network/sdk/query';
import { u64 } from '@arkiv-network/sdk/schema';
import { http } from 'viem';
import { getDomain } from 'tldts';
import { Observation } from '../../src/shared/arkiv.ts';

// Observations published by the 0xRay field survey. Anyone can write
// entities with this schema, so the page only trusts this publisher by default.
export const PUBLISHER = '0x6D0622258Fdb25b8E7989AbC3F7D71D82dd65E09';

const client = createPublicClient({ chain: rabdi({ accessKey: '' }), transport: http() });
const $ = (id: string) => document.getElementById(id)!;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

type Row = {
  site: string;
  recipientHost: string;
  company: string;
  category: string;
  location: string;
  encoding: string;
  outcome: string;
  observedAt: bigint;
  $expiresAt?: bigint;
};

function render(rows: Row[], heading: string, empty = 'No recent observations for this site. That means nobody has published one in the last 30 days, not that the site is clean.') {
  $('heading').textContent = heading;
  if (!rows.length) {
    $('results').innerHTML = `<p class="muted">${esc(empty)}</p>`;
    return;
  }
  $('results').innerHTML = `<table>
    <thead><tr><th>Site</th><th>Received by</th><th>Category</th><th>Where · encoding</th><th>Outcome</th><th>Observed</th></tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr>
          <td>${esc(r.site)}</td>
          <td><b>${esc(r.company)}</b><br><code>${esc(r.recipientHost)}</code></td>
          <td>${esc(r.category)}</td>
          <td>${esc(r.location)} · ${esc(r.encoding)}</td>
          <td>${esc(r.outcome)}</td>
          <td>${new Date(Number(r.observedAt) * 1000).toISOString().slice(0, 10)}</td>
        </tr>`,
      )
      .join('')}</tbody></table>`;
}

function toRows(entities: any[]): Row[] {
  return entities.map((e) => ({
    site: e.site.value,
    recipientHost: e.recipientHost.value,
    company: e.company.value,
    category: e.category.value,
    location: e.location.value,
    encoding: e.encoding.value,
    outcome: e.outcome.value,
    observedAt: BigInt(e.observedAt.value),
  }));
}

async function lookup(input: string) {
  const site = getDomain(input.includes('://') ? input : `https://${input}`, { allowPrivateDomains: true }) ?? input.trim();
  $('status').textContent = `Querying Arkiv for ${site}…`;
  try {
    const page = await client
      .select({ site: true, recipientHost: true, company: true, category: true, location: true, encoding: true, outcome: true, observedAt: true })
      .from(Observation)
      .where(eq('site', site))
      .ownedBy(PUBLISHER)
      .orderBy(desc('observedAt'))
      .limit(50)
      .fetch();
    render(toRows(page.entities), `Who received the address on ${site}`);
    $('status').textContent = `${page.entities.length} observation(s) read live from Arkiv.`;
  } catch (e) {
    $('status').textContent = `Could not reach Arkiv: ${(e as Error).message.split('\n')[0]}`;
  }
}

async function recent() {
  $('status').textContent = 'Loading recent observations from Arkiv…';
  try {
    const since = BigInt(Math.floor(Date.now() / 1000) - 30 * 86400);
    const page = await client
      .select({ site: true, recipientHost: true, company: true, category: true, location: true, encoding: true, outcome: true, observedAt: true })
      .from(Observation)
      .where(and(gt('observedAt', u64(since)), eq('outcome', 'delivered')))
      .ownedBy(PUBLISHER)
      .orderBy(desc('observedAt'))
      .limit(50)
      .fetch();
    render(toRows(page.entities), 'Recently observed leaks (last 30 days, delivered)', 'No observations published in the last 30 days yet.');
    $('status').textContent = `${page.entities.length} observation(s) read live from Arkiv.`;
  } catch (e) {
    $('status').textContent = `Could not reach Arkiv: ${(e as Error).message.split('\n')[0]}`;
  }
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = ($('site') as HTMLInputElement).value.trim();
  if (v) void lookup(v);
});
$('publisher').textContent = PUBLISHER;
// /registry/?site=etherscan.io (from the homepage form) looks the site up directly.
const requested = new URLSearchParams(location.search).get('site');
if (requested) {
  ($('site') as HTMLInputElement).value = requested;
  void lookup(requested);
} else {
  void recent();
}
