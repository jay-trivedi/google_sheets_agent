#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

push_with_config() {
  local suffix="$1"
  local config=".clasp.${suffix}.json"

  if [[ ! -f "${config}" ]]; then
    echo "Missing ${config}. Aborting." >&2
    exit 1
  fi

  cp "${config}" .clasp.json
  echo "Pushing using ${config}..."
  npx clasp push
}

push_with_config "primary"
push_with_config "secondary"
