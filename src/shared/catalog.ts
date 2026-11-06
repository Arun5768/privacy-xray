import { getDomain, getHostname } from 'tldts';
import type { Category } from './types.ts';

// Registrable domain, falling back to the hostname for localhost and IPs so
// the two demo origins (localhost vs 127.0.0.1) count as different parties.
export function siteOf(url: string): string {
  return getDomain(url) ?? getHostname(url) ?? url;
}

export function hostOf(url: string): string {
  return getHostname(url) ?? url;
}

type Entry = { company: string; category: Category };

const CATALOG: Record<string, Entry> = {
  // RPC providers
  'alchemy.com': { company: 'Alchemy', category: 'rpc' },
  'infura.io': { company: 'Infura (Consensys)', category: 'rpc' },
  'quiknode.pro': { company: 'QuickNode', category: 'rpc' },
  'drpc.org': { company: 'dRPC', category: 'rpc' },
  'ankr.com': { company: 'Ankr', category: 'rpc' },
  'llamarpc.com': { company: 'LlamaNodes', category: 'rpc' },
  'publicnode.com': { company: 'PublicNode', category: 'rpc' },
  'blastapi.io': { company: 'Blast API', category: 'rpc' },
  'chainstack.com': { company: 'Chainstack', category: 'rpc' },
  'cloudflare-eth.com': { company: 'Cloudflare', category: 'rpc' },
  // Analytics and marketing
  'google-analytics.com': { company: 'Google Analytics', category: 'analytics' },
  'googletagmanager.com': { company: 'Google Tag Manager', category: 'analytics' },
  'doubleclick.net': { company: 'Google Ads', category: 'analytics' },
  'segment.io': { company: 'Segment', category: 'analytics' },
  'segment.com': { company: 'Segment', category: 'analytics' },
  'mixpanel.com': { company: 'Mixpanel', category: 'analytics' },
  'amplitude.com': { company: 'Amplitude', category: 'analytics' },
  'posthog.com': { company: 'PostHog', category: 'analytics' },
  'hotjar.com': { company: 'Hotjar', category: 'analytics' },
  'heap.io': { company: 'Heap', category: 'analytics' },
  'facebook.com': { company: 'Meta', category: 'analytics' },
  'facebook.net': { company: 'Meta', category: 'analytics' },
  'spindl.xyz': { company: 'Spindl', category: 'analytics' },
  'cookie3.co': { company: 'Cookie3', category: 'analytics' },
  'cookie3.com': { company: 'Cookie3', category: 'analytics' },
  'formo.so': { company: 'Formo', category: 'analytics' },
  'intercom.io': { company: 'Intercom', category: 'analytics' },
  // Error reporting
  'sentry.io': { company: 'Sentry', category: 'error' },
  'datadoghq.com': { company: 'Datadog', category: 'error' },
  'bugsnag.com': { company: 'Bugsnag', category: 'error' },
  'logrocket.io': { company: 'LogRocket', category: 'error' },
  // Demo tracker
  '127.0.0.1': { company: 'DemoTrack Analytics', category: 'analytics' },
};

export function classify(url: string, body: string | null): Entry & { known: boolean } {
  const site = siteOf(url);
  const hit = CATALOG[site];
  if (hit) return { ...hit, known: true };
  if (body && /"jsonrpc"\s*:/.test(body) && /"method"\s*:\s*"eth_/.test(body)) {
    return { company: site, category: 'rpc', known: false };
  }
  if (/sentry|bugsnag|errors?\b/i.test(url)) return { company: site, category: 'error', known: false };
  return { company: site, category: 'other', known: false };
}
