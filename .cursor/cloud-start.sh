#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -d "$NVM_DIR/versions/node" ]]; then
  node_bin_dir="$(find "$NVM_DIR/versions/node" -mindepth 2 -maxdepth 2 -type d -name bin | sort -V | tail -1)"
  if [[ -n "$node_bin_dir" && -x "$node_bin_dir/node" ]]; then
    export PATH="$node_bin_dir:$PATH"
    hash -r
  fi
fi

if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi

exec http-server -c-1 -p 8080 -a 0.0.0.0 .
