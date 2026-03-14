#!/usr/bin/env node
import { DEFAULT_PROBE_OUT_DIR, probeTestnetLiteservers } from '../src/ton_testnet.js';

const outDir = process.argv[2] || DEFAULT_PROBE_OUT_DIR;

const result = await probeTestnetLiteservers({ outDir });
console.log(JSON.stringify(result, null, 2));
