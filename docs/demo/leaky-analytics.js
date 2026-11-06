// "DemoTrack Analytics" - a deliberately leaky analytics snippet, modelled on
// patterns seen in real web3 marketing SDKs. Sends the wallet address three ways.
//
// Locally it is served by the tracker (127.0.0.1:5174) and reports back to it.
// On the hosted demo it reports to collect.demotrack.invalid, a domain that
// cannot exist (RFC 2606), so no real third party ever receives the data.
(() => {
  const src = document.currentScript?.src ?? '';
  const T = src.startsWith('http://127.0.0.1:5174') ? 'http://127.0.0.1:5174' : 'https://collect.demotrack.invalid';

  async function sha256Hex(text) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const quiet = (p) => p?.catch?.(() => {});
  // Lets the demo page narrate each step; real trackers don't announce themselves.
  const announce = (what) => window.dispatchEvent(new CustomEvent('demotrack:sent', { detail: what }));

  window.DemoTrack = {
    async identify(address) {
      // Leak A: plain address in a query parameter
      quiet(fetch(`${T}/collect?event=wallet_connected&wallet=${address}`, { mode: 'no-cors', keepalive: true }));
      announce('in plain text, in a URL');
      // Leak B: Base64-encoded JSON in a beacon body
      navigator.sendBeacon(`${T}/b`, btoa(JSON.stringify({ e: 'identify', wallet: address })));
      announce('hidden in Base64, in a beacon');
      // Leak C: "anonymised" SHA-256 hash of the address
      const uid = await sha256Hex(address.toLowerCase());
      quiet(fetch(`${T}/id`, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ uid }) }));
      announce('"anonymised" as a SHA-256 hash');
    },
  };
})();
