# Clawberto TON Testnet

TON testnet interaction and consensus-research tooling for the TON Consensus Bug Bounty Challenge.

## Scope

- testnet only
- consensus-focused
- repro-first
- no mainnet operations by default

## Current contents

- `skills/ton-testnet-consensus` — skill scaffold and contest workflow
- `skills/ton-testnet-consensus/scripts/ton_testnet_chat.ts` — deterministic JSON command surface
- `skills/ton-testnet-consensus/scripts/ton_testnet_smoke.ts` — live smoke probe against current liteservers
- `skills/ton-testnet-consensus/references/bootstrap-funding.md` — actual tested bootstrap funding path and post-bootstrap self-faucet workflow
- `skills/ton-testnet-consensus/references/first-candidate-pinning.md` — code-path note + pass/fail criteria for the leader-pinning hypothesis
- `src/ton_testnet.ts` — shared TypeScript probe/bootstrap/self-faucet logic
- `src/pinning_sim.ts` — deterministic local simulation of the first-candidate-pinning hypothesis
- `scripts/testnet_probe.ts` — thin compatibility wrapper for liteserver probing
- `scripts/testnet_self_faucet.ts` — thin compatibility wrapper for bootstrap wallet status / self-faucet sending

## Runtime choice

Use TypeScript for probing/orchestration.

Reason:
- good fit for structured JSON/TL/config handling
- easy HTTP/process wrappers
- fast iteration with `tsx`
- consistent with existing Node-based Clawberto blockchain tooling
- lets the repo keep one deterministic JSON-first command surface instead of ad-hoc shell glue

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
1. human operator solves the first-funding step for now
2. programmatic self-faucet after funding
3. public testnet for smoke/integration only
4. sandbox/local own-net for most automation

What we tried to avoid the manual step:
- legacy direct `testgiver.fif` public path
- TON Center message-submission shortcut attempts
- bot/browser automation handoff in this runtime

Result:
- none of those replaced first-value funding cleanly

## Commands

```bash
npm run --silent ton -- "ton help"
npm run --silent ton -- "ton probe --out-dir /tmp/ton-testnet-probe"
npm run --silent ton -- "ton pinning-sim --scenario single-slot"
npm run --silent ton -- "ton pinning-sim --scenario window --window-slots 5"
npm run smoke:pinning
```
