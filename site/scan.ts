// Exposure report: "what does anyone who gets this address learn?"
// Runs only when the user presses Run. Contacts PublicNode's public RPCs and
// Arkiv's public endpoint, read-only. Bundled to docs/scan/scan.js.
import { createPublicClient, erc20Abi, formatUnits, http, isAddress, type Address } from 'viem';
import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains';
import { normalize } from 'viem/ens';
import { createPublicClient as createArkivClient } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { desc, eq } from '@arkiv-network/sdk/query';
import { Observation, PUBLISHER } from '../src/shared/arkiv.ts';

const CHAINS = [
  { name: 'Ethereum', chain: mainnet, rpc: 'https://ethereum-rpc.publicnode.com', symbol: 'ETH' },
  { name: 'Base', chain: base, rpc: 'https://base-rpc.publicnode.com', symbol: 'ETH' },
  { name: 'Arbitrum', chain: arbitrum, rpc: 'https://arbitrum-one-rpc.publicnode.com', symbol: 'ETH' },
  { name: 'Optimism', chain: optimism, rpc: 'https://optimism-rpc.publicnode.com', symbol: 'ETH' },
  { name: 'Polygon', chain: polygon, rpc: 'https://polygon-bor-rpc.publicnode.com', symbol: 'POL' },
] as const;

const STABLES = [
  { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
] as const;

const SOCIAL_KEYS = [
  ['com.twitter', 'X / Twitter'],
  ['com.github', 'GitHub'],
  ['url', 'Website'],
  ['email', 'Email'],
  ['com.discord', 'Discord'],
  ['org.telegram', 'Telegram'],
] as const;

// ccipRead: false so ENS lookups never reach offchain gateways we haven't disclosed.
const clients = CHAINS.map((c) => createPublicClient({ chain: c.chain, transport: http(c.rpc), ccipRead: false }));
const eth = clients[0];

const $ = (id: string) => document.getElementById(id)!;
const short = (a: string) => a.slice(0, 6) + '…' + a.slice(-4);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (v: bigint, d: number) => {
  const n = Number(formatUnits(v, d));
  return n === 0 ? '0' : n < 0.0001 ? '<0.0001' : n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 });
};

function log(text: string, kind: 'run' | 'ok' | 'warn' | 'bad' = 'run') {
  const li = document.createElement('li');
  li.className = kind;
  li.textContent = text;
  $('log').append(li);
  $('log').scrollTop = $('log').scrollHeight;
  return li;
}

async function step<T>(label: string, fn: () => Promise<T>, done: (v: T) => string): Promise<T | null> {
  const li = log(`› ${label}`);
  try {
    const v = await fn();
    li.className = 'ok';
    li.textContent = `✓ ${done(v)}`;
    return v;
  } catch (e) {
    li.className = 'warn';
    li.textContent = `! ${label} failed: ${(e as Error).message.split('\n')[0].slice(0, 80)}`;
    return null;
  }
}

