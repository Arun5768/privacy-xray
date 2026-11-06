// Site interactions. Everything here is local: no network requests, no wallet
// prompts. It only reads what this browser already exposes to every page.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  // ---- Live status bar ------------------------------------------------------
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

  setTimeout(() => {
    const names = [...wallets];
    const legacy = legacyName();
    if (!names.length && legacy) names.push(legacy);
    if (window.__pxrInstalled) {
      bar.className = 'live ok';
      text.textContent = `0xRay is active in this browser${names.length ? ` · watching ${names.join(', ')}` : ''}`;
    } else if (names.length) {
      bar.className = 'live bad';
      text.textContent = `${names.join(', ')} detected · any site you connect to can pass your address on, and nothing here would tell you`;
    } else {
      bar.className = 'live idle';
      text.textContent = 'No wallet detected in this browser · install 0xRay before you connect one';
    }
  }, 400);

  // ---- Headline: split into words that rise in one after another -------------
  for (const el of document.querySelectorAll('.words')) {
    let i = 0;
    const wrap = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          for (const part of child.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) {
              frag.append(part);
            } else {
              const s = document.createElement('span');
              s.className = 'w';
              s.style.animationDelay = `${0.05 + i++ * 0.07}s`;
              s.textContent = part;
              frag.append(s);
            }
          }
          child.replaceWith(frag);
        } else {
          wrap(child);
        }
      }
    };
    wrap(el);
  }

  // ---- Typewriter: who might be receiving your address ----------------------
  const type = document.getElementById('type');
  const targets = ['Google Analytics', 'an ad network', 'a marketing SDK', 'your RPC provider', 'an error tracker', 'a data broker'];
  if (type && !reduced) {
    let t = 0;
    let n = targets[0].length;
    let deleting = true;
    const tick = () => {
      const word = targets[t];
      type.textContent = word.slice(0, n);
      if (deleting) {
        if (n > 0) n--;
        else {
          deleting = false;
          t = (t + 1) % targets.length;
        }
        setTimeout(tick, n === 0 ? 250 : 35);
      } else if (n < targets[t].length) {
        n++;
        type.textContent = targets[t].slice(0, n);
        setTimeout(tick, 70);
      } else {
        deleting = true;
        setTimeout(tick, 1800);
      }
    };
    setTimeout(tick, 2200);
  }

  // ---- The logo's eye follows the cursor ------------------------------------
  const eye = document.querySelector('.logo .eye');
  const pupil = eye?.querySelector('.pupil');
  if (eye && pupil && !reduced) {
    window.addEventListener('pointermove', (e) => {
      const r = eye.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, len / 400);
      pupil.setAttribute('transform', `translate(${((dx / len) * 14 * k).toFixed(1)} ${((dy / len) * 8 * k).toFixed(1)})`);
    });
  }

  // ---- Scroll reveals and counters ------------------------------------------
  const countUp = (el) => {
    const end = Number(el.dataset.count);
    if (reduced || !end) return;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / 1200);
      el.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        e.target.querySelectorAll('[data-count]').forEach(countUp);
        io.unobserve(e.target);
      }
    },
    { threshold: 0.15 },
  );
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
})();
