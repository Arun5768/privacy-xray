# Field test: real sites, observed leaks

Run: 2026-11-06T19:57:37.511Z with `node test/field-survey.mjs` (Brave, fresh profile, extension built from this repo).

Method: a freshly generated random address (0x5b03…8a5a, owned by nobody) was added as a watched address. Each page was opened with that address in its URL and observed for 12 seconds without any interaction. Only third-party requests that contained the address (in any encoding the detector supports) are listed.

These are observations, not accusations: putting an address in a URL is normal for explorers and portfolio pages, and a recipient seeing it may be expected (for example the site's own API on another domain). The point is to make visible who receives it. Results vary between runs (consent banners, bot checks, ad loading).

Outcome: `delivered` = the request completed; `blocked-by-browser` = Brave Shields stopped it after the page tried to send it; `failed` = network error; `unknown` = not reported before the page was left.

| Site | Page loaded | Recipient host (company) | Where · encoding · outcome |
|---|---|---|---|
| Etherscan | yes | analytics.google.com (Google Analytics) | query · plain · delivered |
| Etherscan | yes | req.adx.ws | body · plain · delivered |
| Blockscout | yes | analytics.google.com (Google Analytics) | query · plain · delivered |
| DeBank | yes | none observed | — |
| Zapper | no (bot check) | none observed | — |
| Zerion | no (bot check) | none observed | — |
| OpenSea | error: net::ERR_ABORTED at https://opensea.io/0x5b03a2c85d47801a43c4a2b6087051b8d58e8a5a | none observed | — |
| Arkham | yes | none observed | — |
| OKLink | yes | none observed | — |

An earlier run the same night (different random address, before outcome tracking was added) also observed: `www.googletagmanager.com` on Etherscan and Blockscout (query · plain), and `api.hyperliquid.xyz` and `atd2.openseaprorelayproxy.com` on OpenSea (body · plain). In the run above, OpenSea and two portfolio sites showed a bot check instead of the page, so they could not be observed.
