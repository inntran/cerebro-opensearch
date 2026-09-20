# cerebro-opensearch — multi-stage image (host arch only)
#
# Frontend: docker.io/library/node:24-alpine (build stage only)
# Backend:  docker.io/sbtscala/scala-sbt:eclipse-temurin-25_1.x
# Runtime:  registry.access.redhat.com/hi/openjdk:latest-runtime (no shell)

ARG NODE_BUILDER_IMAGE=docker.io/library/node:24-alpine
ARG BUILDER_IMAGE=docker.io/sbtscala/scala-sbt:eclipse-temurin-25_1.x
ARG RUNTIME_IMAGE=registry.access.redhat.com/hi/openjdk:latest-runtime

# ── Angular frontend ──────────────────────────────────────────────────────────
FROM ${NODE_BUILDER_IMAGE} AS frontend

USER node
WORKDIR /home/node/build

COPY --chown=node:node frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --no-audit --no-fund

COPY --chown=node:node frontend/ ./frontend/
RUN cd frontend && npm run build

# ── JVM application stage ────────────────────────────────────────────────────
FROM ${BUILDER_IMAGE} AS builder

USER sbtuser
WORKDIR /home/sbtuser/src

COPY --chown=sbtuser:sbtuser . ./

COPY --from=frontend --chown=sbtuser:sbtuser /home/node/build/public/angular ./public/angular

RUN sbt stage

USER root
RUN mkdir -p /out/app /out/data \
    && cp -a /home/sbtuser/src/target/universal/stage/. /out/app/

# ── runtime (no shell) ───────────────────────────────────────────────────────
FROM ${RUNTIME_IMAGE}

COPY --from=builder --chown=65532:65532 /out/app /app
COPY --from=builder --chown=65532:65532 /out/data /data

ENV CEREBRO_DATA=/data \
    CEREBRO_PORT=9000

USER 65532
EXPOSE 9000
VOLUME ["/data"]
WORKDIR /app

ENTRYPOINT ["java", "-Dpidfile.path=/dev/null", "-Dhttp.port=9000", "-cp", "/app/lib/*", "bootstrap.CerebroApp"]
