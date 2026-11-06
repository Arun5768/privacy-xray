# Research notes and sources

Gathered while choosing the idea (6 Nov 2026). Figures are quoted as reported by each source.

## Is the problem real?
- Torres et al., "Is Your Wallet Snitching On You? An Analysis on the Privacy Implications of Web3", USENIX Security 2023: 211 of 1,572 dApps and 13 of 100 wallets leaked the user's wallet address to third parties. https://www.usenix.org/system/files/usenixsecurity23-torres.pdf — framework: https://github.com/christoftorres/Web3-Privacy
- "The Masks We (Think We) Wear: Privacy Threats of Browser-Extension Wallets in the Web3 Ecosystem", 2026: wallets send addresses in background RPC requests; 22 of 36 wallets kept exposing revoked addresses. https://arxiv.org/html/2607.06141v1
- ethereum.org, "The next great wallet is private" (July 2026): 13-wallet first-launch sniffer test; lists exposure dashboards and privacy linting as missing. https://ethereum.org/latest/next-great-wallet-private.md
- The Block (2022): Consensys collects IP and wallet addresses of MetaMask users via Infura. https://www.theblock.co/post/189717/consensys-says-it-collects-ip-addresses-of-metamask-users-via-infura

## Why it matters
- Chainalysis, violent wrench attacks 2026: 46 incidents, $30M+ in H1 2026. https://www.chainalysis.com/blog/violent-crypto-wrench-attacks-2026/
- EDPB Guidelines 02/2025 on blockchain, v2.0 adopted 7 July 2026: wallet addresses can be personal data; hashing doesn't remove GDPR coverage. https://www.edpb.europa.eu/documents/guideline/guidelines-022025-on-processing-of-personal-data-through-blockchain_en
- Web3 analytics vendors capture wallet addresses on connect (vendor comparison): https://chainaware.ai/blog/web3-analytics-tools-dapps-comparison-2026/

## What exists already
- Veil: routes dApp RPC reads through Tor, built on EF's Anon-RPC. Hides traffic; doesn't show leaks. https://github.com/Aman035/veil
- Walletbeat: manual privacy ratings for wallets, not dApps.
- Fluidkey, Opaque, Sneaky: stealth payments via ENS (an idea we rejected because it exists).
- Blacklight (The Markup): privacy inspector for ordinary websites; inspiration for the UX. https://themarkup.org/blacklight

## Fit with the EF CROPS prize
- EF's prize page lists "a tool that shows what an app leaks, such as RPC calls, trackers, or metadata" as an example idea. https://ethglobal.com/events/mumbai/prizes/ethereum-foundation
