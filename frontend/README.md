# Angular frontend

This is the supported Angular frontend for Cerebro OpenSearch. It uses Bootstrap 5 CSS and Angular components for interactive behavior. The Play backend remains the API and serves the production app at `/`.

The [frontend migration record](../docs/frontend-migration.md) lists what changed, known differences from the earlier UI, and small follow-up steps.

From the repository root:

```bash
npm --prefix frontend ci
npm run lint
npm test
npm run smoke
```

`npm run build` writes the production bundle to `public/angular`, which Play includes in its assets JAR. Build it before `sbt stage` when packaging outside the container. The browser smoke suite uses a local mock API and a system Chrome installation; set `CHROME_BIN` if Chrome is elsewhere.

For local development, start Play on port 9000 and run `npm --prefix frontend start`. The Angular dev server proxies API requests to Play.
