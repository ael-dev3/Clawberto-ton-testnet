#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-/tmp/ton-testnet}"
CONFIG_URL="https://ton.org/testnet-global.config.json"
REPO_URL="https://github.com/ton-blockchain/ton"
BRANCH="testnet"

mkdir -p "$OUT_DIR"
curl -fsSL "$CONFIG_URL" -o "$OUT_DIR/testnet-global.config.json"

cat <<EOF
OK
out_dir=$OUT_DIR
config=$OUT_DIR/testnet-global.config.json
repo=$REPO_URL
branch=$BRANCH
relevant_docs=https://github.com/ton-blockchain/ton/blob/testnet/doc/FullNode-HOWTO
consensus_dir=https://github.com/ton-blockchain/ton/tree/testnet/validator/consensus
EOF
