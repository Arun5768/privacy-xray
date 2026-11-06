# How we use Arkiv

Every Arkiv feature we use changes something a user sees on the [registry page](https://arun5768.github.io/privacy-xray/registry/).

| Feature | How we use it | What the user sees |
|---|---|---|
| **Named schema** (`defineSchema('privacy-xray.observation', …)`) | Shared by publisher and website ([`src/shared/arkiv.ts`](../src/shared/arkiv.ts)); writes and reads are typed and checked | Rows always have the same fields; entities from other apps never show up |
| **Indexed `site`** | `eq('site', site)` for lookups | Type a domain, get only that site's observations |
| **Indexed `observedAt` + `orderBy(desc)`** | Newest first; `gt('observedAt', now − 30 days)` for the landing view | Most recent behaviour at the top |
| **Indexed `outcome`** | `eq('outcome', 'delivered')` on the landing view | Only leaks that actually reached the recipient, not ones the browser blocked |
| **Indexed `category`, `recipient`** | Available for "which sites send to Google Analytics?" style queries (see the README query) | Not yet in the UI; used in the runnable README query |
| **Ownership** (`ownedBy(PUBLISHER)`) | The website trusts only the survey account; anyone else can write the same schema without polluting the view | Rows can't be injected by strangers |
| **Expiration** (`ExpirationTime.fromDays(30)`) | Set on every observation in [`scripts/publish-arkiv.ts`](../scripts/publish-arkiv.ts) | The registry only shows the last 30 days; old observations disappear on their own |
| **Public read from the browser** | The page bundles the SDK and reads with Arkiv's public endpoint (no key in the page) | Live data with no backend of ours in between |

## Flow

1. `node test/field-survey.mjs` opens real sites for a random address with the extension watching, and writes `research/field-test.json` (domains and encodings only).
2. `npm run publish:arkiv` creates one entity per observation from that file, signed by the publisher account, expiring in 30 days.
3. The registry page queries those entities live and renders them.

## Deliberately not used

- **Entity updates** (`patchEntity`): observations are facts at a point in time, so we publish new ones instead of editing.
- **Writes from the extension**: the extension must make zero network requests (our CROPS commitment), so contributing stays a separate, explicit step.
