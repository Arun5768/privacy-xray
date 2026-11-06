// Welcome page: the logo's pupil follows the cursor. Purely local, no network.
const eye = document.getElementById('eye');
const pupil = document.getElementById('pupil');

if (eye && pupil && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('pointermove', (e) => {
    const r = eye.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / 300);
    pupil.setAttribute('transform', `translate(${((dx / len) * 14 * k).toFixed(1)} ${((dy / len) * 8 * k).toFixed(1)})`);
  });
}
