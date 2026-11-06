// Sites the audit agent visits. Each one puts the address in the page URL,
// which is exactly when a page's third parties can pick it up.
export const AUDIT_SITES: { name: string; url: (a: string) => string }[] = [
  { name: 'Etherscan', url: (a) => `https://etherscan.io/address/${a}` },
  { name: 'Blockscout', url: (a) => `https://eth.blockscout.com/address/${a}` },
  { name: 'DeBank', url: (a) => `https://debank.com/profile/${a}` },
  { name: 'Zapper', url: (a) => `https://zapper.xyz/account/${a}` },
  { name: 'Zerion', url: (a) => `https://app.zerion.io/${a}/overview` },
  { name: 'OpenSea', url: (a) => `https://opensea.io/${a}` },
  { name: 'Arkham', url: (a) => `https://intel.arkm.com/explorer/address/${a}` },
  { name: 'OKLink', url: (a) => `https://www.oklink.com/eth/address/${a}` },
  { name: 'Uniswap portfolio', url: (a) => `https://app.uniswap.org/portfolio/${a}` },
];

export type AuditSiteResult = {
  name: string;
  url: string; // with the decoy redacted
  status: 'queued' | 'scanning' | 'done' | 'error';
  error?: string;
  recipients: { host: string; company: string; category: string; encodings: string[]; outcome: string }[];
};

export type AuditState = {
  running: boolean;
  decoyRef: string; // redacted decoy, for display
  startedAt: number;
  finishedAt?: number;
  sites: AuditSiteResult[];
};
