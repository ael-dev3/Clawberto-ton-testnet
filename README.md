# Clawberto TON Testnet

TON testnet interaction and consensus-research tooling for the TON Consensus Bug Bounty Challenge.

## Scope

- testnet only
- consensus-focused
- repro-first
- no mainnet operations by default

## Current contents

- `skills/ton-testnet-consensus` — skill scaffold and contest workflow

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
