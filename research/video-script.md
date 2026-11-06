# Demo video script (target 2:45, hard limit 2:59)

Rules: 720p or higher, your own voice, no music, not sped up. Record each scene separately and cut them together.

## Before recording

- Brave, with 0xRay freshly loaded from `dist/` (remove the old copy first, so the onboarding wizard opens).
- Tabs ready: the homepage, the Scan page, the demo dApp.
- Close other tabs, hide bookmarks, zoom to 110% so text is readable.
- Protect off.

## Scenes

| Time | Screen | Say (roughly) |
|---|---|---|
| 0:00–0:15 | Homepage: headline animates in, the X-ray beam sweeps across the swap screen | "Your hardware wallet protects your money. Nothing protects your identity. The moment you connect, the site's own code can send your wallet address to analytics and ad companies. Researchers found 211 dApps doing it." |
| 0:15–0:35 | Type `vitalik.eth` in the hero box → Scan page → press Run → score ring fills, cards appear | "So what does a tracker learn from an address? This is 0xRay Scan. One address gives away a name, linked X and GitHub accounts, balances on five chains, and every transaction. That's why leaking it matters." |
| 0:35–0:55 | Onboarding wizard: pin step turns green, confetti | "0xRay is a browser extension. When you install it, a short setup walks you through it. It notices when I pin it…" |
| 0:55–1:25 | Wizard step 3 → Open the demo dApp → "Use a throwaway demo wallet" → the dApp's log shows the three leaks → back to the wizard: "Caught 3 leaks", confetti → click the 0xRay icon | "…and here's a deliberately leaky dApp. I connect, and its analytics script sends my address three ways: plain text, hidden in Base64, and 'anonymised' as a SHA-256 hash. 0xRay catches all three, with proof: who got it, how it was encoded, which script sent it, and whether it was delivered." |
| 1:25–1:45 | Popup: turn on Protect → reload the demo, connect again → popup goes green, "3 attempts blocked" | "One switch: Protect. Same page, same script, and every request carrying my address is stopped before it leaves. RPC providers are never blocked, so apps keep working." |
| 1:45–2:15 | Popup → Run privacy audit → the agent page fills in site by site → summary "2 of 9 sites handed the address to 4 companies" | "And this is the agent. It visits nine popular crypto sites in background tabs, each with a random decoy address that belongs to nobody, and watches who receives it. Etherscan sent it to Google Analytics and an ad host. OpenSea to two other services. My real address never left my browser." |
| 2:15–2:30 | Registry page: type etherscan.io → rows appear | "Those findings go to a public registry on Arkiv, so anyone can check a site before connecting. Every entry expires after 30 days, so it stays current." |
| 2:30–2:45 | How it works page, the CROPS cards; then the homepage logo | "No servers, no analytics, no account, never touches your keys, open source. 0xRay. See who's watching your wallet." |

## Tips

- If the wizard's pin step doesn't turn green, pin it before recording that scene.
- If a site in the audit shows a bot check, that's fine: it reports "none seen".
- The audit takes about 2 minutes in real time. Record it fully, then cut to the summary; don't speed it up.
- Speak a little slower than feels natural; 2:45 leaves room.
