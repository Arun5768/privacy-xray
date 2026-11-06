import { buildNeedles, normalizeAddress, redactAddress, redactAll } from './shared/needles.ts';
import { scan } from './shared/detect.ts';
import { classify, hostOf, siteOf } from './shared/catalog.ts';
import type { Leak, LeakLocation, Match, Needle } from './shared/types.ts';

// All state lives in memory and chrome.storage.session (RAM only, cleared when
// the browser closes). Only the Protect switch is persisted to disk.
const state = {
  leaks: {} as Record<number, Leak[]>,
  addresses: [] as string[],
  protect: false,
};
let needles: Needle[] = [];
const tabUrls = new Map<number, string>();
// Per-tab activity, so the popup can show the work being done, not just results.
const activity = new Map<number, { checked: number; hosts: Set<string> }>();
const hints = new Map<string, { script: string; ts: number }>();
const ruleIds = new Map<string, number>();
const MAX_ADDRESSES = 10;

const ready = (async () => {
  const s = await chrome.storage.session.get(['leaks', 'addresses']);
  const l = await chrome.storage.local.get(['protect']);
  state.leaks = s.leaks ?? {};
  state.addresses = s.addresses ?? [];
  state.protect = !!l.protect;
  needles = buildNeedles(state.addresses);
  await syncRules();
})();

let persistTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    chrome.storage.session.set({ leaks: state.leaks, addresses: state.addresses });
  }, 200);
}

function setAddresses(list: string[]) {
  state.addresses = [...new Set(list.map(normalizeAddress).filter((a): a is string => !!a))].slice(-MAX_ADDRESSES);
  needles = buildNeedles(state.addresses);
  persist();
}

// Left the browser, or may have: everything not stopped by us or by the browser.
function isExposed(l: Leak): boolean {
  return !l.blocked && l.outcome !== 'blocked-by-browser';
}

function updateBadge(tabId: number) {
  const leaks = state.leaks[tabId] ?? [];
  const open = leaks.filter(isExposed).length;
  const text = leaks.length ? String(leaks.length) : '';
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: open ? '#E5484D' : '#30A46C' }).catch(() => {});
}

// ---- Blocking (declarativeNetRequest session rules) -----------------------
// MV3 cannot cancel requests from webRequest, so once a recipient is caught
// leaking, Protect blocks that recipient's host. RPC providers are never
// blocked because that would break the dApp.

function ruleIdFor(host: string): number {
  let id = ruleIds.get(host);
  if (!id) {
    id = ruleIds.size + 1;
    ruleIds.set(host, id);
  }
  return id;
}

async function syncRules() {
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  const removeRuleIds = existing.map((r) => r.id);
  const hosts = new Set<string>();
  if (state.protect) {
    for (const leaks of Object.values(state.leaks)) {
      for (const l of leaks) if (l.category !== 'rpc') hosts.add(l.recipientHost);
    }
  }
  const addRules = [...hosts].map((host) => ({
    id: ruleIdFor(host),
    priority: 1,
    action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
    // Only third-party use is blocked; the recipient's own site keeps working.
    // Data-carrying request types only: scripts still load, so the page hook can
    // catch and report each attempt as "blocked" instead of the page going silent.
    condition: {
      requestDomains: [host],
      excludedInitiatorDomains: [host],
      resourceTypes: [
        chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
        chrome.declarativeNetRequest.ResourceType.PING,
        chrome.declarativeNetRequest.ResourceType.IMAGE,
        chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
        chrome.declarativeNetRequest.ResourceType.OTHER,
      ],
    },
  }));
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds, addRules });
}

// ---- Recording ------------------------------------------------------------

type Raw = {
  tabId: number;
  pageUrl: string;
  requestUrl: string;
  method: string;
  resourceType: string;
  body: string | null;
  match: Match;
  blocked: boolean;
  initiatorScript?: string;
  requestId?: string;
};

