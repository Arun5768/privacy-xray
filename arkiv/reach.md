# Reach

## Who it's for

- **People about to connect a wallet** to a site they don't know: look the site up first and see who it was observed sharing addresses with.
- **Privacy researchers and journalists**: a public, queryable dataset of which recipients receive wallet addresses from which sites, that they can extend with their own observations.
- **dApp teams**: check whether their own site shows up, then use the extension's evidence report to find the script responsible.

## Would they use it?

The need is documented: 211 of 1,572 dApps leaked wallet addresses to third parties ([USENIX Security 2023](https://www.usenix.org/system/files/usenixsecurity23-torres.pdf)), and in our own survey tonight, Etherscan delivered a random address in its page URL to Google Analytics and an ad host ([`research/field-test.md`](../research/field-test.md)). Today there is no place to look this up before connecting.

## Can they try it today?

Yes:

- Registry: https://arun5768.github.io/privacy-xray/registry/ — type `etherscan.io`.
- Extension and demo: https://arun5768.github.io/privacy-xray/
- Query from code: see "Arkiv registry" in the [README](../README.md).

Current numbers: one survey run of 8 sites, 3 published observations on testnet. It's small; the value is that the pipeline from observation to public, expiring record works end to end.

## After Mumbai

What would make it useful beyond a demo, in order:

1. Run the survey on a schedule over a longer list of popular dApps, so the registry stays current within its 30-day window.
2. Let extension users contribute anonymized findings as an explicit, opt-in action (for example by exporting a report and submitting it), without the extension itself ever making network requests.
3. Show "known recipients" for a site in the registry before a user connects, and accept observations from other publishers that users choose to trust.
