# Arkiv schema

Network: Arkiv testnet **rabdi** (chain ID 7794095, RPC `https://rpc.rabdi.db-chain.testnet.arkiv.network`).
Defined in [`src/shared/arkiv.ts`](../src/shared/arkiv.ts), shared by the publisher and the website.

## Entity: `privacy-xray.observation`

One entity is one observed leak: on page *site*, a wallet address was sent to *recipient*.

| Column | Type | Indexed | Meaning |
|---|---|---|---|
| `site` | str | yes | eTLD+1 of the page, e.g. `etherscan.io` |
| `recipient` | str | yes | eTLD+1 of who received the address, e.g. `google.com` |
| `recipientHost` | str | no | Full host, e.g. `analytics.google.com` |
| `company` | str | no | Label from the recipient catalog, or the domain |
| `category` | str | yes | `analytics`, `rpc`, `error` or `other` |
| `location` | str | no | Where the address was found: `query`, `body`, `cookie`, `header`, `websocket` |
| `encoding` | str | no | How it was encoded, e.g. `plain`, `base64 → plain`, `sha256(lowercase)` |
| `outcome` | str | yes | `delivered`, `blocked-by-browser`, `failed` or `unknown` |
| `observedAt` | u64 | yes | Unix seconds of the observation |
| `method` | str | no | How it was observed (`field-survey`) |
| `tool` | str | no | `privacy-xray@<version>` |

The named schema adds the indexed `arkiv.schema = privacy-xray.observation` tag, so queries through it never match other apps' entities.

**Never stored:** any wallet address, IP, user identifier or page URL path. The survey uses a random address that belongs to nobody, and only the domains are published.

## Who owns what

| Entity | Owner | Can edit |
|---|---|---|
| `privacy-xray.observation` from the field survey | Survey publisher `0x6D0622258Fdb25b8E7989AbC3F7D71D82dd65E09` | Only the owner. Observations are never edited after publishing; a new run publishes new entities. |

Anyone can create entities with the same schema. The website therefore filters with `ownedBy(publisher)`, so third-party writes can't inject rows into the registry it shows.

## Expiration

Every observation expires **30 days** after it is published (`ExpirationTime.fromDays(30)`, constant `OBSERVATION_DAYS`). Sites change their trackers, so an old observation is misleading. Expiry means the registry only shows recent behaviour without anyone having to delete anything.

## Queries used

| Feature | Query |
|---|---|
| Look up a site (website registry page) | `select(...).from(Observation).where(eq('site', site)).ownedBy(PUBLISHER).orderBy(desc('observedAt')).limit(50)` |
| Recent delivered leaks (registry landing view) | `.where(and(gt('observedAt', now − 30 days), eq('outcome', 'delivered'))).ownedBy(PUBLISHER).orderBy(desc('observedAt')).limit(50)` |
