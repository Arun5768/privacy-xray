// Live status bar (Obscura-style): describes this browser's real situation.
// It only reads local state; it never asks the wallet for accounts and never
// sends anything over the network.
(() => {
  const bar = document.getElementById('live');
  const text = document.getElementById('liveText');
  const wallets = new Set();

  window.addEventListener('eip6963:announceProvider', (e) => {
    const name = e.detail?.info?.name;
    if (name) wallets.add(name);
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  function legacyName() {
    const eth = window.ethereum;
    if (!eth) return null;
    if (eth.isBraveWallet) return 'Brave Wallet';
    if (eth.isRabby) return 'Rabby';
    if (eth.isCoinbaseWallet) return 'Coinbase Wallet';
    if (eth.isMetaMask) return 'MetaMask';
    return 'a browser wallet';
  }

  function render() {
    const xray = !!window.__pxrInstalled;
    const legacy = legacyName();
    const names = [...wallets];
    if (!names.length && legacy) names.push(legacy);

    if (xray) {
      bar.className = 'live ok';
      text.textContent = `Privacy X-Ray is active in this browser${names.length ? ` · watching ${names.join(', ')}` : ''}`;
    } else if (names.length) {
      bar.className = 'live bad';
      text.textContent = `${names.join(', ')} detected · any site you connect to can pass your address on, and nothing here would tell you`;
    } else {
      bar.className = 'live idle';
      text.textContent = 'No wallet detected in this browser · install X-Ray before you connect one';
    }
  }

  setTimeout(render, 400);
})();
