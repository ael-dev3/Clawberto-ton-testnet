---
name: ton-testnet-consensus
description: Connect to and inspect TON testnet for the TON consensus bug bounty. Use when working on TON testnet interactions, fetching testnet bootstrap/config data, studying validator/consensus on the testnet branch, building reproducible consensus-bug evidence, or preparing contest-ready reports that stay testnet-only and avoid mainnet.
---

# TON Testnet Consensus

Use this skill for **testnet-only** TON consensus research.

## Core rules

- Stay on **testnet**. Do not touch mainnet unless the user explicitly changes scope.
- Treat `testnet` branch code as authoritative for this challenge.
- Prioritize `validator/consensus/`, especially `validator/consensus/simplex/`.
- Ignore `validator/consensus/null` unless it is needed for contrast.
- Do not produce speculative reports. Every claim must be validated.
- Optimize for: **real bug -> clean repro -> clear impact -> code-change-needed**.
- Keep raw keys out of repo files. Use secure local storage only.

## Runtime choice

Use **TypeScript** for probing/orchestration by default.

Reason:
- structured JSON/config handling is a good fit
- fast iteration with `tsx`
- matches the broader Node-heavy Clawberto blockchain tooling style

## Workflow

1. **Bootstrap testnet context**
   - Use `scripts/bootstrap_testnet_env.sh` to fetch the current TON testnet global config and save it under `/tmp/ton-testnet/`.
   - Model **global config** and **local node config** as separate layers.
   - If needed, inspect the `testnet` branch of `ton-blockchain/ton` directly.

2. **Study the hot path**
   Focus in this order:
   - `validator/consensus/simplex/consensus.cpp`
   - `validator/consensus/simplex/votes.cpp`
   - `validator/consensus/simplex/certificate.cpp`
   - `validator/consensus/simplex/candidate-resolver.cpp`
   - `validator/consensus/simplex/state-resolver.cpp`
   - `validator/consensus/simplex/pool.cpp`
   - boundary/network files such as `bridge.cpp`, `private-overlay.cpp`, and `bus.cpp`

3. **Form a narrow hypothesis**
   Good target classes:
   - safety break
   - liveness failure
   - stale/replay acceptance
   - bad quorum / vote / certificate handling
   - inconsistent state transition
   - realistic validator DoS / resource exhaustion

4. **Validate, do not vibe**
   - Reproduce in controlled conditions first when possible.
   - Use testnet as the realism layer, not as a blind-fuzzing target.
   - Keep repros within contest limits: `< 10^4` slots and `<= 100` validators for consensus bugs.

5. **Prefer observation before execution**
   - Start with passive testnet inspection and config/bootstrap understanding.
   - Keep any future live-execution layer separate and more tightly gated.
   - Preserve forensic artifacts if a node writes useful data under `${DB_ROOT}/error`.

6. **Prepare report output**
   Keep final reports in this exact structure:
   1. Report title
   2. Report impact
   3. Short description
   4. Reproduction details or secret gist link

## Operational notes from TON docs

- Most important binaries: `validator-engine`, `validator-engine-console`, `generate-random-id`
- Testnet bootstrap starts from `https://ton.org/testnet-global.config.json`
- Core init shape is:
  - `validator-engine -C <global-config> --db <db-root> --ip <public-ip:udp-port> -l <log-dir>`
- `${DB_ROOT}/config.json` is runtime/local state, not the same thing as the downloaded global config
- `${DB_ROOT}/keyring` is sensitive
- full node / validator operation assumes public IPv4 + UDP reachability
- lite-server exposure is useful later for lower-risk inspection workflows

## Patterns borrowed from sibling Clawberto repos

- deterministic entrypoints
- plan/read first, action later
- stronger gates around any live execution
- full identifiers by default
- secure key storage outside repo files
- compact, operator-style outputs

## References

- Read `references/contest-workflow.md` for the challenge-grounded operating model and report checklist.
- Read `references/fullnode-howto-notes.md` for the useful extracted TON full-node/testnet interaction details.
