#!/usr/bin/env node
import { probeTestnetLiteservers } from '../../../src/ton_testnet.js';

async function main() {
  const result = await probeTestnetLiteservers({
    outDir: '/tmp/ton-testnet-smoke',
    timeoutMs: 2500,
  });
  if (!result.ok) throw new Error('expected at least one reachable TON testnet liteserver');
  console.log(JSON.stringify({
    ok: true,
    reachableCount: result.reachableCount,
    liteserverCount: result.liteserverCount,
    fastestReachableMs: Math.min(...result.results.filter((entry) => entry.ok).map((entry) => entry.ms)),
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
