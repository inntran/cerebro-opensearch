#!/usr/bin/env bash
# Smoke: health + connect/overview/REST against a disposable OpenSearch via Cerebro.
#
# Env:
#   CEREBRO_URL      - Cerebro base URL reachable from this host (default http://localhost:9000)
#   OPENSEARCH_URL   - Cluster URL Cerebro will call (must resolve from inside the Cerebro process/container)
#   OPENSEARCH_CHECK - Optional URL to probe OpenSearch from this host (default OPENSEARCH_URL)
#   OPENSEARCH_USER / OPENSEARCH_PASSWORD - optional basic auth
set -euo pipefail

OS_URL="${OPENSEARCH_URL:-http://localhost:9200}"
OS_CHECK="${OPENSEARCH_CHECK:-$OS_URL}"
CEREBRO_URL="${CEREBRO_URL:-http://localhost:9000}"
USER="${OPENSEARCH_USER:-}"
PASS="${OPENSEARCH_PASSWORD:-}"

echo "Checking OpenSearch at $OS_CHECK ..."
curl -sf "$OS_CHECK" | head -c 200
echo

echo "Checking Cerebro health at $CEREBRO_URL/health ..."
curl -sf "$CEREBRO_URL/health"
echo

BODY="{\"host\":\"$OS_URL\""
if [[ -n "$USER" ]]; then
  BODY="$BODY,\"username\":\"$USER\",\"password\":\"$PASS\""
fi
BODY="$BODY}"

echo "Connecting via Cerebro to $OS_URL ..."
RESP=$(curl -sf -X POST "$CEREBRO_URL/connect" \
  -H 'Content-Type: application/json' \
  -d "$BODY")
echo "$RESP" | head -c 400
echo

echo "Overview ..."
curl -sf -X POST "$CEREBRO_URL/overview" \
  -H 'Content-Type: application/json' \
  -d "$BODY" | head -c 400
echo

echo "REST _cluster/health ..."
curl -sf -X POST "$CEREBRO_URL/rest/request" \
  -H 'Content-Type: application/json' \
  -d "${BODY%\}},\"method\":\"GET\",\"path\":\"_cluster/health\",\"body\":\"\"}" | head -c 400
echo
echo "Smoke OK"
