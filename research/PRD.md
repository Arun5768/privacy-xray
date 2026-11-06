# Privacy X-Ray — PRD (excerpts)

Written by the team before the build. Sections 1–5.5 (problem, goals, users and FR-1 to FR-15) were drafted separately and are summarised here from the milestone plan; sections from FR-15 onwards are reproduced as written.

## Summary of FR-1 to FR-14 (from the milestone plan)

- M1 Detect: FR-1, FR-2, FR-3, FR-4, FR-6, FR-8 — learn the address, observe requests, plain leak detected, badge turns red.
- M2 Prove: FR-5, FR-7, FR-9, FR-10, FR-11 — Base64 and hashed leaks detected with labels; proof panel.
- M3 Protect and Dev: FR-12 (blocking), FR-14 (initiator script), FR-15, FR-16, FR-13.

## 5.5 (continued)

**FR-15** Export the current site's findings as Markdown and JSON: site, date, extension version, companies, categories, and evidence (addresses redacted to 0x1234…abcd by default). Acceptance: the downloaded file opens and matches the popup contents.

**FR-16 (P1) Extended coverage and hints**
- Cookies: scan the Cookie request header via onBeforeSendHeaders + extraHeaders.
- WebSocket: scan outgoing message payloads via the MAIN-world hook (webRequest cannot see frames).
- RPC hint: for the RPC category, show "Your RPC provider can link your address and IP. A private option is EF's Anon-RPC" with a link.

## 5.6 Stretch

**FR-17 (P2) Arkiv "known leakers" registry.** Opt-in. Publishes anonymized findings as expiring Arkiv entities: site eTLD+1, recipient domain, category, encoding, date. Never the user's address. Signed by an extension-generated throwaway key. Before connecting, the badge shows "known to leak to N companies", read from Arkiv. Requires Arkiv rubric files. Only start after all P0 and P1 items are done. This is the one place the extension would make network calls. It must be opt-in and disclosed in the CROPS section.

**FR-18 (P2)** Weekly exposure summary across sites.

**FR-19 (P2)** Hidden cross-origin iframe exposure warning.

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 Privacy | The extension makes no network requests (except opt-in FR-17). No analytics, no remote code, no CDN imports; all libraries bundled. |
| NFR-2 Security | Never request, read or store private keys or seed phrases. Read-only observation. Minimal permissions: webRequest, storage, declarativeNetRequest (P1), scripting; host `<all_urls>` (justified in the README). |
| NFR-3 Performance | Scanning adds no blocking latency (observational). Hashes precomputed once per address. Bodies larger than 256 KB are scanned by prefix only. |
| NFR-4 Correctness | False positives: only match full 40-hex addresses or full-length hashes. No partial or substring hex matches. |
| NFR-5 Robustness | Unknown or binary bodies are skipped gracefully; the extension never throws into the page. Hooks preserve the original function behavior when blocking is off. |
| NFR-6 Usability | Understandable without crypto knowledge. One-glance badge, plain-English labels. |
| NFR-7 Open source | MIT license. Builds from the repo with one command. |
| NFR-8 Honesty | UI and README state limitations (server-side forwarding, first-party proxies, encrypted payloads, workers). |

## 7. System design (overview)

MAIN-world script (document_start, all frames) wraps EIP-1193 / EIP-6963 providers to learn the address and hooks fetch / XHR / sendBeacon / WebSocket (stack trace, WS payloads, blocking when enabled), relaying via window.postMessage to an isolated-world script and chrome.runtime.sendMessage. The background service worker runs webRequest.onBeforeRequest (requestBody) as the primary detector and onBeforeSendHeaders (extraHeaders) for cookies; the detector uses needles (plain / hashes) and a decode loop; the classifier uses eTLD+1 and a recipient catalog; storage is chrome.storage.session per tab; badge via chrome.action; DNR dynamic rules for blocking. Popup: summary, proof, toggle, export, settings. Demo dApp (local): connect wallet + 3 leaks to a second local origin.

## 8. Demo dApp specification

localhost:5173 (the dApp): a "Connect Wallet" button using the injected provider, which shows the connected address. On connect it loads leaky-analytics.js, which sends three requests to the "tracker" at localhost:5174 (a different origin):

- Leak A: `GET /collect?wallet=0x…` (plain query param)
- Leak B: `navigator.sendBeacon('/b', base64(JSON{wallet}))` (Base64 body)
- Leak C: `fetch('/id', {method:'POST', body: JSON{uid: sha256(address)}})` (hashed)

localhost:5174 (the tracker): logs whatever it receives, so we can show server-side that blocking works. Catalog entry: map the tracker origin to "DemoTrack Analytics". Both servers run on localhost, which gives the same eTLD+1: use 127.0.0.1 for one and localhost for the other. Verify in the first hour.

## 9. Success metrics

| Metric | Target |
|---|---|
| Demo leaks detected (A, B, C) | 3 / 3, with correct encoding labels |
| Demo leaks blocked with the toggle on | 3 / 3; tracker log receives nothing |
| False positives on the demo dApp | 0 |
| Extension's own outbound requests | 0 (shown in the video) |
| Real dApps surveyed on a throwaway wallet | ≥ 5, with findings recorded factually |
| Time from connect to badge update | < 1 s |

## 10. Compliance checklists

EF Best CROPS App: public MIT repo with run instructions; README section titled CROPS; demo video ≤ 3 minutes showing the moment it matters; no third-party trackers in the client; personal data stays on the device.

ETHGlobal: submitted before 09:00 IST via the Hacker Dashboard; frequent commits; README AI-usage attribution plus planning artifacts in the repo; video 2:00–2:59, ≥ 720p, human voice, not sped up.

## 11. Milestones (IST, 7 Nov)

| Time | Milestone |
|---|---|
| 00:45–01:15 | M0 Setup: repo, MV3 manifest loads unpacked, demo dApp and tracker on two origins |
| 01:15–03:00 | M1 Detect |
| 03:00–04:15 | M2 Prove |
| 04:15–06:00 | M3 Protect and Dev |
| 06:00–06:45 | M4 Field test: ≥ 5 real dApps on a throwaway wallet |
| 06:45–07:30 | M5 Polish / stretch |
| 07:30–08:45 | M6 Ship: README, video, submit |

Hard cut-off: if M2 is not done by 05:00, skip M3 and go straight to the field test and shipping.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| MAIN-world hooks run after page scripts on some sites | webRequest remains the primary detector; hooks are a bonus |
| localhost origins classified as the same site | Use 127.0.0.1 vs localhost; verify in M0 |
| No real dApp leaks on demo day | The demo dApp is deterministic; quote the study numbers; show any real finding factually |
| Blocking breaks a dApp | Off by default; show blocking on the demo dApp |
| Hash or encoding false positives | Full-length matches only; unit tests on needles |
| Large or binary bodies | Size cap; skip non-text |
| Time overrun | Strict milestone cut-offs; submit by 08:45 |
| Naming real companies | State only observed facts with evidence; no accusations |