function record(r: Raw) {
  const kind = classify(r.requestUrl, r.body);
  const requestUrl = redactAll(r.requestUrl, needles);
  const leak: Leak = {
    id: crypto.randomUUID(),
    tabId: r.tabId,
    pageOrigin: safeOrigin(r.pageUrl),
    pageSite: siteOf(r.pageUrl),
    requestUrl,
    method: r.method,
    resourceType: r.resourceType,
    recipientSite: siteOf(r.requestUrl),
    recipientHost: hostOf(r.requestUrl),
    company: kind.company,
    category: kind.category,
    location: r.match.location,
    transform: r.match.transform,
    snippet: r.match.snippet,
    initiatorScript: r.initiatorScript ?? hints.get(r.requestUrl)?.script,
    blocked: r.blocked,
    requestId: r.requestId,
    outcome: r.requestId ? pendingOutcomes.get(r.requestId) : undefined,
    ts: Date.now(),
    addressRef: redactAddress(r.match.address),
  };
  const list = (state.leaks[r.tabId] ??= []);
  const dupe = list.find(
    (l) => l.requestUrl === leak.requestUrl && l.location === leak.location && l.transform === leak.transform && l.blocked === leak.blocked,
  );
  if (dupe) return;
  list.push(leak);
  updateBadge(r.tabId);
  persist();
  if (state.protect && leak.category !== 'rpc') syncRules();
  chrome.runtime.sendMessage({ type: 'leaks-changed', tabId: r.tabId }).catch(() => {});
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function isThirdParty(pageUrl: string, requestUrl: string): boolean {
  if (!/^https?:|^wss?:/.test(requestUrl) || !/^https?:/.test(pageUrl)) return false;
  return siteOf(pageUrl) !== siteOf(requestUrl);
}

function decodeBody(body: chrome.webRequest.WebRequestBody | null | undefined): string | null {
  if (!body) return null;
  if (body.formData) return new URLSearchParams(Object.entries(body.formData).flatMap(([k, vs]) => vs.map((v) => [k, String(v)]))).toString();
  if (body.raw?.length) {
    const dec = new TextDecoder();
    let s = '';
    for (const part of body.raw) if (part.bytes) s += dec.decode(part.bytes);
    return s || null;
  }
  return null;
}

// ---- Network observation (primary detector) -------------------------------

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    if (details.type === 'main_frame') {
      // A new top-level page starts a fresh report for that tab.
      tabUrls.set(details.tabId, details.url);
      activity.set(details.tabId, { checked: 0, hosts: new Set() });
      void ready.then(() => {
        state.leaks[details.tabId] = [];
        updateBadge(details.tabId);
        persist();
      });
      return;
    }
    void ready.then(() => {
      if (!needles.length) return;
      const pageUrl = details.initiator ?? tabUrls.get(details.tabId) ?? '';
      if (!isThirdParty(pageUrl, details.url)) return;
      const a = activity.get(details.tabId) ?? { checked: 0, hosts: new Set<string>() };
      a.checked++;
      a.hosts.add(hostOf(details.url));
      activity.set(details.tabId, a);
      const body = decodeBody(details.requestBody);
      const match = scan(details.url, needles, 'query') ?? scan(body, needles, 'body');
      if (!match) return;
      record({ tabId: details.tabId, pageUrl, requestUrl: details.url, method: details.method, resourceType: details.type, body, match, blocked: false, requestId: details.requestId });
    });
  },
  { urls: ['<all_urls>'] },
  ['requestBody'],
);

// ---- Outcomes -------------------------------------------------------------
// A request we saw may still be stopped later by the browser itself (Brave
// Shields, an ad blocker) or fail. Track that so the popup never overstates.

const pendingOutcomes = new Map<string, Leak['outcome']>();

function setOutcome(tabId: number, requestId: string, outcome: Leak['outcome']) {
  if (tabId < 0) return;
  void ready.then(() => {
    const leak = state.leaks[tabId]?.find((l) => l.requestId === requestId);
    if (!leak) {
      // The scan may finish after the request does; remember briefly.
      pendingOutcomes.set(requestId, outcome);
      if (pendingOutcomes.size > 500) pendingOutcomes.delete(pendingOutcomes.keys().next().value!);
      return;
    }
    leak.outcome = outcome;
    updateBadge(tabId);
    persist();
    chrome.runtime.sendMessage({ type: 'leaks-changed', tabId }).catch(() => {});
  });
}

