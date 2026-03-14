import { mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { Address, SendMode, internal, toNano } from '@ton/core';
import { TonClient, WalletContractV5R1 } from '@ton/ton';
import nacl from 'tweetnacl';

export const DEFAULT_CONFIG_URL = 'https://ton.org/testnet-global.config.json';
export const DEFAULT_BOOTSTRAP_OUT_DIR = '/tmp/ton-testnet';
export const DEFAULT_PROBE_OUT_DIR = '/tmp/ton-testnet-probe';
export const DEFAULT_TONCENTER_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC';
export const DEFAULT_KEY_ENV = 'TON_RAW_KEY';

export type TestnetConfig = {
  liteservers?: Array<{
    ip: number;
    port: number;
    provided?: string;
    id?: { key?: string };
  }>;
};

export type ProbeResult = {
  index: number;
  host: string;
  port: number;
  provided: string | null;
  key: string | null;
  ok: boolean;
  ms: number;
  error?: string;
};

export function intToIp(num: number): string {
  const u = num >>> 0;
  return [(u >>> 24) & 255, (u >>> 16) & 255, (u >>> 8) & 255, u & 255].join('.');
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchTestnetConfig(configUrl = DEFAULT_CONFIG_URL) {
  const resp = await fetch(configUrl);
  if (!resp.ok) throw new Error(`config fetch failed: ${resp.status}`);
  const text = await resp.text();
  const json = JSON.parse(text) as TestnetConfig;
  return { configUrl, text, json };
}

export function writeTestnetConfig(text: string, outDir = DEFAULT_BOOTSTRAP_OUT_DIR) {
  mkdirSync(outDir, { recursive: true });
  const configPath = `${outDir}/testnet-global.config.json`;
  writeFileSync(configPath, text);
  return configPath;
}

export function probeTcp(host: string, port: number, timeoutMs = 2500): Promise<{ ok: boolean; ms: number; error?: string }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, ms: Date.now() - started, error });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, 'timeout'));
    socket.once('error', (err) => finish(false, err.message));
    socket.connect(port, host);
  });
}

export async function probeTestnetLiteservers(options?: {
  configUrl?: string;
  outDir?: string;
  timeoutMs?: number;
}) {
  const configUrl = options?.configUrl || DEFAULT_CONFIG_URL;
  const outDir = options?.outDir || DEFAULT_PROBE_OUT_DIR;
  const timeoutMs = options?.timeoutMs ?? 2500;
  const fetched = await fetchTestnetConfig(configUrl);
  const configPath = writeTestnetConfig(fetched.text, outDir);
  const servers = (fetched.json.liteservers || []).map((s, i) => ({
    index: i,
    host: intToIp(s.ip),
    port: s.port,
    provided: s.provided || null,
    key: s.id?.key || null,
  }));
  const results: ProbeResult[] = [];
  for (const server of servers) {
    const probe = await probeTcp(server.host, server.port, timeoutMs);
    results.push({ ...server, ...probe });
  }
  const reachableCount = results.filter((result) => result.ok).length;
  return {
    ok: reachableCount > 0,
    configUrl,
    configPath,
    liteserverCount: servers.length,
    reachableCount,
    results,
  };
}

export type TonKeyPair = {
  publicKey: Buffer;
  secretKey: Buffer;
};

export function loadTonKeyPair(rawKey: string): TonKeyPair {
  const keyHex = rawKey.startsWith('0x') ? rawKey.slice(2) : rawKey;
  const seed = Buffer.from(keyHex, 'hex');
  if (seed.length === 32) {
    const keyPair = nacl.sign.keyPair.fromSeed(seed);
    return {
      publicKey: Buffer.from(keyPair.publicKey),
      secretKey: Buffer.from(keyPair.secretKey),
    };
  }
  if (seed.length === 64) {
    return {
      publicKey: Buffer.from(seed.subarray(32)),
      secretKey: Buffer.from(seed),
    };
  }
  throw new Error(`unexpected key length ${seed.length}`);
}

export function readRawKey(keyEnv = DEFAULT_KEY_ENV) {
  const raw = process.env[keyEnv];
  if (!raw) throw new Error(`Set ${keyEnv}`);
  return raw;
}

export function createTonTestnetClient(endpoint = process.env.TONCENTER_ENDPOINT || DEFAULT_TONCENTER_ENDPOINT) {
  return new TonClient({
    endpoint,
    apiKey: process.env.TONCENTER_API_KEY,
  });
}

export async function openBootstrapWallet(options?: {
  endpoint?: string;
  keyEnv?: string;
  rawKey?: string;
}) {
  const endpoint = options?.endpoint || process.env.TONCENTER_ENDPOINT || DEFAULT_TONCENTER_ENDPOINT;
  const keyEnv = options?.keyEnv || DEFAULT_KEY_ENV;
  const rawKey = options?.rawKey || readRawKey(keyEnv);
  const keyPair = loadTonKeyPair(rawKey);
  const client = createTonTestnetClient(endpoint);
  const wallet = client.open(
    WalletContractV5R1.create({
      workchain: 0,
      walletId: { networkGlobalId: -3 },
      publicKey: keyPair.publicKey,
    }),
  );
  const state = await client.getContractState(wallet.address);
  const summary = {
    addressBounceable: wallet.address.toString({ testOnly: true, bounceable: true }),
    addressNonBounceable: wallet.address.toString({ testOnly: true, bounceable: false }),
    addressRaw: wallet.address.toRawString(),
    state: state.state,
    balance: state.balance.toString(),
    endpoint,
    keyEnv,
  };
  return { client, wallet, keyPair, state, summary };
}

export async function bootstrapWalletStatus(options?: {
  endpoint?: string;
  keyEnv?: string;
  rawKey?: string;
}) {
  const { summary } = await openBootstrapWallet(options);
  return { ok: true, mode: 'bootstrap', ...summary };
}

export async function sendSelfFaucetTransfer(options: {
  recipient: string;
  amountTon?: string;
  endpoint?: string;
  keyEnv?: string;
  rawKey?: string;
  waitForSeqno?: boolean;
}) {
  const amountTon = options.amountTon || '0.2';
  const waitForSeqno = options.waitForSeqno ?? true;
  const { wallet, keyPair, state, summary } = await openBootstrapWallet(options);
  if (state.balance === 0n) {
    return {
      ok: false,
      error: 'bootstrap wallet is not funded yet',
      ...summary,
    };
  }

  const recipient = Address.parse(options.recipient);
  const seqno = state.state === 'active' ? await wallet.getSeqno() : 0;
  await wallet.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: recipient,
        value: toNano(amountTon),
        bounce: false,
        body: 'testnet bootstrap',
      }),
    ],
  });

  if (waitForSeqno) {
    for (;;) {
      const next = await wallet.getSeqno().catch(() => seqno);
      if (next > seqno) break;
      await sleep(1500);
    }
  }

  return {
    ok: true,
    sent: true,
    amountTon,
    recipient: recipient.toString({ testOnly: true, bounceable: false }),
    ...summary,
  };
}
