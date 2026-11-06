# Why Arkiv

## What users would lose with Postgres

The registry answers "who does this crypto site send wallet addresses to?". Its value depends on people trusting that the answer wasn't edited, hidden or quietly taken down.

- **Nobody, including us, can quietly change an observation.** Each one is an entity owned by the publisher account and recorded on-chain with a transaction hash. With Postgres, the operator could rewrite or delete an embarrassing finding and nobody would know.
- **Anyone can read it without us.** The website queries Arkiv directly from the visitor's browser. If our site disappears, the data is still queryable by anyone with the schema name and publisher address (see the query in the README). A Postgres registry dies with its server.
- **Anyone can add to it, and readers choose whom to trust.** Other researchers can publish observations under the same schema from their own accounts, and readers filter by owner. With Postgres, we would be the gatekeeper of who may contribute.
- **Stale data removes itself.** Observations expire after 30 days by protocol, not by a cron job we must keep running. A tracker list that never expires slowly becomes wrong.
- **It fits the CROPS story of the whole project.** The extension has no server. A registry on our own database would reintroduce exactly the central point of control the extension avoids.

## What we kept off Arkiv, and why

- **The extension's detection, findings and watched addresses.** These are private to the user and stay on their device; the extension makes no network requests. Publishing them would defeat the point.
- **Any wallet address or user data.** Only domains, categories and encodings are published, all from a survey that used a random address owned by nobody.
- **Full page URLs.** The path of a page can contain the address being viewed; only the site's domain is stored.
- **The publisher's private key.** It lives in a local `.env` file that is excluded from git.
