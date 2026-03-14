# TON Testnet Bootstrap Funding

## Current conclusion

For now, a **human operator is required** to obtain the initial public-testnet funds.

Once the first seed lands, the workflow becomes programmatic again.

## What actually worked

### Manual first drip via official bot

The first successful funding path was the official TON bot:
- `https://t.me/testgiver_ton_bot`

Used destination:
- non-bounceable testnet Wallet V5 address:
  - `0QA56rpcML5Fk7hMUwM0_v7L0WOix-xmGzRlDp_HNOkgkm7Q`

Observed funded state after the manual bot request:
- balance: `1999999999` nanotons (`1.999999999 TON`)
- state: `uninitialized`

That state is acceptable.
A funded wallet can remain `uninitialized` until its first outgoing transaction.

## What we tried to bypass the manual step

### Legacy public `testgiver.fif` path

The older monorepo docs still describe the seqno + `testgiver.fif` route.
In practice, the direct externally-submitted message path was rejected by the current public test giver.

Observed failure:
- external message not accepted by the contract
- no funds received

Treat that path as obsolete/unreliable for public bootstrap unless proven otherwise with a real Fift byte-for-byte repro.

### TON Center message submission as a faucet shortcut

Tried:
- `sendBoc`
- `sendQuery`

Observed failures:
- direct external message to the public giver was rejected
- `sendQuery` path returned HTTP-level failure in this runtime

This did not solve bootstrap liquidity.
It only attempted message delivery to a contract that still has to accept and fund the request.

### Automating the official public bot

Tried:
- Telegram tool path to `@testgiver_ton_bot`
- browser path to bot/web handoff

Observed blockers:
- Telegram recipient resolution failed in this runtime
- browser automation path was unavailable at the time
- the official bot still requires a captcha

### Pure zero-balance bootstrap by RPC alone

This was not viable.
A zero-balance wallet still needs value from somewhere.
RPC/message submission does not create bootstrap liquidity by itself.

## Recommended funding model now

### Stage 1 — human-gated first seed

Use one of:
- official bot with captcha
- one-time helper transfer from an already funded human-controlled testnet wallet

### Stage 2 — programmatic self-faucet

After the first seed lands:
1. use `scripts/testnet_self_faucet.ts`
2. send non-bounceable transfers to fresh testnet recipients
3. let those funded addresses remain `uninitialized` until they need to send
4. activate/bootstrap them with their first outgoing transaction later when needed

## General thoughts

- public testnet is usable for agent workflows **after bootstrap**
- public testnet is not a good fully unattended bootstrap surface
- the hard blocker is first-value funding, not Wallet V5 derivation or TON Center transport
- for repeated automated work, prefer sandbox / local own-net and reserve public testnet for smoke/integration passes
- if the operator can solve the captcha once, the repo self-faucet flow becomes the practical programmatic path afterward

## Exact local tools in this repo

### Probe connectivity
```bash
npm run probe:testnet -- /tmp/ton-testnet-probe
```

### Show bootstrap wallet state
```bash
export TON_RAW_KEY="$(security find-generic-password -a openclaw-ton-testnet -s TON_TESTNET_PRIVATE_KEY -w)"
npx tsx scripts/testnet_self_faucet.ts
```

### Fund another testnet address after bootstrap
```bash
export TON_RAW_KEY="$(security find-generic-password -a openclaw-ton-testnet -s TON_TESTNET_PRIVATE_KEY -w)"
npx tsx scripts/testnet_self_faucet.ts <recipient> <amountTon>
```
