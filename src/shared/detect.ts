import { redactAll } from './needles.ts';
import type { LeakLocation, Match, Needle } from './types.ts';

const MAX_SCAN = 256 * 1024;
const B64_TOKEN = /[A-Za-z0-9+/_-]{24,}={0,2}/g;

type Hit = { needle: Needle; index: number; text: string };

function direct(text: string, needles: Needle[]): Hit | null {
  const lower = text.toLowerCase();
  for (const needle of needles) {
    const index = needle.caseSensitive ? text.indexOf(needle.value) : lower.indexOf(needle.value.toLowerCase());
    if (index >= 0) return { needle, index, text };
  }
  return null;
}

function tryDecodeURI(text: string): string | null {
  try {
    const d = decodeURIComponent(text.replace(/\+/g, ' '));
    return d === text ? null : d;
  } catch {
    return null;
  }
}

function tryBase64(token: string): string | null {
  try {
    let t = token.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    const bin = atob(t);
    // Only accept decodings that look like text; random bytes are not evidence.
    let printable = 0;
    for (let i = 0; i < bin.length; i++) {
      const c = bin.charCodeAt(i);
      if ((c >= 32 && c < 127) || c === 9 || c === 10 || c === 13) printable++;
    }
    return printable / Math.max(bin.length, 1) > 0.9 ? bin : null;
  } catch {
    return null;
  }
}

function snippetOf(hit: Hit, needles: Needle[]): string {
  const start = Math.max(0, hit.index - 32);
  const end = Math.min(hit.text.length, hit.index + hit.needle.value.length + 32);
  const s = (start > 0 ? '…' : '') + hit.text.slice(start, end) + (end < hit.text.length ? '…' : '');
  return redactAll(s, needles);
}

// Look for any form of a watched address in one piece of outgoing data.
// Full-length matches only, so a hit is real evidence rather than a guess.
export function scan(raw: string | null | undefined, needles: Needle[], location: LeakLocation): Match | null {
  if (!raw || !needles.length) return null;
  const text = raw.length > MAX_SCAN ? raw.slice(0, MAX_SCAN) : raw;

  const layers: [string, string][] = [[text, '']];
  const uri = tryDecodeURI(text);
  if (uri) layers.push([uri, '']);

  for (const [layer, prefix] of layers) {
    const hit = direct(layer, needles);
    if (hit) return { location, transform: prefix + hit.needle.transform, snippet: snippetOf(hit, needles), address: hit.needle.address };
  }

  for (const [layer] of layers) {
    for (const token of layer.match(B64_TOKEN) ?? []) {
      const decoded = tryBase64(token);
      if (!decoded) continue;
      const hit = direct(decoded, needles) ?? (() => {
        const inner = tryDecodeURI(decoded);
        return inner ? direct(inner, needles) : null;
      })();
      if (hit) {
        return {
          location,
          transform: 'base64 → ' + hit.needle.transform,
          snippet: snippetOf(hit, needles),
          address: hit.needle.address,
        };
      }
    }
  }
  return null;
}
