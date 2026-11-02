#!/usr/bin/env bash
# Plan morning-digest § 3/§ 4: save one rig page as a single self-contained HTML file.
# Usage: scripts/save-preview.sh <path> <out-file>   (LANE_MARKER from the environment; unset = "no marker set")
set -euo pipefail
path="${1:-/digest/2026-10-28}"
out="${2:-_site/index.html}"
port="${PORT:-8787}"
mkdir -p "$(dirname "$out")"
PORT="$port" npx tsx src/server.ts >/dev/null 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do
  curl -fsS "http://localhost:$port/health" >/dev/null 2>&1 && break
  sleep 0.2
done
curl -fsS "http://localhost:$port$path" -o "$out"
# No client JS and nothing loaded from elsewhere (ADR 0001).
if grep -qiE '<script|<link |src="http' "$out"; then echo "preview is not self-contained" >&2; exit 1; fi
echo "saved $path -> $out ($(wc -c <"$out") bytes)"
