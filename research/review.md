# PRD review: changes made before building

Review of `PRD.md` done at the start of the build (00:45 IST, 7 Nov 2026). Each change was checked against documentation or a quick experiment.

| # | PRD assumption | Finding | Change |
|---|---|---|---|
| 1 | Blocking via `webRequest` | Manifest V3 `webRequest` can observe but not cancel requests; blocking must use `declarativeNetRequest` | Detection stays on `webRequest`. Blocking = page hook (stops the first leak before it is sent) + session DNR rules for recipients caught leaking |
| 2 | DNR blocks the tracker's domain | Blocking all request types also blocks the tracker's script, so nothing is attempted and the popup shows nothing | Rules cover data-carrying types only (XHR, ping, image, WebSocket, other); scripts still load and every attempt is reported as blocked |
| 3 | FR-17 Arkiv registry | Contradicts success metric "extension makes 0 outbound requests" | Deferred; only if all P0/P1 work is done, opt-in and disclosed |
| 4 | Page hook gets addresses from the extension | Passing watched addresses into the page would let any site read them | Hook only uses addresses the page itself received from the wallet |
| 5 | Store leak records | Raw addresses in stored records would undercut the privacy claim | Records are redacted at write time; storage is `chrome.storage.session` (memory) |
| 6 | Auto-detect address | Some wallets freeze their provider object | Added "Watch address" in the popup; network-layer detection still works |
| 7 | MD5 library (open question) | `@noble/hashes` 2.4.0 exports `md5` from `legacy.js` | No extra dependency |
| 8 | localhost vs 127.0.0.1 (open question) | `tldts.getDomain` returns null for both; hostname fallback makes them distinct | Verified by unit test |
| 9 | eTLD+1 | Default tldts ignores private suffixes, so `a.github.io` and `b.github.io` would be "the same site" | `allowPrivateDomains: true`, with a unit test |
| 10 | Live deployment | ETHGlobal finalist rules require a live deployment | Website + hosted demo on GitHub Pages; hosted tracker uses an `.invalid` domain so no real third party receives data |
