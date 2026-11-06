// Onboarding wizard. Local only: talks to the extension's own background, opens
// the demo dApp only when the user clicks.
const DEMO_URL = 'https://arun5768.github.io/privacy-xray/demo/';
const $ = (id: string) => document.getElementById(id)!;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Confetti --------------------------------------------------------------
const canvas = $('confetti') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
type Bit = { x: number; y: number; vx: number; vy: number; r: number; c: string; life: number };
let bits: Bit[] = [];
function burst(x = innerWidth / 2, y = innerHeight / 3) {
  if (reduced) return;
  const colors = ['#c8ff2e', '#ff4fa3', '#3cf0d4', '#8b6cff', '#ff8a3c'];
  for (let i = 0; i < 120; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 4 + Math.random() * 9;
    bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, r: 3 + Math.random() * 4, c: colors[i % colors.length], life: 90 + Math.random() * 40 });
  }
  if (bits.length === 120) requestAnimationFrame(draw);
}
function draw() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  bits = bits.filter((b) => b.life-- > 0);
  for (const b of bits) {
    b.vy += 0.25;
    b.vx *= 0.99;
    b.x += b.vx;
    b.y += b.vy;
    ctx.fillStyle = b.c;
    ctx.globalAlpha = Math.min(1, b.life / 40);
    ctx.fillRect(b.x, b.y, b.r, b.r * 1.6);
  }
  if (bits.length) requestAnimationFrame(draw);
}

// ---- Word reveal and eye ---------------------------------------------------
for (const el of document.querySelectorAll('.words')) {
  let i = 0;
  for (const node of [...el.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) {
      (node as HTMLElement).classList.add('w');
      (node as HTMLElement).style.animationDelay = `${0.1 + i++ * 0.1}s`;
      continue;
    }
    const frag = document.createDocumentFragment();
    for (const part of node.textContent!.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) frag.append(part);
      else {
        const s = document.createElement('span');
        s.className = 'w';
        s.style.animationDelay = `${0.1 + i++ * 0.1}s`;
        s.textContent = part;
        frag.append(s);
      }
    }
    node.replaceWith(frag);
  }
}
const eye = document.querySelector('.big-eye');
const pupil = eye?.querySelector('.pupil');
if (eye && pupil && !reduced) {
  addEventListener('pointermove', (e) => {
    const r = eye.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / 400);
    pupil.setAttribute('transform', `translate(${((dx / len) * 14 * k).toFixed(1)} ${((dy / len) * 8 * k).toFixed(1)})`);
  });
}

// ---- Steps -----------------------------------------------------------------
function go(step: number) {
  document.querySelectorAll<HTMLElement>('.panel').forEach((p) => (p.hidden = p.dataset.panel !== String(step)));
  document.querySelectorAll<HTMLElement>('.rail li').forEach((li) => {
    const n = Number(li.dataset.step);
    li.classList.toggle('active', n === step);
    li.classList.toggle('done', n < step);
  });
}
document.querySelectorAll<HTMLElement>('[data-next]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.next))));
go(1);

// Step 1: detect pinning (Chrome 91+).
let pinned = false;
async function checkPin() {
  try {
    const s = await (chrome.action as any).getUserSettings?.();
    if (s?.isOnToolbar && !pinned) {
      pinned = true;
      const st = $('pinStatus');
      st.textContent = '✓ Pinned. Nice.';
      st.classList.add('ok');
      burst();
    }
  } catch {
    // Not supported in this browser: the Skip button covers it.
  }
}
void checkPin();
const pinTimer = setInterval(() => (pinned ? clearInterval(pinTimer) : void checkPin()), 1000);

// Step 2: optional address.
$('addrForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('addr') as HTMLInputElement;
  const st = $('addrStatus');
  const res = await chrome.runtime.sendMessage({ type: 'addAddress', address: input.value.trim() });
  if (res?.ok) {
    st.textContent = `✓ Watching ${input.value.trim().slice(0, 6)}…${input.value.trim().slice(-4)} in this browser.`;
    st.classList.add('ok');
    input.value = '';
  } else {
    st.textContent = res?.error ?? 'Could not add that address.';
    st.classList.remove('ok');
  }
});

// Step 3: open the demo and listen for the first catch.
let demoTab: number | undefined;
let caught = false;
$('openDemo').addEventListener('click', async () => {
  const tab = await chrome.tabs.create({ url: DEMO_URL, active: true });
  demoTab = tab.id;
});
async function checkCatch(tabId: number) {
  if (caught || tabId !== demoTab) return;
  const view = await chrome.runtime.sendMessage({ type: 'get', tabId });
  const n = view?.leaks?.length ?? 0;
  if (!n) return;
  caught = true;
  $('catch').classList.add('hit');
  $('catchText').textContent = `Caught ${n} leak${n > 1 ? 's' : ''} on the demo dApp. Click the 0xRay icon there to see the proof.`;
  burst(innerWidth / 2, innerHeight / 2);
}
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'leaks-changed') void checkCatch(msg.tabId);
});
// Coming back to this tab after the demo: check once more.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && demoTab != null) void checkCatch(demoTab);
});

// Step 4: protect choice, then the audit.
document.querySelectorAll<HTMLElement>('.choice').forEach((c) =>
  c.addEventListener('click', async () => {
    const on = c.dataset.protect === 'true';
    await chrome.runtime.sendMessage({ type: 'setProtect', on });
    document.querySelectorAll('.choice').forEach((x) => x.classList.toggle('on', x === c));
    $('finish').hidden = false;
    document.querySelectorAll('.rail li').forEach((li) => li.classList.add('done'));
    burst();
  }),
);
$('runAudit').addEventListener('click', () => {
  location.href = chrome.runtime.getURL('audit.html?start');
});
