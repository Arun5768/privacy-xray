import type { Leak } from '../shared/types.ts';

type View = { leaks: Leak[]; addresses: string[]; protect: boolean; pageUrl: string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let tabId = -1;
let view: View = { leaks: [], addresses: [], protect: false, pageUrl: '' };

function esc(s: string | undefined): string {
  return (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Left the browser, or may have: everything not stopped by us or by the browser.
const exposed = (l: Leak) => !l.blocked && l.outcome !== 'blocked-by-browser';

function statusText(l: Leak): string {
  if (l.blocked) return 'blocked by Privacy X-Ray before sending';
  if (l.outcome === 'blocked-by-browser') return 'attempted; blocked by your browser (e.g. Shields, ad blocker)';
  if (l.outcome === 'delivered') return 'delivered to the recipient';
  if (l.outcome === 'failed') return 'left the page; delivery failed (network error)';
  return 'sent';
}

function grade(leaks: Leak[]): string {
  const open = leaks.filter(exposed);
  if (!open.length) return 'A';
  const recipients = new Set(open.map((l) => l.recipientSite));
  const tracking = open.some((l) => l.category !== 'rpc');
  if (!tracking) return 'C';
  if (recipients.size >= 3) return 'F';
  return 'D';
}

function groupByRecipient(leaks: Leak[]): Map<string, Leak[]> {
  const m = new Map<string, Leak[]>();
  for (const l of leaks) {
    const list = m.get(l.recipientSite) ?? [];
    list.push(l);
    m.set(l.recipientSite, list);
  }
  return m;
}

function render() {
  const { leaks, addresses, protect, pageUrl } = view;
  const open = leaks.filter(exposed);
  const recipients = groupByRecipient(leaks);

  const status = $('status');
  if (!addresses.length) {
    status.className = 'status idle';
    status.textContent = '● Waiting for a wallet address: connect your wallet or add one below';
  } else if (open.length) {
    status.className = 'status bad';
    const n = new Set(open.map((l) => l.recipientSite)).size;
    status.textContent = `● ${open.length} leak${open.length > 1 ? 's' : ''} of your address sent to ${n} third part${n === 1 ? 'y' : 'ies'}`;
  } else if (leaks.length) {
    status.className = 'status';
    status.textContent = `● Protected: ${leaks.length} attempt${leaks.length > 1 ? 's' : ''} to send your address blocked`;
  } else {
    status.className = 'status';
    status.textContent = '● No third party has received your address on this page';
  }

  $('grade').textContent = addresses.length ? grade(leaks) : '–';
  $('page').textContent = pageUrl ? new URL(pageUrl).host : '';

  const list = $('list');
  if (!leaks.length) {
    list.innerHTML = `<div class="empty"><strong>Nothing caught yet</strong>Use the dApp normally. Any request that carries your wallet address to another company shows up here with proof.</div>`;
  } else {
    list.innerHTML = [...recipients.entries()]
      .map(([site, items]) => {
        const first = items[0];
        const sent = items.filter(exposed).length;
        const tags = [
          `<span class="tag ${first.category}">${first.category}</span>`,
          ...new Set(items.map((l) => `<span class="tag">${esc(l.location)}</span>`)),
          sent ? `<span class="tag sent">sent</span>` : `<span class="tag blocked">blocked</span>`,
        ].join('');
        const proofs = items
          .map(
            (l) => `<div class="proof">
              <div class="row"><span>Request</span><code>${esc(l.method)} ${esc(l.requestUrl)}</code></div>
              <div class="row"><span>Found in</span><code>${esc(l.location)} · ${esc(l.transform)}</code></div>
              ${l.initiatorScript ? `<div class="row"><span>Sent by</span><code>${esc(l.initiatorScript)}</code></div>` : ''}
              <div class="row"><span>Status</span><code>${esc(statusText(l))} · ${new Date(l.ts).toLocaleTimeString()}</code></div>
              <div class="snippet">${esc(l.snippet)}</div>
            </div>`,
          )
          .join('');
        const hint =
          first.category === 'rpc'
            ? `<div class="hint">Your RPC provider can link this address to your IP. Protect never blocks RPC (the dApp would break). A private option is the Ethereum Foundation's <a href="https://ethereum.github.io/anon-rpc/" target="_blank" rel="noopener noreferrer">Anon-RPC</a>.</div>`
            : '';
        return `<details class="recipient">
          <summary>
            <span><div class="who">${esc(first.company)}</div><div class="site">${esc(first.recipientHost)}</div></span>
            <span class="count ${sent ? '' : 'safe'}">${items.length}×</span>
            <div class="tags">${tags}</div>
          </summary>${hint}${proofs}</details>`;
      })
      .join('');
  }

  ($('protect') as HTMLInputElement).checked = protect;
  $('addresses').innerHTML = addresses.length
    ? addresses.map((a) => `<span class="chip">${esc(a)}</span>`).join('')
    : '<span class="chip">none yet</span>';
}

async function refresh() {
  view = await chrome.runtime.sendMessage({ type: 'get', tabId });
  render();
}

function report(): string {
  const { leaks, pageUrl } = view;
  const lines = [
    `# Privacy X-Ray evidence report`,
    ``,
    `- Page: ${pageUrl}`,
    `- Extension version: ${chrome.runtime.getManifest().version}`,
    `- Generated: ${new Date().toISOString()}`,
    `- Grade: ${grade(leaks)}`,
    `- Leaks: ${leaks.length} (${leaks.filter(exposed).length} exposed, ${leaks.filter((l) => !exposed(l)).length} stopped)`,
    ``,
    `| Recipient | Company | Category | Where | Encoding | Status |`,
    `|---|---|---|---|---|---|`,
    ...leaks.map((l) => `| ${l.recipientHost} | ${l.company ?? ''} | ${l.category} | ${l.location} | ${l.transform} | ${statusText(l)} |`),
    ``,
    `## Evidence`,
    ...leaks.flatMap((l, i) => [
      ``,
      `### ${i + 1}. ${l.company ?? l.recipientHost}`,
      `- Request: \`${l.method} ${l.requestUrl}\``,
      `- Found in: ${l.location}, encoded as ${l.transform}`,
      l.initiatorScript ? `- Sent by script: ${l.initiatorScript}` : `- Sent by script: unknown`,
      `- Time: ${new Date(l.ts).toISOString()}`,
      `- Context: \`${l.snippet}\``,
    ]),
    ``,
    `## Notes`,
    `- Addresses and hashes are redacted in this report. Only observed requests are listed; nothing is inferred.`,
    `- Under EDPB Guidelines 02/2025 on blockchain (v2.0, adopted July 2026), a wallet address is personal data once it can be linked to a person, and hashing it does not change that.`,
    `- Limitations: requests whose body is a Blob or stream are checked at the network layer only; encrypted or custom-encoded payloads may be missed.`,
  ];
  return lines.join('\n');
}

function reportJson(): string {
  const { leaks, pageUrl } = view;
  return JSON.stringify(
    {
      tool: 'Privacy X-Ray',
      version: chrome.runtime.getManifest().version,
      page: pageUrl,
      site: leaks[0]?.pageSite ?? (pageUrl ? new URL(pageUrl).host : ''),
      generated: new Date().toISOString(),
      grade: grade(leaks),
      companies: [...new Set(leaks.map((l) => l.company ?? l.recipientSite))],
      categories: [...new Set(leaks.map((l) => l.category))],
      leaks: leaks.map(({ tabId: _tabId, ...rest }) => rest),
    },
    null,
    2,
  );
}

function save(text: string, type: string, ext: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const host = view.pageUrl ? new URL(view.pageUrl).host.replace(/[^a-z0-9.-]/gi, '_') : 'page';
  a.download = `privacy-xray-${host}-${Date.now()}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function main() {
  // ?tab=<id> lets the end-to-end test render the popup for a specific tab.
  const forced = Number(new URLSearchParams(location.search).get('tab'));
  const [tab] = forced ? [] : await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = forced || (tab?.id ?? -1);
  await refresh();

  $('protect').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({ type: 'setProtect', on: (e.target as HTMLInputElement).checked });
    await refresh();
  });
  $('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('addInput') as HTMLInputElement;
    const res = await chrome.runtime.sendMessage({ type: 'addAddress', address: input.value });
    $('addError').textContent = res?.ok ? '' : res?.error ?? 'Could not add address';
    if (res?.ok) input.value = '';
    await refresh();
  });
  $('export').addEventListener('click', () => save(report(), 'text/markdown', 'md'));
  $('exportJson').addEventListener('click', () => save(reportJson(), 'application/json', 'json'));
  $('clear').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'clearTab', tabId });
    await refresh();
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'leaks-changed' && msg.tabId === tabId) void refresh();
  });
}

void main();
