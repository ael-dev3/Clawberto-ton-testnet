# TON Consensus Contest Workflow

## Ground truth

- Challenge target: new TON consensus implementation
- Authoritative implementation: `ton-blockchain/ton` on branch `testnet`
- Main code scope: `validator/consensus/`
- Exclude: `validator/consensus/null`
- Same code is stated to be running on TON testnet

## Best operating model

Use this order:

1. Read code
2. Identify a narrow hypothesis
3. Reproduce locally or in a controlled setup when possible
4. Confirm realism against testnet when useful
5. Write a compact, contest-ready report

Avoid this order:

- blind testnet probing first
- speculative bug writeups
- mainnet exploration for this challenge

## Report acceptance checklist

A candidate finding is worth keeping only if all are true:

- In scope
- Real and not speculative
- Reproducible
- Verifiable from provided material
- Requires a code change to fix
- Not obviously duplicate / already fixed in `testnet`

## Contest constraints

### Consensus bug repros
- Fewer than `10^4` slots
- No more than `100` validators

### Resource-exhaustion bug repros
Need at least one of:
- superlinear resource growth over time under admissible attacker model
- still-linear growth, but realistically enough for validator DoS (example: bandwidth above a 1 Gbps link)

## High-value bug classes

- Safety failures
- Liveness failures
- Quorum / certificate logic mistakes
- Replay / stale message acceptance
- Invalid state transition acceptance
- Fork handling edge cases
- Candidate resolution inconsistencies
- Pool / vote bookkeeping flaws
- Resource exhaustion with realistic validator impact

## Hot files

### Highest priority
- `validator/consensus/simplex/consensus.cpp`
- `validator/consensus/simplex/votes.cpp`
- `validator/consensus/simplex/certificate.cpp`
- `validator/consensus/simplex/candidate-resolver.cpp`
- `validator/consensus/simplex/state-resolver.cpp`
- `validator/consensus/simplex/pool.cpp`

### Important boundary files
- `validator/consensus/bridge.cpp`
- `validator/consensus/private-overlay.cpp`
- `validator/consensus/bus.cpp`
- `validator/consensus/chain-state.cpp`

## Required report format

1. Report title
2. Report impact
3. Short description
4. Reproduction details or a link to a secret gist containing the full report

## Practical note

The challenge explicitly allows LLM usage, but low-quality AI-generated reports may be ignored or penalized.
So every output must be treated as a draft until manually validated.
