import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '@noble/hashes/sha2.js';
import { buildNeedles, toChecksum, toHex } from '../src/shared/needles.ts';
import { scan } from '../src/shared/detect.ts';
import { siteOf } from '../src/shared/catalog.ts';

const ADDR = '0x52908400098527886e0f7030069857d2e4169ee7';
const needles = buildNeedles([ADDR]);

test('checksum matches EIP-55 test vector', () => {
  assert.equal(toChecksum(ADDR), '0x52908400098527886E0F7030069857D2E4169EE7');
});

test('leak A: plain query param', () => {
  const m = scan(`http://127.0.0.1:5174/collect?wallet=${ADDR}`, needles, 'query');
  assert.equal(m?.transform, 'plain');
  assert.ok(!m!.snippet.includes(ADDR), 'snippet must be redacted');
});

test('checksummed address still matches', () => {
  const m = scan(`id=${toChecksum(ADDR)}`, needles, 'query');
  assert.equal(m?.transform, 'plain');
});

test('leak B: base64 JSON body', () => {
  const body = btoa(JSON.stringify({ wallet: ADDR }));
  assert.equal(scan(body, needles, 'body')?.transform, 'base64 → plain');
});

test('leak C: sha256 of lowercase address', () => {
  const uid = toHex(sha256(new TextEncoder().encode(ADDR)));
  assert.equal(scan(JSON.stringify({ uid }), needles, 'body')?.transform, 'sha256(lowercase)');
});

test('url-encoded address matches', () => {
  assert.equal(scan(encodeURIComponent(JSON.stringify({ a: ADDR })), needles, 'query')?.transform, 'plain');
});

test('no false positive on a different address or random hex', () => {
  assert.equal(scan('0x1111111111111111111111111111111111111111', needles, 'body'), null);
  assert.equal(scan('deadbeef'.repeat(16), needles, 'body'), null);
  assert.equal(scan('aGVsbG8gd29ybGQgdGhpcyBpcyBub3QgYW4gYWRkcmVzcw==', needles, 'body'), null);
});

test('localhost and 127.0.0.1 are different sites', () => {
  assert.notEqual(siteOf('http://localhost:5173/'), siteOf('http://127.0.0.1:5174/'));
  assert.equal(siteOf('https://eth-mainnet.g.alchemy.com/v2/x'), 'alchemy.com');
});

test('apps on the same hosting platform are different sites', () => {
  assert.notEqual(siteOf('https://alice.github.io/app'), siteOf('https://tracker.github.io/x'));
  assert.notEqual(siteOf('https://a.vercel.app'), siteOf('https://b.vercel.app'));
});
