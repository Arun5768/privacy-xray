export type Category = 'rpc' | 'analytics' | 'error' | 'other';
export type LeakLocation = 'query' | 'body' | 'cookie' | 'header' | 'websocket';

export type Leak = {
  id: string;
  tabId: number;
  pageOrigin: string;
  pageSite: string; // eTLD+1, or hostname for localhost / IPs
  requestUrl: string; // address and hashes redacted
  method: string;
  resourceType: string;
  recipientSite: string;
  recipientHost: string;
  company?: string;
  category: Category;
  location: LeakLocation;
  transform: string; // e.g. "plain", "base64 → plain", "sha256(lowercase)"
  snippet: string; // redacted context around the match
  initiatorScript?: string;
  blocked: boolean;
  ts: number;
  addressRef: string; // redacted form, e.g. 0x12ab…9f4e
};

export type Needle = {
  value: string;
  transform: string;
  caseSensitive: boolean;
  address: string; // lowercase 0x address this needle derives from
};

export type Match = {
  location: LeakLocation;
  transform: string;
  snippet: string;
  address: string;
};
