# Privacy X-Ray

**See which companies a crypto app sends your wallet address to, with proof. Stop it in one click. Everything runs on your device.**

Browser extension (Chrome, Brave and other Chromium browsers) built at **ETHGlobal Mumbai 2026**.

- Website and live demo: https://arun5768.github.io/privacy-xray/
- Download: https://arun5768.github.io/privacy-xray/privacy-xray-extension.zip

## The problem

When you connect a wallet, the dApp's own JavaScript can send your address anywhere: analytics, marketing pixels, error trackers, RPC providers that also see your IP. Your wallet can't see this, because it happens in the page, not in the wallet. A hardware wallet protects your keys, not your identity.

- 211 of 1,572 dApps leaked users' wallet addresses to third parties, and 13 of 100 wallets did too ([USENIX Security 2023](https://www.usenix.org/system/files/usenixsecurity23-torres.pdf)).
- 22 of 36 browser wallets kept exposing addresses after the user logged out of a dApp ([arXiv 2026](https://arxiv.org/html/2607.06141v1)).
- Crypto "wrench attacks" took more than $30M in H1 2026, and analysts link part of them to leaked holder identities ([Chainalysis](https://www.chainalysis.com/blog/violent-crypto-wrench-attacks-2026/)).
- Under the EDPB's blockchain guidelines (02/2025, v2.0, July 2026), a wallet address linkable to a person is personal data, and hashing it doesn't change that ([EDPB](https://www.edpb.europa.eu/documents/guideline/guidelines-022025-on-processing-of-personal-data-through-blockchain_en)).

Existing tools either measure this in research settings or hide traffic without showing what leaked. Privacy X-Ray shows ordinary users what is happening, live, on any dApp.

**What we observed ourselves** ([`research/field-test.md`](research/field-test.md), reproducible with `node test/field-survey.mjs`): opening Etherscan's page for a freshly generated random address, the address was delivered to Google Analytics and to an ad host (`req.adx.ws`); on Blockscout, to Google Analytics. DeBank, Arkham and OKLink showed no third-party recipients in the same test. These are observations, not accusations: an address in a URL is normal for explorers, and the point is to make visible who receives it.

## What it does

1. **Learns your address on your device.** It watches the wallet provider's replies (EIP-1193 and EIP-6963) for `eth_requestAccounts` / `eth_accounts`, or you paste an address to watch.
2. **Checks every third-party request** for that address, including disguised forms:
   - plain and EIP-55 checksummed, with or without `0x`
   - URL-encoded and Base64 (including Base64 JSON)
   - SHA-256, Keccak-256, SHA-1 and MD5 hashes of the address (hex or Base64)
   - in the URL, request body, `Cookie` and `Referer` headers, and WebSocket messages
3. **Shows proof** for each finding: recipient and company, category (analytics / RPC / error / other), where the address was hidden, how it was encoded, the script that sent it, a redacted snippet, and what happened on the network (delivered, blocked by the browser, e.g. Brave Shields, or failed), so a finding is never overstated.
4. **Protect** (off by default) stops requests carrying your address before they leave the page, and blocks further data-carrying requests to recipients caught leaking. RPC providers are never blocked, so dApps keep working; instead the popup points to the EF's [Anon-RPC](https://ethereum.github.io/anon-rpc/).
5. **Evidence report** exports the findings as Markdown or JSON, for users or for dApp teams auditing their own frontend.

## Try it

### Hosted (no setup)

1. Download the [extension zip](https://arun5768.github.io/privacy-xray/privacy-xray-extension.zip) and unzip it.
2. Open `chrome://extensions` or `brave://extensions`, switch on **Developer mode**, click **Load unpacked**, pick the folder.
3. Open the [live demo dApp](https://arun5768.github.io/privacy-xray/demo/), click **Use a throwaway demo wallet**, then click the X-Ray icon.

The hosted demo's analytics script reports to `collect.demotrack.invalid`. `.invalid` is reserved (RFC 2606) and never resolves, so the requests leave the page but no real third party receives anything.

### Local (full demo, with a tracker server you can watch)

```bash
npm install
npm run build        # builds the extension into dist/
npm run demo         # dApp on http://localhost:5173/demo/, tracker on http://127.0.0.1:5174
```

Load `dist/` as an unpacked extension, open the dApp, connect the demo wallet, and open http://127.0.0.1:5174 to see what the tracker server actually received. Turn on Protect, reset the tracker, reconnect: the tracker receives nothing.

`localhost` and `127.0.0.1` count as different sites, so the tracker is a genuine third party.

### Tests

```bash
npm test             # detector unit tests (encodings, redaction, no false positives, site logic)
npm run e2e          # loads the extension in a throwaway Brave profile and runs the demo with Protect off and on
node test/field-survey.mjs   # visits 8 real explorer / portfolio pages for a random address; writes research/field-test.md
```

`npm run e2e` expects the demo servers to be running and Brave at its default Windows path; change `BROWSER` in `test/e2e.mjs` for another Chromium browser. It passes when the tracker receives 3 leaks with Protect off, 0 with Protect on, and all 3 show as blocked.

## How it works

```
Web page (dApp)
  MAIN-world hook (document_start, all frames)
    wraps EIP-1193 / EIP-6963 providers → learns the connected address
    hooks fetch / XHR / sendBeacon / WebSocket.send
      → records the sending script; stops the call when Protect is on
  isolated-world bridge → chrome.runtime messages
Background service worker
  webRequest.onBeforeRequest (URL + body)        primary detector
  webRequest.onBeforeSendHeaders (Cookie, Referer)
  detector: precomputed needles + URL / Base64 decode layers
  classifier: eTLD+1 (private suffixes included) + recipient catalog
  storage: chrome.storage.session (memory only)
  declarativeNetRequest session rules             Protect, for recipients caught leaking
Popup: status, grade, proof per recipient, Protect, watched addresses, export
```

Why two layers: in Manifest V3, `webRequest` can observe but not cancel requests. Detection uses `webRequest` because it sees everything that leaves the page. Blocking uses the page hook (stops the first leak before it is sent) plus `declarativeNetRequest` rules (blocks later data-carrying requests to the same recipient, including ones the hook can't see).

Code map:

| Path | What |
|---|---|
| `src/shared/needles.ts` | Every form of an address we search for; redaction |
| `src/shared/detect.ts` | Scanning with URL and Base64 decode layers |
| `src/shared/catalog.ts` | Site logic and known recipients |
| `src/background.ts` | Network observation, recording, badge, blocking rules |
| `src/inject.ts` | Page hook: address discovery, request checks, Protect |
| `src/content.ts` | Bridge between page hook and extension |
| `src/popup/` | Popup UI and report export |
| `docs/` | Website and demo dApp (GitHub Pages) |
| `demo/serve.mjs` | Local servers for the dApp and the demo tracker |

## CROPS

**C — Censorship resistant.** No server, domain, relayer or account. The extension runs entirely from its own files, so there is nothing to take down or block. The website is only a convenience; the extension builds and runs from this repo alone.

**O — Open source.** MIT licensed. `npm install && npm run build` produces the exact extension in `dist/`; the downloadable zip is built by `npm run package` from the same source.

**P — Private.** All analysis happens in the browser. The extension makes no network requests of its own: no analytics, no remote code, no CDN imports (all libraries are bundled). Watched addresses are kept in `chrome.storage.session`, which lives in memory and is cleared when the browser closes. Stored findings and exports contain only redacted addresses (`0x5290…9ee7`) and truncated hashes. The only setting written to disk is the Protect switch. Addresses typed into the popup are never passed to web pages.

**S — Secure.** Never requests, reads or stores private keys or seed phrases, and never signs anything. Observation is read-only; blocking is opt-in. Trust assumptions and permissions:

| Permission | Why |
|---|---|
| `webRequest` | Observe outgoing requests to find the address (observe-only in MV3) |
| `declarativeNetRequest` | Protect: block data-carrying requests to recipients caught leaking |
| `storage` | Session findings and the Protect switch |
| host `<all_urls>` | A leak can go to any domain; requests must be visible to be checked |

The page hook runs in the page's own JavaScript context, so a malicious page could detect the extension or send it fake findings about itself. It cannot read watched addresses it didn't already receive from the wallet.

## Limitations

- It sees what leaves the browser. It can't see what a dApp's server forwards to others afterwards, or first-party proxies that relay data server-side.
- Custom or encrypted encodings of the address can be missed. Only full-length matches count, so findings are evidence, not guesses.
- Request bodies sent as `Blob` or streams, and requests from web workers, are checked at the network layer only, so with Protect on the first one can still be sent before the recipient is blocked.
- Wallets that freeze their provider object prevent automatic address discovery; paste the address in the popup instead.
- The recipient catalog is small; unknown recipients are shown by domain.

## Built at ETHGlobal Mumbai, and how AI was used

All code was written during the hackathon (7 November 2026, IST), starting from an empty repository; the commit history shows the progression.

The project was built with **Claude Code** (Anthropic's coding agent) as the main implementer, directed by the team. The team chose the problem, wrote the product requirements (`research/PRD.md`), made the scoping and design decisions, and reviewed and tested the results. Claude Code did the research summaries, reviewed the PRD (`research/review.md`), and wrote most of the code, tests and website. Every claim in this README is backed by the tests, the e2e script or the cited sources.

## Prize track

EF — Best CROPS App.

## License

MIT
