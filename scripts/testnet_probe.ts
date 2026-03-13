import { mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';

const OUT_DIR = process.argv[2] || '/tmp/ton-testnet-probe';
const CONFIG_URL = 'https://ton.org/testnet-global.config.json';

function intToIp(num: number): string {
  const u = num >>> 0;
  return [(u >>> 24) & 255, (u >>> 16) & 255, (u >>> 8) & 255, u & 255].join('.');
}

function probeTcp(host: string, port: number, timeoutMs = 2500): Promise<{ ok: boolean; ms: number; error?: string }> {
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

const resp = await fetch(CONFIG_URL);
if (!resp.ok) throw new Error(`config fetch failed: ${resp.status}`);
const text = await resp.text();
mkdirSync(OUT_DIR, { recursive: true });
const configPath = `${OUT_DIR}/testnet-global.config.json`;
writeFileSync(configPath, text);
const cfg = JSON.parse(text) as { liteservers?: Array<{ ip: number; port: number; provided?: string; id?: { key?: string } }> };
const servers = (cfg.liteservers || []).map((s, i) => ({
  index: i,
  host: intToIp(s.ip),
  port: s.port,
  provided: s.provided || null,
  key: s.id?.key || null,
}));
const results = [] as Array<Record<string, unknown>>;
for (const s of servers) {
  const r = await probeTcp(s.host, s.port);
  results.push({ ...s, ...r });
}
const okCount = results.filter((r) => r.ok).length;
console.log(JSON.stringify({
  ok: okCount > 0,
  configUrl: CONFIG_URL,
  configPath,
  liteserverCount: servers.length,
  reachableCount: okCount,
  results,
}, null, 2));
