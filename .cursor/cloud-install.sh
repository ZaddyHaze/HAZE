#!/usr/bin/env bash
set -euo pipefail

# The app has no npm dependencies. The builder is a static page served by
# http-server. Put nvm's Node first: /exec-daemon/node can shadow it, and
# `nvm which current` then reports "system", which makes `npm install -g`
# target a root prefix the user cannot write.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -d "$NVM_DIR/versions/node" ]]; then
  node_bin_dir="$(find "$NVM_DIR/versions/node" -mindepth 2 -maxdepth 2 -type d -name bin | sort -V | tail -1)"
  if [[ -n "$node_bin_dir" && -x "$node_bin_dir/node" ]]; then
    export PATH="$node_bin_dir:$PATH"
    hash -r
  fi
fi

npm install --global http-server@14.1.1
