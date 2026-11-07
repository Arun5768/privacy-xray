// Shared site behaviour: live status, motion, inspector, tabs, pixel field.
// Local only: no network requests, never asks a wallet for anything.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const $ = (id) => document.getElementById(id);
  document.documentElement.classList.add('js');

  // ---- Inspector log --------------------------------------------------------
  const body = $('insBody');
  let line = 1;
  function ins(html) {
    if (!body) return;
    const li = document.createElement('li');
    li.innerHTML = `<i>${String(line++).padStart(3, '0')}</i><span>${html}</span>`;
    body.append(li);
    while (body.children.length > 60) body.firstChild.remove();
  }
  const SCRIPT = [
    '<span class="c">// sample stream, not your traffic.</span>',
    '<span class="c">// install 0xRay to see the real one.</span>',
    '',
    '<span class="c">// 0xray.inspect(this.page)</span>',
    '<span class="k">const</span> address = wallet.<span class="s">shared</span>();',
    '<span class="k">const</span> needles = [plain, checksum,',
    '  sha256, keccak, sha1, md5, base64];',
    '',
    '<span class="k">for</span> (req <span class="k">of</span> page.outgoing) {',
    '  <span class="k">if</span> (firstParty(req)) <span class="k">continue</span>;',
    '  <span class="k">if</span> (req.carries(needles))',
    '    flag(req).<span class="bad">turn_pink</span>();',
    '}',
    '',
  ];
  const HOSTS = ['analytics.google.com', 'api.segment.io', 'api.mixpanel.com', 'eth-mainnet.g.alchemy.com', 'o12345.ingest.sentry.io', 'connect.facebook.net', 'api.amplitude.com', 'cdn.jsdelivr.net', 'fonts.gstatic.com', 'rpc.ankr.com', 'stats.g.doubleclick.net', 'api.hotjar.io'];
  const ENC = ['plain', 'base64', 'sha256(lc)', 'url-enc', 'keccak'];
  function streamLine() {
    const host = HOSTS[Math.floor(Math.random() * HOSTS.length)];
    const leak = /analytics|segment|mixpanel|alchemy|doubleclick|amplitude|facebook|ankr/.test(host) && Math.random() < 0.55;
    if (leak) {
      const enc = ENC[Math.floor(Math.random() * ENC.length)];
      ins(`<span class="bad">LEAK</span> ${host} <span class="c">· ${enc}</span>`);
    } else {
      ins(`<span class="ok">ok</span>   <span class="c">${host}</span>`);
    }
  }
  if (body) {
    SCRIPT.forEach((l, i) => setTimeout(() => ins(l || '&nbsp;'), reduced ? 0 : i * 90));
    if (!reduced) setTimeout(() => setInterval(streamLine, 900), SCRIPT.length * 90 + 400);
  }
  const insClose = $('insClose');
  if (insClose) {
    const open = document.createElement('button');
    open.className = 'ins-open';
    open.textContent = 'inspector.log';
    document.body.append(open);
    const set = (off) => {
      document.body.classList.toggle('ins-off', off);
      try {
        localStorage.setItem('ins-off', off ? '1' : '');
      } catch {}
    };
    insClose.addEventListener('click', () => set(true));
    open.addEventListener('click', () => set(false));
    try {
      if (localStorage.getItem('ins-off')) document.body.classList.add('ins-off');
    } catch {}
  }

  // ---- Phone menu (the pill hides its links on small screens) ----------------
  const pill = document.querySelector('.pill');
  const menu = $('pillMenu');
  if (pill && menu) {
    const close = () => {
      pill.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
    };
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.setAttribute('aria-expanded', String(pill.classList.toggle('open')));
    });
    document.addEventListener('click', (e) => !pill.contains(e.target) && close());
    addEventListener('keydown', (e) => e.key === 'Escape' && close());
  }

  // ---- Live status (in the pill) --------------------------------------------
  const live = $('live');
  const liveText = $('liveText');
  const wallets = new Set();
  window.addEventListener('eip6963:announceProvider', (e) => {
    const name = e.detail?.info?.name;
    if (name) wallets.add(name);
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  setTimeout(() => {
    if (!live) return;
    const eth = window.ethereum;
    const names = [...wallets];
    if (!names.length && eth) names.push(eth.isBraveWallet ? 'Brave Wallet' : eth.isMetaMask ? 'MetaMask' : 'a wallet');
    if (window.__pxrInstalled) {
      live.className = 'pill-live ok';
      liveText.textContent = '0xRay active';
      ins('<span class="ok">0xRay extension detected in this browser</span>');
    } else if (names.length) {
      live.className = 'pill-live bad';
      liveText.textContent = `${names[0]} exposed`;
      ins(`<span class="bad">${names.join(', ')}</span> detected · unprotected`);
    } else {
      live.className = 'pill-live idle';
      liveText.textContent = 'no wallet';
    }
  }, 500);

  // ---- Section tabs ---------------------------------------------------------
  const tabs = $('tabs');
  const sections = [...document.querySelectorAll('[data-tab]')];
  if (tabs && sections.length) {
    const links = sections.map((s) => {
      // Never reuse an id the page already has (e.g. registry's #results).
      if (!s.id) s.id = document.getElementById(s.dataset.tab) ? `${s.dataset.tab}-section` : s.dataset.tab;
      const a = document.createElement('a');
      a.className = 'tab';
      a.href = `#${s.id}`;
      a.textContent = `${s.dataset.tab}.section`;
      tabs.append(a);
      return a;
    });
    const tio = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = sections.indexOf(e.target);
          links.forEach((l, j) => l.classList.toggle('on', i === j));
          ins(`<span class="c">// scrolled to</span> <span class="s">${e.target.dataset.tab}</span>`);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    sections.forEach((s) => tio.observe(s));
  }

  // ---- Word reveal ----------------------------------------------------------
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

  // ---- Eyes follow the cursor ------------------------------------------------
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

  // ---- Hero: pixel network field with leak tags -----------------------------
  const canvas = $('field');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const CELL = 14;
    let cols = 0;
    let rows = 0;
    let cells = [];
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width;
      canvas.height = r.height;
      cols = Math.ceil(r.width / CELL);
      rows = Math.ceil(r.height / CELL);
      cells = Array.from({ length: cols * rows }, (_, i) => {
        const x = i % cols;
        const y = Math.floor(i / cols);
        // Buildings of "windows": denser in columns, like a skyline of apps.
        const tower = Math.sin(x * 0.37) + Math.sin(x * 0.11 + 2) > 0.3 && y > rows * (0.25 + 0.25 * Math.abs(Math.sin(x * 0.21)));
        return { on: tower && Math.random() < 0.55, a: Math.random(), hot: 0 };
      });
    };
    resize();
    addEventListener('resize', resize);
    let mx = -1e4;
    let my = -1e4;
    canvas.parentElement.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
    });
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (!c.on && c.hot <= 0) continue;
        const x = (i % cols) * CELL;
        const y = Math.floor(i / cols) * CELL;
        if (!reduced && Math.random() < 0.004) c.a = Math.random();
        const near = Math.hypot(x - mx, y - my) < 110;
        if (c.hot > 0) {
          ctx.fillStyle = `rgba(255,61,127,${0.35 + c.hot * 0.6})`;
          c.hot -= 0.01;
        } else if (near) {
          ctx.fillStyle = `rgba(60,240,212,${0.35 + c.a * 0.5})`;
        } else {
          ctx.fillStyle = `rgba(60,240,212,${0.05 + c.a * 0.16})`;
        }
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }
      if (!reduced) requestAnimationFrame(draw);
    };
    draw();

    const tagsBox = document.querySelector('.tags');
    const TAGS = ['0x5290…9ee7 → Google Analytics', 'sha256(addr) → ad network', 'address + IP → RPC provider', 'base64(addr) → marketing SDK', 'addr in Referer → CDN', 'wallet → session replay'];
    const spawn = () => {
      if (!tagsBox || document.hidden) return;
      const r = canvas.getBoundingClientRect();
      const t = document.createElement('span');
      const blocked = Math.random() < 0.25;
      t.className = `tag${blocked ? ' ok' : ''}`;
      t.textContent = blocked ? 'blocked by 0xRay' : TAGS[Math.floor(Math.random() * TAGS.length)];
      const x = 0.05 + Math.random() * 0.7;
      const y = 0.45 + Math.random() * 0.45;
      t.style.left = `${x * 100}%`;
      t.style.top = `${y * 100}%`;
      tagsBox.append(t);
      // light up the pixels under the tag
      const cx = Math.floor((x * r.width) / CELL);
      const cy = Math.floor((y * r.height) / CELL);
      for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 2; dy++) {
        const c = cells[(cy + dy) * cols + cx + dx];
        if (c && !blocked) c.hot = 1;
      }
      setTimeout(() => t.classList.add('out'), 2600);
      setTimeout(() => t.remove(), 3000);
    };
    if (!reduced) setInterval(spawn, 1100);
    else for (let i = 0; i < 4; i++) spawn();
  }

  // ---- Pinned statements ----------------------------------------------------
  const stWrap = document.querySelector('.statements');
  if (stWrap) {
    const sts = [...stWrap.querySelectorAll('.st')];
    const count = stWrap.querySelector('.st-count');
    let current = -1;
    const onScroll = () => {
      const r = stWrap.getBoundingClientRect();
      const p = Math.min(0.999, Math.max(0, -r.top / (r.height - innerHeight)));
      const i = Math.floor(p * sts.length);
      if (i === current) return;
      current = i;
      sts.forEach((s, j) => s.classList.toggle('on', j === i));
      if (count) count.textContent = `SCAN_00${i + 1} / 00${sts.length}`;
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---- Magnetic buttons and tilting cards ------------------------------------
  if (!reduced && fine) {
    for (const el of document.querySelectorAll('.magnetic')) {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.2}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => (el.style.transform = ''));
    }
    for (const el of document.querySelectorAll('.tilt')) {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
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
})();
