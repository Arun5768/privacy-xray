// "DemoTrack Analytics" - a deliberately leaky analytics snippet, modelled on
// patterns seen in real web3 marketing SDKs. Sends the wallet address three ways.
(() => {
  const T = 'http://127.0.0.1:5174';

  async function sha256Hex(text) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  window.DemoTrack = {
    async identify(address) {
      // Leak A: plain address in a query parameter
      fetch(`${T}/collect?event=wallet_connected&wallet=${address}`, { mode: 'no-cors', keepalive: true });
      // Leak B: Base64-encoded JSON in a beacon body
      navigator.sendBeacon(`${T}/b`, btoa(JSON.stringify({ e: 'identify', wallet: address })));
      // Leak C: "anonymised" SHA-256 hash of the address
      const uid = await sha256Hex(address.toLowerCase());
      fetch(`${T}/id`, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ uid }) });
    },
  };
})();
