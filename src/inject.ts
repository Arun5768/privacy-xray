// Runs in the page's own JavaScript world at document_start.
// 1. Learns the connected address by watching the wallet provider's replies.
// 2. Checks fetch / XHR / sendBeacon / WebSocket sends for that address and,
//    when Protect is on, stops them before they leave the page.
import { buildNeedles, normalizeAddress } from './shared/needles.ts';
import { scan } from './shared/detect.ts';
import { siteOf } from './shared/catalog.ts';
import type { Needle } from './shared/types.ts';

(() => {
  const w = window as any;
  if (w.__pxrInstalled) return;
  w.__pxrInstalled = true;

  let protect = false;
  const addresses = new Set<string>();
  let needles: Needle[] = [];

  const post = (kind: string, payload: unknown) => window.postMessage({ __pxr: true, kind, payload }, '*');

  window.addEventListener('message', (e) => {
    if (e.source === window && e.data?.__pxrCfg) protect = !!e.data.protect;
  });

  // ---- Wallet address discovery --------------------------------------------

  function note(accounts: unknown) {
    if (!Array.isArray(accounts)) return;
    let changed = false;
    for (const a of accounts) {
      const n = normalizeAddress(a);
      if (n && !addresses.has(n)) {
        addresses.add(n);
        changed = true;
      }
    }
    if (changed) {
      needles = buildNeedles([...addresses]);
      post('addresses', [...addresses]);
    }
  }

  const wrapped = new WeakSet<object>();
  function wrapProvider(p: any) {
    if (!p || typeof p !== 'object' || wrapped.has(p) || typeof p.request !== 'function') return;
    wrapped.add(p);
    const orig = p.request;
    const request = async function (this: unknown, args: any) {
      const result = await orig.call(p, args);
      if (args?.method === 'eth_requestAccounts' || args?.method === 'eth_accounts') note(result);
      return result;
    };
    try {
      p.request = request;
    } catch {
      try {
        Object.defineProperty(p, 'request', { value: request, configurable: true, writable: true });
      } catch {
        // Frozen provider: fall back to the address entered in the popup.
      }
    }
    try {
      p.on?.('accountsChanged', note);
    } catch {
      // ignore
    }
  }

  const tryWrap = () => {
    wrapProvider(w.ethereum);
    for (const p of w.ethereum?.providers ?? []) wrapProvider(p);
  };
  tryWrap();
  window.addEventListener('ethereum#initialized', tryWrap);
  window.addEventListener('eip6963:announceProvider', (e: any) => wrapProvider(e?.detail?.provider));
  let polls = 0;
  const iv = setInterval(() => {
    tryWrap();
    if (++polls > 60) clearInterval(iv);
  }, 250);

  // ---- Outgoing request checks ---------------------------------------------

  function bodyText(b: unknown): string | null {
    if (b == null) return null;
    if (typeof b === 'string') return b;
    if (b instanceof URLSearchParams) return b.toString();
    if (b instanceof FormData) {
      const parts: string[] = [];
      b.forEach((v, k) => typeof v === 'string' && parts.push(`${k}=${v}`));
      return parts.join('&');
    }
    if (b instanceof ArrayBuffer) return new TextDecoder().decode(b);
    if (ArrayBuffer.isView(b)) return new TextDecoder().decode(b as ArrayBufferView);
    return null; // Blob / ReadableStream cannot be read synchronously; webRequest still sees them.
  }

  function initiatorScript(): string | undefined {
    const stack = new Error().stack ?? '';
    for (const line of stack.split('\n')) {
      const m = line.match(/(https?:\/\/[^\s)]+?)(?::\d+){1,2}\)?\s*$/);
      if (m && !line.includes('chrome-extension://')) return m[1];
    }
    return undefined;
  }

  // Returns true when the request must be stopped.
  function check(url: string, body: string | null, method: string, resourceType: string): boolean {
    if (!needles.length) return false;
    let abs: string;
    try {
      abs = new URL(url, location.href).href;
    } catch {
      return false;
    }
    if (siteOf(abs) === siteOf(location.href)) return false;
    const ws = resourceType === 'websocket';
    const match = scan(abs, needles, 'query') ?? scan(body, needles, ws ? 'websocket' : 'body');
    if (!match) return false;
    const payload = { requestUrl: abs, method, resourceType, body, location: match.location, initiatorScript: initiatorScript(), blocked: protect };
    // webRequest records requests that actually go out; the hook reports only
    // what the network layer cannot see (blocked requests, WebSocket frames).
    post(protect || ws ? 'leak' : 'hint', payload);
    return protect;
  }

  const origFetch = window.fetch;
  window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (check(url, bodyText(init?.body), method, 'fetch')) return Promise.resolve(new Response(null, { status: 204 }));
    } catch {
      // never break the page
    }
    return origFetch.apply(this, arguments as any);
  } as typeof fetch;

  if (navigator.sendBeacon) {
    const origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      try {
        if (check(String(url), bodyText(data), 'POST', 'ping')) return true;
      } catch {
        // ignore
      }
      return origBeacon(url, data);
    };
  }

  const XHR = XMLHttpRequest.prototype;
  const origOpen = XHR.open;
  const origSend = XHR.send;
  XHR.open = function (this: any, method: string, url: string | URL) {
    this.__pxr = { method: String(method).toUpperCase(), url: String(url) };
    return origOpen.apply(this, arguments as any);
  } as typeof XHR.open;
  XHR.send = function (this: any, body?: Document | XMLHttpRequestBodyInit | null) {
    try {
      const m = this.__pxr;
      if (m && check(m.url, bodyText(body), m.method, 'xmlhttprequest')) return;
    } catch {
      // ignore
    }
    return origSend.apply(this, arguments as any);
  };

  const origWsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (this: WebSocket, data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    try {
      if (check(this.url, bodyText(data), 'WS', 'websocket')) return;
    } catch {
      // ignore
    }
    return origWsSend.call(this, data as any);
  };
})();
