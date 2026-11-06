# Arkiv friction log

Things we hit while building tonight with `@arkiv-network/sdk` 1.0.1 and `viem` 2.57, in the order we hit them.

## 1. The docs homepage doesn't show the SDK

- **Expected:** docs.arkiv.network to show install, client setup, `createEntity` and a query.
- **What happened:** the homepage lists network details and links to a "first entity" page; the working tutorial was in the npm package's README (`node_modules/@arkiv-network/sdk/README.md`), which we found by installing the package.
- **Suggestion:** put the README's "Define a Schema / Create an Entity / Query It" sections on the docs homepage.

## 2. The README's dependency snippet is out of date

- The README shows `"@arkiv-network/sdk": "^0.9.0"` after `npm install`; npm installed 1.0.1. Minor, but it makes you wonder whether the examples match the installed version (they did).

## 3. A query needs at least one filter

- **Expected:** a quick `select().limit(2).fetch()` to check connectivity.
- **What happened:** `InvalidPredicateError: A query needs at least one filter — the language has no spelling for 'match every entity'.`
- **Reproduce:** `createPublicClient({ chain: rabdi({ accessKey: '' }), transport: http() }).select({ $key: true }).limit(2).fetch()`
- The error message is excellent and told us exactly what to do (`ownedBy(...)` works). A one-line note in the README's query section would save the round trip.

## 4. Reading from a public web page: key or no key?

- The SDK warns that the public endpoint is heavily rate limited and recommends an access key. For a static website that reads in the visitor's browser, any key we embed is public.
- **Suggestion:** say explicitly whether access keys are safe to ship in front-end code (read-only, origin-restricted?) or recommend a pattern for public read-only pages. We used the public endpoint and accept the rate limit.

## 5. Bundle size for a read-only page

- A page that only reads (`createPublicClient`, `select`, `eq`, `desc`) bundles to about 470 KB minified with esbuild, mostly viem.
- **Suggestion:** a lighter read-only entry point, or documented tree-shaking tips.

## 6. Funding a testnet account needs a manual step

- Writing requires tGLM from the faucet at hub.arkiv.network, done by hand in a browser. Fine for a hackathon; for CI or a scheduled survey, a documented programmatic route (or a higher-limit dev faucet) would help.
