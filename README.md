# Clawberto TON Testnet

TON testnet interaction and consensus-research tooling for the TON Consensus Bug Bounty Challenge.

## Scope

- testnet only
- consensus-focused
- repro-first
- no mainnet operations by default

## Current contents

- `skills/ton-testnet-consensus` — skill scaffold and contest workflow
- `skills/ton-testnet-consensus/references/bootstrap-funding.md` — actual tested bootstrap funding path and post-bootstrap self-faucet workflow
- `scripts/testnet_probe.ts` — fetch testnet config and test TCP reachability to listed liteservers
- `scripts/testnet_self_faucet.ts` — derive Wallet V5 testnet bootstrap address and fund fresh testnet recipients once the bootstrap wallet is funded

## Runtime choice

Use TypeScript for probing/orchestration.

Reason:
- good fit for structured JSON/TL/config handling
- easy HTTP/process wrappers
- fast iteration with `tsx`
- consistent with existing Node-based Clawberto blockchain tooling

## Secure key storage

Do not store raw keys in repo files.
Use macOS Keychain:
- service: `TON_TESTNET_PRIVATE_KEY`
- account: `openclaw-ton-testnet`

## Bootstrap funding method

What actually worked:
- first drip came from the official bot:
  - `https://t.me/testgiver_ton_bot`
- destination used:
  - `0QA56rpcML5Fk7hMUwM0_v7L0WOix-xmGzRlDp_HNOkgkm7Q`
- funded state observed after success:
  - balance `1999999999` nanotons (`1.999999999 TON`)
  - state `uninitialized`

What did not work reliably:
- legacy direct public `testgiver.fif` bootstrap path
- pure zero-balance bootstrap by RPC/message submission alone

Operational model now:
1. manual first seed
2. programmatic self-faucet after funding
3. public testnet for smoke/integration only
4. sandbox/local own-net for most automation
