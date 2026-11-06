// Isolated-world bridge between the page hook (inject.ts) and the extension.
// It never sends watched addresses into the page; the hook only learns
// addresses the page itself received from the wallet.

function post(protect: boolean) {
  window.postMessage({ __pxrCfg: true, protect }, '*');
}

function send(msg: unknown) {
  try {
    chrome.runtime.sendMessage(msg).catch(() => {});
  } catch {
    // Extension was reloaded; this page's bridge is stale.
  }
}

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.__pxr !== true) return;
  send({ type: 'from-page', kind: e.data.kind, payload: e.data.payload });
});

try {
  chrome.runtime.sendMessage({ type: 'getConfig' }).then((c) => c && post(!!c.protect)).catch(() => {});
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'config') post(!!msg.protect);
  });
} catch {
  // ignore
}
