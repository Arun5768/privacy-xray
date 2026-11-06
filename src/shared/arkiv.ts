// Public registry of observed leaks, stored on Arkiv (testnet "rabdi").
// Shared by the publisher script and the website's registry page.
// The extension itself never talks to Arkiv.
import { defineSchema, str, u64 } from '@arkiv-network/sdk/schema';

export const OBSERVATION_DAYS = 30;

// One entity = one observed (site → recipient) leak. Never contains an address.
export const Observation = defineSchema('privacy-xray.observation', {
  site: str().indexed(), // eTLD+1 of the page, e.g. etherscan.io
  recipient: str().indexed(), // eTLD+1 of who received the address
  recipientHost: str(),
  company: str(),
  category: str().indexed(), // analytics | rpc | error | other
  location: str(), // query | body | cookie | header | websocket
  encoding: str(), // e.g. plain, base64 → plain, sha256(lowercase)
  outcome: str().indexed(), // delivered | blocked-by-browser | failed | unknown
  observedAt: u64().indexed(), // unix seconds
  method: str(), // how it was observed, e.g. field-survey
  tool: str(), // privacy-xray@<version>
});
