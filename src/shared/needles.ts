import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { md5, sha1 } from '@noble/hashes/legacy.js';
import type { Needle } from './types.ts';

const enc = new TextEncoder();

const HASHES: Record<string, (b: Uint8Array) => Uint8Array> = {
  sha256,
  keccak256: keccak_256,
  sha1,
  md5,
};

export function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, '');
}

export function normalizeAddress(a: unknown): string | null {
  if (typeof a !== 'string') return null;
  const h = a.trim().toLowerCase().replace(/^0x/, '');
  return /^[0-9a-f]{40}$/.test(h) ? '0x' + h : null;
}

export function toChecksum(address: string): string {
  const h = address.toLowerCase().replace(/^0x/, '');
  const hash = toHex(keccak_256(enc.encode(h)));
  let out = '0x';
  for (let i = 0; i < 40; i++) out += parseInt(hash[i], 16) >= 8 ? h[i].toUpperCase() : h[i];
  return out;
}

export function redactAddress(address: string): string {
  return address.slice(0, 6) + '…' + address.slice(-4);
}

// Every encoding of each address we look for. Plain forms come first so the
// simplest explanation wins when several needles match.
export function buildNeedles(addresses: string[]): Needle[] {
  const out: Needle[] = [];
  const seen = new Set<string>();
  const push = (n: Needle) => {
    const key = n.caseSensitive ? n.value : n.value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(n);
  };

  for (const raw of addresses) {
    const address = normalizeAddress(raw);
    if (!address) continue;
    const h = address.slice(2);
    push({ value: address, transform: 'plain', caseSensitive: false, address });
    push({ value: h, transform: 'plain (no 0x)', caseSensitive: false, address });

    const forms: [string, string][] = [
      ['lowercase', address],
      ['checksum', toChecksum(address)],
      ['no 0x', h],
    ];
    for (const [alg, fn] of Object.entries(HASHES)) {
      for (const [label, form] of forms) {
        const digest = fn(enc.encode(form));
        push({ value: toHex(digest), transform: `${alg}(${label})`, caseSensitive: false, address });
        push({ value: toBase64(digest), transform: `${alg}(${label}) as base64`, caseSensitive: true, address });
      }
    }
  }
  return out;
}

// Replace every needle occurrence with a short, non-reversible label so stored
// records and exported reports never contain the raw address or full hash.
export function redactAll(text: string, needles: Needle[]): string {
  let out = text;
  for (const n of needles) {
    const label = n.transform === 'plain' || n.transform === 'plain (no 0x)'
      ? redactAddress(n.address)
      : `[${n.transform}:${n.value.slice(0, 6)}…]`;
    const flags = n.caseSensitive ? 'g' : 'gi';
    out = out.replace(new RegExp(escapeRe(n.value), flags), label);
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
