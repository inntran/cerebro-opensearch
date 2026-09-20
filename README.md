# Cerebro OpenSearch

Cerebro OpenSearch is a web administration console for OpenSearch clusters. It keeps the Scala/Play backend and AngularJS frontend of the original Cerebro project while updating the backend, build, and deployment path. This repository starts with a clean history containing the application and its tests; the original project and its author remain credited below.

## What this version improves

- Updates the backend to current Scala/Play build tooling and JDK 25, with CI for backend tests, browser assets, and a disposable OpenSearch container smoke test.
- Adds strict HTTPS verification and optional custom CA or client certificate support for cluster connections.
- Validates cluster URLs to reduce server-side request forgery risk, and keeps bookmarked hosts separate from credentials entered for a connection.
- Creates a persistent session secret and SQLite data directory at startup, and offers optional audit logging for connections and mutations.
- Preserves the cluster, index, node, alias, template, snapshot, and REST console workflows in the existing AngularJS UI.

These are implementation changes, not a claim that every OpenSearch release and feature has been validated. The smoke matrix exercises disposable OpenSearch `latest` and `2` images; exact supported version baselines require further testing. The AngularJS frontend is retained and remains a modernization task.

## Login and connection behavior

Application login is optional and uses the existing basic or LDAP configuration. The connect page also accepts an OpenSearch URL and optional cluster username/password. These cluster credentials are used for that connection; saved host bookmarks contain addresses, not passwords. Application login and OpenSearch credentials are separate.

[go-cerebro](https://github.com/piotrkochan/go-cerebro) is an independent Go/React rewrite with additional authentication and administration features. Its documented quick start configures hosts in YAML and sets `es.allow_ad_hoc_hosts: false`, so the original direct connect-page workflow is disabled in that example. It also introduces separate application auth providers and roles. Those are meaningful login and setup behavior changes for users migrating from this app. Its README describes rough edges, and its published feature list does not establish parity for this app's workflows or our OpenSearch version matrix. We have not benchmarked the two projects or established an OpenSearch defect in go-cerebro.

## Build and run

Requires JDK 25, sbt 1.13, and Node 24 for frontend assets and browser tests.

```bash
npm ci --ignore-scripts
node -e "require('grunt').tasks(['assets'])"
npm test -- --singleRunTests
sbt test stage
mkdir -p data
java -Dpidfile.path=/dev/null -Dhttp.port=9000 -Ddata.path="$PWD/data" \
  -cp "target/universal/stage/lib/*" bootstrap.CerebroApp
```

Open <http://localhost:9000>. See [deployment instructions](docs/deployment.md) for configuration and container use.

## Origin and license

This work derives from [Cerebro by Leonardo Menezes](https://github.com/lmenezes/cerebro). Leonardo Menezes is credited in the retained [MIT license](LICENSE). The original project's contributors created the application and workflows on which this version builds. This repository is an independent continuation and is not an official OpenSearch project.
