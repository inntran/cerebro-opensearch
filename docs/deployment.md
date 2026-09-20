# Running cerebro-opensearch

## Quick start (local)

```bash
# Frontend assets
npm ci --ignore-scripts
node -e "require('grunt').tasks(['assets'])"

# Backend (requires JDK 25+ with javac, sbt 1.13+)
export JAVA_HOME=...   # JDK, not JRE-only
sbt stage
mkdir -p ./data
java -Dpidfile.path=/dev/null -Dhttp.port=9000 -Ddata.path=$PWD/data \
  -cp "target/universal/stage/lib/*" bootstrap.CerebroApp
```

Open http://localhost:9000 — connect with an OpenSearch URL and optional username/password. The retained AngularJS UI does not expose the newer mTLS or strict-CA controls. API clients can submit those options directly; HTTPS verification remains strict by default.

## Disposable OpenSearch

```bash
podman compose up -d opensearch   # or docker compose
# wait until http://localhost:9200 responds
./scripts/smoke-opensearch.sh
```

## Configuration

| Variable / setting | Purpose |
|---|---|
| `CEREBRO_DATA` / `data.path` | Writable directory for SQLite history, `http.secret`, `audit.log` |
| `CEREBRO_SECRET` / `PLAY_HTTP_SECRET_KEY` | Session signing; auto-generated under data dir if unset |
| `CEREBRO_PORT` / `http.port` | Listen port (default 9000) |
| `CEREBRO_AUDIT` / `audit.enabled` | `true` to log connect + mutations (credentials redacted) |
| `CEREBRO_BLOCK_PRIVATE_NETWORKS` | `true` to block RFC1918/link-local/metadata for ad-hoc URLs |
| `hosts` in `application.conf` | Bookmark **addresses** only |

### Bookmarks example

```hocon
hosts = [
  { host = "https://opensearch.example:9200", name = "prod-os" }
]
```

Do not put passwords in bookmarks; enter credentials on the connect form.

### Auditing

When enabled, append-only JSON lines are written to `$CEREBRO_DATA/audit.log` for `connect`, `connect_denied`, and mutation API paths.

## Container

Build for the host architecture only (no QEMU). The frontend uses a small, build-only Node image, the JVM builder uses the official sbt image, and the runtime remains Red Hat hardened:

- Frontend builder: [`docker.io/library/node:24-alpine`](https://hub.docker.com/_/node/tags?name=24-alpine&page=1) (static assets only; about 59 MB compressed on amd64 at the time of selection)
- JVM builder: `docker.io/sbtscala/scala-sbt:eclipse-temurin-25_1.x` (JDK 25 + sbt 1.x; project pins sbt 1.13.0)
- Runtime: `registry.access.redhat.com/hi/openjdk:latest-runtime` (JRE only, no shell)

```bash
podman build -t ghcr.io/inntran/cerebro-opensearch:local -f Containerfile .
podman run --rm -p 9000:9000 -v cerebro-data:/data \
  -e CEREBRO_AUDIT=true \
  ghcr.io/inntran/cerebro-opensearch:local
```

Entrypoint is exec-form `java … bootstrap.CerebroApp` (no shell launcher as PID 1). The runtime image has no shell/package manager. Record resolved digests for release pins; `latest-*` tags float.

GHCR publish uses the Podman and Buildah [listed on the Ubuntu 26.04 GitHub runner](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2604-Readme.md) for a single host-arch image. The JVM builder uses the [official sbt Docker image](https://github.com/sbt/docker-sbt) with its rolling JDK 25 / sbt 1.x tag: see [`.github/workflows/container.yml`](../.github/workflows/container.yml).

### Local buildah / podman

GitHub Actions use the Ubuntu 26.04 runner's built-in Podman and Buildah. Locally, either CLI can build the image:

```bash
# Prefer buildah when installed
buildah bud -t localhost/cerebro-opensearch:local -f Containerfile .
# or
podman build -t localhost/cerebro-opensearch:local -f Containerfile .

podman network create cerebro-smoke 2>/dev/null || true
podman run -d --name os --network cerebro-smoke -p 9200:9200 \
  -e discovery.type=single-node -e DISABLE_SECURITY_PLUGIN=true \
  public.ecr.aws/opensearchproject/opensearch:latest
podman run -d --name cerebro --network cerebro-smoke -p 9000:9000 \
  -e CEREBRO_AUDIT=true -v cerebro-data:/data \
  localhost/cerebro-opensearch:local

CEREBRO_URL=http://127.0.0.1:9000 \
  OPENSEARCH_CHECK=http://127.0.0.1:9200 \
  OPENSEARCH_URL=http://os:9200 \
  ./scripts/smoke-opensearch.sh

# Both current and 2.x (ECR only):
CEREBRO_IMAGE=localhost/cerebro-opensearch:local ./scripts/smoke-opensearch-matrix.sh
```

Always use `public.ecr.aws/opensearchproject/opensearch` tags (`:latest` and `:2`), not Docker Hub.

## Compatibility

This repository targets OpenSearch. The disposable smoke matrix uses the latest and 2.x image tags; exact version support remains to be verified. Cluster authentication supports HTTP basic and optional mTLS client certificates.