function setScore(score: number, verdict: string, color: string) {
  const ring = $('ring') as unknown as SVGCircleElement;
  const c = 2 * Math.PI * 52;
  ring.style.strokeDasharray = `${c}`;
  ring.style.strokeDashoffset = `${c * (1 - score / 100)}`;
  ring.style.stroke = color;
  const out = $('scoreNum');
  const t0 = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / 1200);
    out.textContent = String(Math.round(score * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  $('verdict').textContent = verdict;
  $('verdict').style.color = color;
}

function card(id: string, html: string) {
  const el = $(id);
  el.innerHTML = html;
  el.classList.add('in');
}

let running = false;
async function run(input: string) {
  if (running) return;
  running = true;
  $('report').hidden = false;
  $('log').innerHTML = '';
  for (const id of ['cIdentity', 'cMoney', 'cActivity', 'cWho', 'cFix']) {
    $(id).classList.remove('in');
    $(id).innerHTML = '<div class="skeleton"></div>';
  }
  setScore(0, 'Scanning…', '#a3a0b8');
  $('report').scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.replaceState(null, '', `?a=${encodeURIComponent(input)}`);

  try {
    // 1. Resolve the input
    let address: Address | null = null;
    let name: string | null = null;
    const q = input.trim();
    if (isAddress(q)) {
      address = q;
    } else if (/\.[a-z]+$/i.test(q)) {
      name = normalize(q);
      address = await step(`Resolving ${name} on Ethereum…`, () => eth.getEnsAddress({ name: name! }), (a) => (a ? `${name} → ${short(a)}` : `${name} has no address`));
    }
    if (!address) {
      log('✗ Not a valid address or ENS name.', 'bad');
      setScore(0, 'Nothing to scan', '#ff4fa3');
      return;
    }
    $('who').textContent = name ?? short(address);

    // 2. Identity
    if (!name) {
      name = await step('Looking for a public name (ENS)…', () => eth.getEnsName({ address: address! }), (n) => (n ? `Public name found: ${n}` : 'No public name'));
    }
    const socials: [string, string][] = [];
    if (name) {
      const values = await step(
        'Reading profile records linked to the name…',
        () => Promise.all(SOCIAL_KEYS.map(([key]) => eth.getEnsText({ name: name!, key }).catch(() => null))),
        (v) => `${v.filter(Boolean).length} linked profile record(s)`,
      );
      values?.forEach((v, i) => v && socials.push([SOCIAL_KEYS[i][1], v]));
    }
    card(
      'cIdentity',
      `<span class="chip pink">Identity</span><h3>${name ? `Your address is <em>${esc(name)}</em>` : 'No public name'}</h3>` +
        (socials.length
          ? `<ul class="kv">${socials.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul><p>Anyone with your address can read these and link your wallet to you.</p>`
          : `<p>${name ? 'The name is public, but no social profiles are linked to it.' : 'Good: nothing on ENS links this address to a name.'}</p>`),
    );

    // 3. Money and activity across chains
    const perChain = await step(
      `Checking balances and activity on ${CHAINS.length} chains…`,
      () =>
        Promise.all(
          clients.map(async (c, i) => {
            const [bal, txs] = await Promise.all([c.getBalance({ address: address! }), c.getTransactionCount({ address: address! })]);
            return { ...CHAINS[i], bal, txs };
          }).map((p) => p.catch(() => null)),
        ),
      (v) => `${v.filter((x) => x && (x.bal > 0n || x.txs > 0)).length} chain(s) with activity`,
    );
    const stables = await step(
      'Checking stablecoin balances on Ethereum…',
      () => Promise.all(STABLES.map((t) => eth.readContract({ address: t.address, abi: erc20Abi, functionName: 'balanceOf', args: [address!] }).then((v) => ({ ...t, v })).catch(() => ({ ...t, v: 0n })))),
      (v) => `${v.filter((t) => t.v > 0n).length} stablecoin(s) held`,
    );
    const chains = (perChain ?? []).filter((x): x is NonNullable<typeof x> => !!x);
    const active = chains.filter((x) => x.bal > 0n || x.txs > 0);
    const totalTxs = chains.reduce((s, x) => s + x.txs, 0);
    card(
      'cMoney',
      `<span class="chip lime">Money</span><h3>What you hold is <em>public</em></h3><ul class="kv">${chains
        .map((x) => `<li><span>${x.name}</span><b>${fmt(x.bal, 18)} ${x.symbol}</b></li>`)
        .join('')}${(stables ?? []).filter((t) => t.v > 0n).map((t) => `<li><span>${t.symbol}</span><b>${fmt(t.v, t.decimals)}</b></li>`).join('')}</ul>`,
    );
    card(
      'cActivity',
      `<span class="chip violet">Activity</span><h3><em>${totalTxs.toLocaleString()}</em> transactions sent</h3><div class="bars">${chains
        .map((x) => {
          const pct = totalTxs ? Math.max(3, Math.round((x.txs / totalTxs) * 100)) : 0;
          return `<div class="bar"><span>${x.name}</span><i style="--w:${pct}%"></i><b>${x.txs.toLocaleString()}</b></div>`;
        })
        .join('')}</div><p>Active on ${active.length} of ${chains.length} chains. Every one of these is linked to the same address.</p>`,
    );

    // 4. Who would receive it: the public registry on Arkiv
    const arkiv = createArkivClient({ chain: rabdi({ accessKey: '' }), transport: http() });
    const obs = await step(
      'Checking the public leak registry on Arkiv…',
      () =>
        arkiv
          .select({ site: true, recipientHost: true, company: true, outcome: true })
          .from(Observation)
          .where(eq('outcome', 'delivered'))
          .ownedBy(PUBLISHER)
          .orderBy(desc('observedAt'))
          .limit(20)
          .fetch(),
      (p) => `${p.entities.length} recent observation(s)`,
    );
    const rows = obs?.entities ?? [];
    card(
      'cWho',
      `<span class="chip cyan">Who gets it</span><h3>Look yourself up and they <em>see you</em></h3>` +
        (rows.length
          ? `<ul class="kv">${rows.map((r: any) => `<li><span>${esc(r.site.value)}</span><b>→ ${esc(r.company.value)}</b></li>`).join('')}</ul><p>Observed in our field test: opening an address page on these sites sent the address to these companies.</p>`
          : '<p>No recent observations in the registry.</p>'),
    );

    // 5. Score and advice
    let score = 0;
    if (name) score += 30;
    score += Math.min(25, socials.length * 10);
    if (active.some((x) => x.bal > 0n) || (stables ?? []).some((t) => t.v > 0n)) score += 15;
    if (active.length >= 2) score += 15;
    if (totalTxs >= 50) score += 15;
    score = Math.min(100, score);
    const [verdict, color] =
      score >= 70 ? ['Easy to profile', '#ff4fa3'] : score >= 40 ? ['Partly exposed', '#ff8a3c'] : score > 0 ? ['Low exposure', '#c8ff2e'] : ['Nothing linked', '#3cf0d4'];
    setScore(score, verdict, color);

    const tips = [
      name && socials.length ? 'Your name and profiles are linked to this address. Use a fresh address for apps you don\'t trust.' : null,
      active.length >= 2 ? 'The same address on several chains links all that activity together. Separate addresses per purpose help.' : null,
      'Install the 0xRay extension to see, live, which companies a dApp sends this address to, and block them.',
      rows.length ? 'Avoid looking yourself up on sites in the registry while logged in or on your home IP.' : null,
      'Your RPC provider sees your address and IP. Consider the EF\'s Anon-RPC.',
    ].filter(Boolean) as string[];
    card('cFix', `<span class="chip lime">Fix it</span><h3>What to do <em>next</em></h3><ol class="tips">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ol><a class="btn btn-lime small" href="../privacy-xray-extension.zip" download>Get 0xRay →</a>`);
    log('✓ Report ready. Nothing was saved; close the tab and it is gone.', 'ok');
  } finally {
    running = false;
  }
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = ($('addr') as HTMLInputElement).value;
  if (v.trim()) void run(v);
});
$('sample').addEventListener('click', () => {
  ($('addr') as HTMLInputElement).value = 'vitalik.eth';
  void run('vitalik.eth');
});

// Coming from the homepage form: prefill, but still wait for the user to press Run.
const pre = new URLSearchParams(location.search).get('a');
if (pre) {
  ($('addr') as HTMLInputElement).value = pre;
  $('preNote').hidden = false;
}
