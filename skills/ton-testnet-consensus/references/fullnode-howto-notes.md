# FullNode-HOWTO notes for TON testnet skill

## Most useful operational facts

### Binaries
Core binaries called out by TON docs:
- `validator-engine/validator-engine`
- `validator-engine-console/validator-engine-console`
- `generate-random-id`
- optional lite client binary for inspection

### Working directory model
Useful directories under `${DB_ROOT}`:
- `config.json` — local auto-generated config
- `static/` — zerostate and non-downloadable chain files
- `keyring/` — private/public keys used by validator-engine
- `error/` — severe-error artifacts worth preserving for forensic analysis
- `archive/` — older blocks, can live on slower disk

Implication for this skill:
- probes should separate **global config**, **local config**, and **keyring state**
- forensic helpers should read or preserve `${DB_ROOT}/error`
- key files must never be committed into repo files

### Global vs local config
TON docs distinguish:
- global config file = network/bootstrap input
- local `${DB_ROOT}/config.json` = generated/updated runtime state

Implication for this skill:
- always model bootstrap and runtime config as separate layers
- avoid overwriting local config blindly
- testnet bootstrap should begin from `https://ton.org/testnet-global.config.json`

### Initial node bootstrap
Documented init shape:
- `validator-engine -C <global-config> --db <db-root> --ip <public-ip:udp-port> -l <log-dir>`

Implication for this skill:
- bootstrap helpers should capture these inputs explicitly:
  - global config path
  - db root
  - public IP
  - UDP port
  - log dir

### Console remote control
TON docs require separate server/client keypairs for `validator-engine-console` control.

Implication for this skill:
- do not reuse wallet/private-action keys for console control
- if we add console helpers later, use dedicated control keys

### Lite server mode
A full node can expose lite-server access after adding a separate lite-server key and config entry.

Implication for this skill:
- a useful future probe layer is lite-client/lite-server inspection, because it is lower-risk than validator operations and good for observing testnet state

### Firewall / networking
TON docs explicitly require public IPv4 and UDP reachability for full-node networking.

Implication for this skill:
- local laptop-only assumptions are bad for full validator bootstrap
- for now, testnet interaction helpers should prefer observation/probing workflows unless a proper remote node target exists

## Patterns worth copying from sibling Clawberto repos

### From Clawberto-Kittenswap
- deterministic CLI/chat entrypoints
- strict plan-first workflow
- explicit DO-NOT-SEND / stop conditions
- separate verification after each real action
- clear network constants and contract/config tables near top of docs

### From Clawberto-HyperEVM
- split read/trace logic from execution logic
- keep execution as a separate layer with stronger gates
- print full identifiers by default

### From Farcaster Agent
- keep setup flow explicit
- persist credentials, but warn about storage model
- prefer one clear happy path before adding broader features

## Recommended TON skill structure

1. bootstrap / config fetch
2. passive observation helpers
3. optional execution helpers later
4. contest report formatting

Keep live execution narrower than observation.
