#!/usr/bin/env node
import { simulatePinnedLeaderWindow, simulateSinglePinnedSlot } from '../../../src/pinning_sim.js';
import { bootstrapWalletStatus, DEFAULT_BOOTSTRAP_OUT_DIR, DEFAULT_CONFIG_URL, DEFAULT_KEY_ENV, DEFAULT_PROBE_OUT_DIR, DEFAULT_TONCENTER_ENDPOINT, fetchTestnetConfig, probeTestnetLiteservers, sendSelfFaucetTransfer, writeTestnetConfig } from '../../../src/ton_testnet.js';

type ParsedArgs = { positionals: string[]; flags: Map<string, string | true> };

function tokenize(argv: string[]) {
  const raw = argv.length === 1 ? argv[0].trim() : argv.join(' ').trim();
  return raw.split(/\s+/).filter(Boolean);
}

function parseArgs(argv: string[]): ParsedArgs {
  const tokens = tokenize(argv);
  if (['ton', '/ton', 'ton-testnet', '/ton-testnet'].includes(tokens[0] || '')) tokens.shift();
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = tokens[i + 1];
    if (!next || next.startsWith('--')) flags.set(key, true);
    else {
      flags.set(key, next);
      i += 1;
    }
  }
  return { positionals, flags };
}

function getFlag(parsed: ParsedArgs, name: string, fallback?: string) {
  const value = parsed.flags.get(name);
  if (typeof value === 'string') return value;
  if (value === true) return 'true';
  return fallback;
}

function requirePositional(parsed: ParsedArgs, idx: number, label: string) {
  const value = parsed.positionals[idx];
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function print(payload: unknown): never {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(0);
}

async function runCommand(parsed: ParsedArgs) {
  const cmd = parsed.positionals[0];
  if (!cmd) throw new Error('Missing command');

  switch (cmd) {
    case 'bootstrap-config': {
      const outDir = getFlag(parsed, 'out-dir', DEFAULT_BOOTSTRAP_OUT_DIR) || DEFAULT_BOOTSTRAP_OUT_DIR;
      const configUrl = getFlag(parsed, 'config-url', DEFAULT_CONFIG_URL) || DEFAULT_CONFIG_URL;
      const fetched = await fetchTestnetConfig(configUrl);
      const configPath = writeTestnetConfig(fetched.text, outDir);
      return {
        ok: true,
        outDir,
        config: configPath,
        repo: 'https://github.com/ton-blockchain/ton',
        branch: 'testnet',
        relevantDocs: 'https://github.com/ton-blockchain/ton/blob/testnet/doc/FullNode-HOWTO',
        consensusDir: 'https://github.com/ton-blockchain/ton/tree/testnet/validator/consensus',
      };
    }
    case 'probe': {
      return await probeTestnetLiteservers({
        outDir: getFlag(parsed, 'out-dir', DEFAULT_PROBE_OUT_DIR) || DEFAULT_PROBE_OUT_DIR,
        configUrl: getFlag(parsed, 'config-url', DEFAULT_CONFIG_URL) || DEFAULT_CONFIG_URL,
        timeoutMs: Number(getFlag(parsed, 'timeout-ms', '2500')),
      });
    }
    case 'bootstrap-wallet':
    case 'wallet-status':
      return await bootstrapWalletStatus({
        endpoint: getFlag(parsed, 'endpoint', DEFAULT_TONCENTER_ENDPOINT) || DEFAULT_TONCENTER_ENDPOINT,
        keyEnv: getFlag(parsed, 'key-env', DEFAULT_KEY_ENV) || DEFAULT_KEY_ENV,
      });
    case 'self-faucet':
    case 'fund':
      return await sendSelfFaucetTransfer({
        recipient: requirePositional(parsed, 1, 'recipient'),
        amountTon: getFlag(parsed, 'amount', '0.2') || '0.2',
        endpoint: getFlag(parsed, 'endpoint', DEFAULT_TONCENTER_ENDPOINT) || DEFAULT_TONCENTER_ENDPOINT,
        keyEnv: getFlag(parsed, 'key-env', DEFAULT_KEY_ENV) || DEFAULT_KEY_ENV,
      });
    case 'pinning-sim': {
      const scenario = getFlag(parsed, 'scenario', 'single-slot') || 'single-slot';
      if (scenario === 'single-slot') return simulateSinglePinnedSlot();
      if (scenario === 'window') {
        return simulatePinnedLeaderWindow(Number(getFlag(parsed, 'window-slots', '5')));
      }
      throw new Error(`Unknown pinning-sim scenario: ${scenario}`);
    }
    case 'help':
      return {
        commands: [
          'ton bootstrap-config [--out-dir /tmp/ton-testnet] [--config-url https://ton.org/testnet-global.config.json]',
          'ton probe [--out-dir /tmp/ton-testnet-probe] [--timeout-ms 2500] [--config-url https://ton.org/testnet-global.config.json]',
          'ton bootstrap-wallet [--endpoint https://testnet.toncenter.com/api/v2/jsonRPC] [--key-env TON_RAW_KEY]',
          'ton self-faucet <recipient> [--amount 0.2] [--endpoint https://testnet.toncenter.com/api/v2/jsonRPC] [--key-env TON_RAW_KEY]',
          'ton pinning-sim [--scenario single-slot|window] [--window-slots 5]',
          'ton help',
        ],
        defaults: {
          configUrl: DEFAULT_CONFIG_URL,
          bootstrapOutDir: DEFAULT_BOOTSTRAP_OUT_DIR,
          probeOutDir: DEFAULT_PROBE_OUT_DIR,
          endpoint: DEFAULT_TONCENTER_ENDPOINT,
          keyEnv: DEFAULT_KEY_ENV,
        },
      };
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const result = await runCommand(parsed);
  print(result);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  process.exit(1);
});
