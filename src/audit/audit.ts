import { AUDIT_SITES, type AuditState } from '../shared/audit-sites.ts';

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function render(a: AuditState | null) {
  const start = $('start') as HTMLButtonElement;
  if (!a) {
    $('meta').textContent = `${AUDIT_SITES.length} sites · about 2 minutes`;
    return;
  }
  const done = a.sites.filter((s) => s.status === 'done' || s.status === 'error').length;
  ($('bar') as HTMLElement).style.width = `${(done / a.sites.length) * 100}%`;
  start.disabled = a.running;
  start.firstChild!.textContent = a.running ? 'Agent is browsing… ' : 'Run again ';
  $('meta').textContent = `Decoy ${a.decoyRef} · ${done}/${a.sites.length} sites`;

  $('sites').innerHTML = a.sites
    .map((s) => {
      const leaky = s.recipients.length > 0;
      const cls = s.status === 'scanning' ? 'scanning' : s.status === 'done' ? (leaky ? 'leaky' : 'clean') : '';
      const state =
        s.status === 'scanning'
          ? '<span class="a-state scanning lime">watching</span>'
          : s.status === 'queued'
            ? '<span class="a-state muted">queued</span>'
            : s.status === 'error'
              ? '<span class="a-state orange">could not open</span>'
              : leaky
                ? `<span class="chip pink">${s.recipients.length} recipient${s.recipients.length > 1 ? 's' : ''}</span>`
                : '<span class="chip cyan">none seen</span>';
      const recips = s.recipients.length
        ? `<ul class="a-recips">${s.recipients
            .map((r) => `<li><div><b>${esc(r.company)}</b> <span>${esc(r.host)}</span></div><span>${esc(r.encodings.join(', '))} · ${esc(r.outcome)}</span></li>`)
            .join('')}</ul>`
        : '';
      return `<li class="a-site ${cls}"><div class="a-row"><div><b>${esc(s.name)}</b><code>${esc(s.url)}</code></div>${state}</div>${recips}</li>`;
    })
    .join('');

  const summary = $('summary');
  if (!a.running && a.finishedAt) {
    const leaky = a.sites.filter((s) => s.recipients.length);
    const companies = new Set(a.sites.flatMap((s) => s.recipients.map((r) => r.company)));
    summary.hidden = false;
    summary.innerHTML = `<h2>${leaky.length} of ${a.sites.length} sites handed the address to <span class="pink">${companies.size} compan${companies.size === 1 ? 'y' : 'ies'}</span>.</h2>
      <p>If you look up your own address on ${leaky.length ? esc(leaky.map((s) => s.name).join(', ')) : 'these sites'}, expect the same. Sites behind a bot check may show nothing.</p>
      <div class="actions"><button id="export" class="btn small">Download report (JSON)</button></div>`;
    $('export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ tool: '0xRay audit agent', ...a }, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `0xray-audit-${new Date(a.startedAt).toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      link.click();
    });
  } else {
    summary.hidden = true;
  }
}

$('start').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'audit:start' });
});
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'audit:progress') render(msg.audit);
});
chrome.runtime.sendMessage({ type: 'audit:get' }).then((r) => {
  render(r?.audit ?? null);
  if (new URLSearchParams(location.search).has('start') && !r?.audit?.running) void chrome.runtime.sendMessage({ type: 'audit:start' });
});
