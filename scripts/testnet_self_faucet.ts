import { Address, internal, toNano, SendMode } from '@ton/core';
import { TonClient, WalletContractV5R1 } from '@ton/ton';
import nacl from 'tweetnacl';

const endpoint = process.env.TONCENTER_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC';
const raw = process.env.TON_RAW_KEY;
if (!raw) throw new Error('Set TON_RAW_KEY');

const keyHex = raw.startsWith('0x') ? raw.slice(2) : raw;
const seed = Uint8Array.from(Buffer.from(keyHex, 'hex'));
const keyPair = seed.length === 32 ? nacl.sign.keyPair.fromSeed(seed) : seed.length === 64 ? { publicKey: seed.slice(32), secretKey: seed } : null;
if (!keyPair) throw new Error(`unexpected key length ${seed.length}`);

const client = new TonClient({ endpoint, apiKey: process.env.TONCENTER_API_KEY });
const wallet = client.open(
  WalletContractV5R1.create({
    workchain: 0,
    walletId: { networkGlobalId: -3 },
    publicKey: keyPair.publicKey,
  }),
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const recipientArg = process.argv[2];
const amountArg = process.argv[3] ?? '0.2';

const state = await client.getContractState(wallet.address);
const bootstrap = {
  addressBounceable: wallet.address.toString({ testOnly: true, bounceable: true }),
  addressNonBounceable: wallet.address.toString({ testOnly: true, bounceable: false }),
  addressRaw: wallet.address.toRawString(),
  state: state.state,
  balance: state.balance.toString(),
};

if (!recipientArg) {
  console.log(JSON.stringify({ ok: true, mode: 'bootstrap', ...bootstrap }, null, 2));
  process.exit(0);
}

if (state.balance === 0n) {
  console.log(JSON.stringify({ ok: false, error: 'bootstrap wallet is not funded yet', ...bootstrap }, null, 2));
  process.exit(2);
}

const recipient = Address.parse(recipientArg);
const seqno = state.state === 'active' ? await wallet.getSeqno() : 0;
await wallet.sendTransfer({
  seqno,
  secretKey: keyPair.secretKey,
  sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
  messages: [
    internal({
      to: recipient,
      value: toNano(amountArg),
      bounce: false,
      body: 'testnet bootstrap',
    }),
  ],
});

for (;;) {
  const next = await wallet.getSeqno().catch(() => seqno);
  if (next > seqno) break;
  await sleep(1500);
}

console.log(JSON.stringify({ ok: true, sent: true, amountTon: amountArg, recipient: recipient.toString({ testOnly: true, bounceable: false }), ...bootstrap }, null, 2));
