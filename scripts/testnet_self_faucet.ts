#!/usr/bin/env node
import { bootstrapWalletStatus, sendSelfFaucetTransfer } from '../src/ton_testnet.js';

const recipient = process.argv[2];
const amountTon = process.argv[3] || '0.2';

const result = recipient
  ? await sendSelfFaucetTransfer({ recipient, amountTon })
  : await bootstrapWalletStatus();

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(2);