chrome.webRequest.onCompleted.addListener((d) => setOutcome(d.tabId, d.requestId, 'delivered'), { urls: ['<all_urls>'] });
chrome.webRequest.onErrorOccurred.addListener(
  (d) => setOutcome(d.tabId, d.requestId, d.error === 'net::ERR_BLOCKED_BY_CLIENT' ? 'blocked-by-browser' : 'failed'),
  { urls: ['<all_urls>'] },
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.tabId < 0 || details.type === 'main_frame') return;
    void ready.then(() => {
      if (!needles.length) return;
      const pageUrl = details.initiator ?? tabUrls.get(details.tabId) ?? '';
      if (!isThirdParty(pageUrl, details.url)) return;
      for (const h of details.requestHeaders ?? []) {
        const name = h.name.toLowerCase();
        const where: LeakLocation | null = name === 'cookie' ? 'cookie' : name === 'referer' ? 'header' : null;
        if (!where) continue;
        const match = scan(h.value, needles, where);
        if (match) {
          record({ tabId: details.tabId, pageUrl, requestUrl: details.url, method: details.method, resourceType: details.type, body: null, match, blocked: false });
        }
      }
    });
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders', 'extraHeaders'],
);

// First install: open the local welcome page (part of the extension, no network).
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete state.leaks[tabId];
  tabUrls.delete(tabId);
  activity.delete(tabId);
  persist();
});


// ---- Messages -------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  void ready.then(async () => {
    switch (msg?.type) {
      case 'from-page': {
        const tabId = sender.tab?.id;
        if (tabId == null) return reply(null);
        const pageUrl = sender.url ?? sender.tab?.url ?? '';
        if (msg.kind === 'addresses' && Array.isArray(msg.payload)) {
          setAddresses([...state.addresses, ...msg.payload]);
        } else if (msg.kind === 'hint' && typeof msg.payload?.requestUrl === 'string') {
          hints.set(msg.payload.requestUrl, { script: String(msg.payload.initiatorScript ?? ''), ts: Date.now() });
          const redacted = redactAll(msg.payload.requestUrl, needles);
          for (const l of state.leaks[tabId] ?? []) if (l.requestUrl === redacted && !l.initiatorScript) l.initiatorScript = msg.payload.initiatorScript;
          pruneHints();
        } else if (msg.kind === 'leak' && msg.payload) {
          // Requests stopped inside the page (Protect) or sent over WebSocket
          // never reach webRequest, so the page hook reports them directly.
          const p = msg.payload;
          const match = scan(p.requestUrl, needles, 'query') ?? scan(p.body, needles, p.location === 'websocket' ? 'websocket' : 'body');
          if (match && isThirdParty(pageUrl, p.requestUrl)) {
            record({ tabId, pageUrl, requestUrl: p.requestUrl, method: p.method, resourceType: p.resourceType, body: p.body ?? null, match, blocked: !!p.blocked, initiatorScript: p.initiatorScript });
          }
        }
        return reply(null);
      }
      case 'getConfig':
        return reply({ protect: state.protect });
      case 'get': {
        const tab = msg.tabId as number;
        return reply({
          leaks: state.leaks[tab] ?? [],
          addresses: state.addresses.map(redactAddress),
          protect: state.protect,
          pageUrl: tabUrls.get(tab) ?? '',
          checked: activity.get(tab)?.checked ?? 0,
          hosts: [...(activity.get(tab)?.hosts ?? [])].sort(),
        });
      }
      case 'setProtect': {
        state.protect = !!msg.on;
        await chrome.storage.local.set({ protect: state.protect });
        await syncRules();
        const tabs = await chrome.tabs.query({});
        for (const t of tabs) if (t.id != null) chrome.tabs.sendMessage(t.id, { type: 'config', protect: state.protect }).catch(() => {});
        return reply({ ok: true });
      }
      case 'addAddress': {
        const a = normalizeAddress(msg.address);
        if (!a) return reply({ ok: false, error: 'Not a valid 0x address' });
        setAddresses([...state.addresses, a]);
        return reply({ ok: true });
      }
      case 'clearAddresses':
        setAddresses([]);
        return reply({ ok: true });
      case 'clearTab':
        state.leaks[msg.tabId] = [];
        updateBadge(msg.tabId);
        persist();
        return reply({ ok: true });
      default:
        return reply(null);
    }
  });
  return true;
});

function pruneHints() {
  const cutoff = Date.now() - 60_000;
  for (const [k, v] of hints) if (v.ts < cutoff) hints.delete(k);
}
