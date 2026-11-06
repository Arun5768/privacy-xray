// Shared site behaviour: live status, motion, small interactions.
// Local only: no network requests, never asks a wallet for anything.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  document.documentElement.classList.add('js');
  document.body.insertAdjacentHTML('beforeend', '<div class="grain" aria-hidden="true"></div>');

  // ---- Live status bar ------------------------------------------------------
  const bar = document.getElementById('live');
  const text = document.getElementById('liveText');
  const root = document.querySelector('.logo')?.getAttribute('href') ?? './';
  const wallets = new Set();
  window.addEventListener('eip6963:announceProvider', (e) => {
    const name = e.detail?.info?.name;
    if (name) wallets.add(name);
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  setTimeout(() => {
    if (!bar) return;
    const eth = window.ethereum;
    const names = [...wallets];
    if (!names.length && eth) names.push(eth.isBraveWallet ? 'Brave Wallet' : eth.isRabby ? 'Rabby' : eth.isMetaMask ? 'MetaMask' : 'A browser wallet');
    if (window.__pxrInstalled) {
      bar.className = 'live ok';
      text.textContent = `0xRay is active in this browser${names.length ? ` · watching ${names.join(', ')}` : ''}`;
    } else if (names.length) {
      bar.className = 'live bad';
      text.innerHTML = '';
      text.append(`${names.join(', ')} detected · any site you connect to can pass your address on. `);
      const a = document.createElement('a');
      a.href = `${root}scan/`;
      a.textContent = 'See what it reveals →';
      text.append(a);
    } else {
      bar.className = 'live idle';
      text.textContent = 'No wallet detected in this browser';
    }
  }, 400);

  // ---- Word-by-word headline reveal -----------------------------------------
  for (const el of document.querySelectorAll('.words')) {
    let i = 0;
    const walk = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType !== Node.TEXT_NODE) {
          walk(child);
          continue;
        }
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.append(part);
            continue;
          }
          const s = document.createElement('span');
          s.className = 'w';
          s.style.animationDelay = `${0.05 + i++ * 0.08}s`;
          s.textContent = part;
          frag.append(s);
        }
        child.replaceWith(frag);
      }
    };
    walk(el);
  }

  // ---- Eye follows the cursor ------------------------------------------------
  const eyes = [...document.querySelectorAll('svg.eye, svg.big-eye')];
  if (!reduced && fine && eyes.length) {
    window.addEventListener('pointermove', (e) => {
      for (const eye of eyes) {
        const pupil = eye.querySelector('.pupil');
        if (!pupil) continue;
        const r = eye.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const len = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, len / 420);
        pupil.setAttribute('transform', `translate(${((dx / len) * 14 * k).toFixed(1)} ${((dy / len) * 8 * k).toFixed(1)})`);
      }
    });
  }

  // ---- Magnetic buttons and tilting cards ------------------------------------
  if (!reduced && fine) {
    for (const el of document.querySelectorAll('.magnetic')) {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => (el.style.transform = ''));
    }
    for (const el of document.querySelectorAll('.tilt')) {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
      });
      el.addEventListener('pointerleave', () => (el.style.transform = ''));
    }
  }

  // ---- Typewriter ------------------------------------------------------------
  for (const el of document.querySelectorAll('[data-type]')) {
    const words = el.dataset.type.split('|');
    if (reduced) {
      el.textContent = words[0];
      continue;
    }
    let w = 0;
    let n = 0;
    let del = false;
    const tick = () => {
      const word = words[w];
      n += del ? -1 : 1;
      el.textContent = word.slice(0, n);
      if (!del && n === word.length) {
        del = true;
        return setTimeout(tick, 1700);
      }
      if (del && n === 0) {
        del = false;
        w = (w + 1) % words.length;
        return setTimeout(tick, 220);
      }
      setTimeout(tick, del ? 30 : 65);
    };
    setTimeout(tick, 1200);
  }

  // ---- Scroll reveal + count-up ----------------------------------------------
  const countUp = (el) => {
    const end = Number(el.dataset.count);
    if (reduced || !end) return;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1400);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4))).toLocaleString();
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
        if (e.target.matches('[data-count]')) countUp(e.target);
        io.unobserve(e.target);
      }
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll('.reveal, [data-count]').forEach((el) => io.observe(el));

  // ---- Marquee: duplicate content for a seamless loop ------------------------
  for (const track of document.querySelectorAll('.marquee-track')) track.innerHTML += track.innerHTML;
})();
