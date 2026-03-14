# TON Simplex First-Candidate Pinning

## Why this note exists

This is a focused operator note for the `testnet` branch hypothesis:
- one pending candidate per slot
- second candidate for the same slot is ignored
- reject / wait-for-parent paths do not clear the pinned pending candidate
- a Byzantine leader may be able to pin some honest validators to a doomed candidate while others move on with a valid one

## Upstream code path to verify

Primary files:
- `validator/consensus/simplex/consensus.cpp`
- `validator/consensus/simplex/pool.cpp`
- `validator/consensus/simplex/state.h`
- `validator/consensus/simplex/state-resolver.cpp`

Observed path in `testnet` branch:
1. `ConsensusImpl::handle(CandidateReceived)` stores only one `pending_block` per slot.
2. If another candidate for the same slot arrives with a different block ID while `pending_block` is already set, it is ignored with only a `FIXME` comment.
3. `try_notarize()` reads `slot.state->pending_block` and returns early on:
   - `WaitForParent` misbehavior
   - `CandidateReject`
4. Those return paths do **not** clear `pending_block`.
5. `try_vote_final()` only emits a final vote when:
   - `!voted_skip`
   - `!voted_final`
   - `voted_notar == notar_cert`
6. Pool progress can still advance on notarized or skipped slots.
7. Tracked slots are pruned only when `notify_finalized()` runs.
8. Standstill rebroadcast walks `tracked_slots_interval()` and serializes stored certs plus the local validator's votes.

## Current execution status

What is exercised in this repo right now:
- deterministic local simulation of the exact pinning / notarization / finalization / pruning path
- live public-testnet liteserver reachability smoke

What is **not** yet exercised here:
- a full 4-validator own-net running real `validator-engine` binaries from `ton-blockchain/ton@testnet`

Practical blocker in this runtime during this pass:
- no local TON validator build/install was already present
- the standard native build toolchain needed for a fresh `ton` build (`cmake`, `ninja`, etc.) was not already available here

## What the deterministic local simulation currently shows

### Single attacked slot
- One honest validator can be pinned to bad candidate `A`.
- Other two honest validators plus the Byzantine leader can notarize valid candidate `B`.
- If the Byzantine leader withholds its final vote, that slot can remain **notarized but unfinalized**.
- However, the next honest-led slot can still notarize and finalize with the three honest validators.
- When that later slot finalizes, `notify_finalized()` prunes the earlier pinned slot.

**Takeaway:**
- single-slot effect looks like **real finalization lag**
- but not obviously unbounded standstill growth by itself

### Consecutive Byzantine-led window
- If the same Byzantine leader controls multiple consecutive slots and repeats the pinning pattern:
  - each slot can become notarized but unfinalized
  - tracked-slot interval grows linearly with the number of attacked slots
  - standstill rebroadcast work also grows linearly over that window
- A later honest-led finalized slot prunes the whole window.

**Takeaway:**
- stronger candidate for bounded liveness degradation / transient rebroadcast amplification
- not yet proof of an accepted resource-exhaustion report without further measurement

## Pass / fail criteria for a real reproduction

### Pass: primary-scope liveness bug
Show all of the following in a controlled run:
1. an honest validator accepts bad `A` first and ignores valid `B` later for the same slot
2. `B` still reaches notarization quorum elsewhere
3. the pinned validator never emits a final vote for `B`
4. finalization of that slot is delayed or prevented specifically because of the pinning
5. a code change is needed to clear / replace / re-evaluate the pinned slot state

### Pass: resource-exhaustion / DoS bug
Show all of the following:
1. repeated pinning across a reproducible window of slots
2. tracked-slot interval grows over time under the admissible attacker model
3. standstill rebroadcast load grows enough to be operationally meaningful
4. the effect is not just cosmetic logging noise

### Fail
Drop the hypothesis if either is true:
- later honest-led slots always cleanly finalize fast enough that the effect is negligible
- the rebroadcast/load effect stays too small to matter on realistic hardware/link budgets

## Minimal 4-validator / 1-Byzantine experiment

### Scenario A — single pinned slot
- validators: `H1`, `H2`, `H3`, `B`
- quorum threshold: `3`
- byzantine leader slot `s`

Sequence:
1. deliver bad candidate `A` to `H1` first (`WaitForParent` or reject path)
2. deliver valid candidate `B` to `H2`, `H3`, and `B`
3. let `B` notarize
4. withhold Byzantine final vote
5. observe:
   - `H1` ignored `B`
   - slot `s` notarized
   - slot `s` not finalized
6. next honest-led slot `s+1`
7. verify whether three honest validators finalize `s+1` and prune slot `s`

### Scenario B — repeated Byzantine-led window
- same four validators
- byzantine leader owns a consecutive leader window of `k` slots
- repeat Scenario A for slots `s..s+k-1`
- measure tracked-slot interval and standstill rebroadcast work before the first later honest-led finalized slot

## Local commands in this repo

### Deterministic simulation: single attacked slot
```bash
npm run --silent ton -- "ton pinning-sim --scenario single-slot"
```

### Deterministic simulation: repeated Byzantine-led window
```bash
npm run --silent ton -- "ton pinning-sim --scenario window --window-slots 5"
```

## Current confidence

- pinning primitive: **high confidence**
- single-slot finalization-lag effect: **high confidence**
- unbounded liveness failure from one attacked slot: **low confidence**
- resource-exhaustion acceptance without stronger measurement: **low confidence**
