// Publishes field-test observations to the public Privacy X-Ray registry on Arkiv.
//
//   node --env-file=.env scripts/publish-arkiv.ts [research/field-test.json]
//
// Needs PRIVATE_KEY (a funded Arkiv testnet account) and optionally ARKIV_ACCESS_KEY
// in .env. Each observation becomes one entity that expires after OBSERVATION_DAYS,
// so the registry only ever shows recent behaviour. No wallet address of any user
// is ever published.
import { readFileSync } from 'node:fs';
import { createWalletClient, ExpirationTime } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { u64 } from '@arkiv-network/sdk/schema';
import { http, isHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Observation, OBSERVATION_DAYS } from '../src/shared/arkiv.ts';

type Input = {
  observations: {
    site: string;
    recipient: string;
    recipientHost: string;
    company: string;
    category: string;
    location: string;
    encoding: string;
    outcome: string;
    observedAt: string;
  }[];
};

const file = process.argv[2] ?? 'research/field-test.json';
const key = process.env.PRIVATE_KEY;
if (!key || !isHex(key)) throw new Error('Set PRIVATE_KEY in .env to a funded Arkiv testnet account');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const account = privateKeyToAccount(key);
const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? '' });
const wallet = createWalletClient({ chain, transport: http(), account });

const { observations } = JSON.parse(readFileSync(file, 'utf8')) as Input;
console.log(`Publishing ${observations.length} observations from ${file} as ${account.address}`);

for (const o of observations) {
  const { entityKey, txHash } = await wallet.createEntity(
    Observation,
    {
      site: o.site,
      recipient: o.recipient,
      recipientHost: o.recipientHost,
      company: o.company,
      category: o.category,
      location: o.location,
      encoding: o.encoding,
      outcome: o.outcome,
      observedAt: u64(BigInt(Math.floor(new Date(o.observedAt).getTime() / 1000))),
      method: 'field-survey',
      tool: `privacy-xray@${pkg.version}`,
    },
    { expiration: ExpirationTime.fromDays(OBSERVATION_DAYS) },
  );
  console.log(`${o.site} → ${o.recipientHost}: entity ${entityKey} (tx ${txHash})`);
}
