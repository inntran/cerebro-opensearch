#!/usr/bin/env bash
# Run Cerebro smoke against current OpenSearch (latest) and the 2.x line.
# Requires a running Cerebro (CEREBRO_URL) and pulls disposable OS containers.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK="${CEREBRO_SMOKE_NETWORK:-cerebro-smoke-matrix}"
CEREBRO_URL="${CEREBRO_URL:-http://127.0.0.1:9000}"
CEREBRO_IMAGE="${CEREBRO_IMAGE:-}"

cleanup() {
  podman rm -f os-latest os-2x cerebro-matrix 2>/dev/null || true
  # leave network for reuse unless empty
}
trap cleanup EXIT

podman network create "$NETWORK" 2>/dev/null || true
cleanup

start_os() {
  local name="$1" image="$2" host_port="$3"
  echo "=== Starting $name ($image) on host port $host_port ==="
  podman run -d --name "$name" --network "$NETWORK" -p "${host_port}:9200" \
    -e discovery.type=single-node \
    -e DISABLE_SECURITY_PLUGIN=true \
    -e OPENSEARCH_JAVA_OPTS='-Xms512m -Xmx512m' \
    "$image"
  for i in $(seq 1 45); do
    if curl -sf "http://127.0.0.1:${host_port}" >/dev/null; then
      echo "$name ready"
      curl -sf "http://127.0.0.1:${host_port}" | head -c 160
      echo
      return 0
    fi
    sleep 2
  done
  echo "ERROR: $name did not become ready" >&2
  podman logs "$name" 2>&1 | tail -40 >&2
  exit 1
}

ensure_cerebro() {
  if curl -sf "${CEREBRO_URL}/health" >/dev/null 2>&1; then
    echo "Using existing Cerebro at $CEREBRO_URL"
    return 0
  fi
  if [[ -z "$CEREBRO_IMAGE" ]]; then
    echo "ERROR: Cerebro not reachable at $CEREBRO_URL and CEREBRO_IMAGE not set" >&2
    echo "Start Cerebro first, or set CEREBRO_IMAGE=localhost/cerebro-opensearch:buildah" >&2
    exit 1
  fi
  echo "Starting Cerebro from $CEREBRO_IMAGE"
  podman run -d --name cerebro-matrix --network "$NETWORK" -p 9000:9000 \
    -e CEREBRO_DATA=/data -e CEREBRO_AUDIT=true \
    -v cerebro-matrix-data:/data \
    "$CEREBRO_IMAGE"
  for i in $(seq 1 30); do
    curl -sf "${CEREBRO_URL}/health" >/dev/null && break
    sleep 1
  done
  curl -sf "${CEREBRO_URL}/health"
  echo
}

start_os os-latest public.ecr.aws/opensearchproject/opensearch:latest 9200
start_os os-2x public.ecr.aws/opensearchproject/opensearch:2 9201
ensure_cerebro

echo
echo "=== Smoke: OpenSearch latest ==="
CEREBRO_URL="$CEREBRO_URL" \
  OPENSEARCH_CHECK=http://127.0.0.1:9200 \
  OPENSEARCH_URL=http://os-latest:9200 \
  bash "$ROOT/scripts/smoke-opensearch.sh"

echo
echo "=== Smoke: OpenSearch 2.x ==="
CEREBRO_URL="$CEREBRO_URL" \
  OPENSEARCH_CHECK=http://127.0.0.1:9201 \
  OPENSEARCH_URL=http://os-2x:9200 \
  bash "$ROOT/scripts/smoke-opensearch.sh"

echo
echo "Matrix smoke OK (latest + 2.x)"
