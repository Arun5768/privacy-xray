# Demo video script (target 2:40, max 2:59)

Rules: 720p or higher, your own voice, no music, not sped up. One take per scene is fine; cut between scenes.

Setup before recording: `npm run demo` running; extension loaded in Brave; tracker log open at http://127.0.0.1:5174 (click reset); Protect off; popup closed.

| Time | Screen | Say (roughly) |
|---|---|---|
| 0:00–0:20 | Landing page, red live bar at top | "Your hardware wallet protects your money. Nothing protects your identity. When you connect to a crypto app, its own code can send your wallet address to analytics and ad companies. Researchers found 211 dApps doing it. And 2026 is on pace for a record year of physical attacks on crypto holders, partly linked to leaked identities." |
| 0:20–0:35 | Point at the bar | "This bar is live: the page sees my wallet, and nothing tells me where my address goes. That's what Privacy X-Ray fixes." |
| 0:35–1:05 | Demo dApp → click "Use a throwaway demo wallet" → badge turns red → open popup | "Here's an ordinary-looking dApp with an analytics script. I connect… and X-Ray catches three leaks. One in plain text in a URL. One hidden in Base64. One 'anonymised' as a SHA-256 hash: still my address. For each one, it shows who got it and which script sent it." |
| 1:05–1:20 | Tracker log tab: 3 received | "And here's the tracker's own server: it really received all three." |
| 1:20–1:50 | Reset tracker → turn on Protect → reload dApp → connect → popup green → tracker log "0 received" | "Now I turn on Protect and do the same thing. All three attempts are stopped before they leave the page. The tracker receives nothing. RPC providers are never blocked, so dApps keep working." |
| 1:50–2:10 | Etherscan for a random address; popup showing Google Analytics, delivered | "On real sites: I opened Etherscan for a random address. X-Ray shows it was delivered to Google Analytics and an ad host. Observations, not accusations, but now you can see it." |
| 2:10–2:25 | Export report; show the Markdown | "Teams can export an evidence report. Under the EU's July 2026 guidelines, a linkable wallet address is personal data, even hashed." |
| 2:25–2:40 | DevTools Network tab of the extension's service worker, empty; README CROPS section | "And it practises what it preaches: no servers, no analytics, zero network requests of its own, open source under MIT. Privacy X-Ray: see who's watching your wallet." |

Showing zero extension requests: `brave://extensions` → Privacy X-Ray → "service worker" link → Network tab; use the dApp; the list stays empty.
