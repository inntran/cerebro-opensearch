# Frontend migration record

This records the work on branch `angular22-bootstrap5` so later changes can be small and reviewable. The migration is **not** a claim of visual or feature parity with the AngularJS frontend. In particular, the overview still needs work.

## Changes made

| Area | Current implementation | Earlier implementation |
| --- | --- | --- |
| Framework | Angular 22 app in `frontend/` | AngularJS app in `src/app/` |
| Styling | Bootstrap 5 CSS and Font Awesome 7 | Bootstrap 3 styles and older Font Awesome |
| Entry point | Play's `app/views/Index.scala.html` loads the Angular bundle from `public/angular` | Play loaded the AngularJS assets |
| Routes | 13 routes in `frontend/src/app/app.routes.ts` | Routes and templates under `src/app/` and `public/` |
| Shared state | `Session`, `Refresh`, and `Alerts` services in `frontend/src/app/shared/` | AngularJS services and controllers |
| Build | `npm --prefix frontend run build` writes to `public/angular`; `Containerfile` builds the frontend before packaging Play | Root npm/Grunt asset build |
| Checks | Prettier lint, session unit tests, browser smoke test with a mock API, backend tests, and container build | Earlier frontend test setup |

The Angular app includes connect, overview, nodes, REST, aliases, create index, analysis, templates, cluster settings, index settings, snapshots, repositories, and CAT pages. This means those routes render and have basic interactions; it does **not** establish that every older interaction or layout was preserved. The previous AngularJS source and templates remain in the repository for comparison, but the served app does not load them.

The later overview change (`ca677ca`) put indices in columns and nodes in rows, with an unassigned row. Shard borders reflect state: green started, blue initializing, purple relocating/relocated, yellow recovering, and gray unassigned. Replica borders are dashed. It kept the new page's filters, selection, index actions, and relocation controls. The smoke test checks only a one-index, one-node, started-shard example; it does not prove the matrix behaves well with a real cluster or many columns.

## Known differences to address

The current overview is still different from `public/overview.html` and `src/app/components/overview/controller.js`:

- The old view paginates index columns and fits a page to available width. The current view shows all matching indices in a horizontally scrolling table.
- The old node cells include roles, attributes, heap, disk, CPU, and load. The current matrix shows only name, host, and master status.
- The old index and shard controls use compact menus. The current page uses an Actions disclosure in each index header and a separate relocation panel.
- The old shard menu includes shard statistics and shows valid target nodes in matrix cells. The current page selects a shard by clicking it and lists target nodes below the matrix; it does not show shard statistics there or mark valid targets in the grid.
- The REST page uses a textarea in place of the older Ace editor. Other pages were rewritten and have not been compared interaction by interaction against their legacy templates.
- The browser smoke test uses a mock API and a small fixture. It is a route and basic mutation check, not a visual regression or full feature test.

## Small follow-up steps

1. Agree on one representative overview screenshot or cluster fixture as the visual target. Capture the same state in the old and new UI, including several indices, nodes, replicas, and an unassigned shard.
2. Restore index pagination and column sizing in the overview. Verify narrow and wide screens before changing controls.
3. Restore node information and resource indicators in matrix rows. Check their values against the API response and old view.
4. Restore compact index and shard menus, shard stats, and in-grid relocation targets. Verify primary/replica and closed-index behavior.
5. Compare the remaining routes one at a time against the legacy UI, adding a focused test or fixture for each behavior actually restored.

Keep each step in a separate change when practical. The old templates are reference material, not a specification that every implementation detail must be copied.

## How to verify a frontend change

From the repository root:

```bash
npm --prefix frontend ci --ignore-scripts
npm run lint
npm test
npm run smoke
```

`npm run smoke` needs a system Chrome (`CHROME_BIN` can override its path) and permission to bind a local loopback port. For a meaningful overview comparison, also run the app against a disposable OpenSearch cluster with multiple nodes and inspect the page in a browser. The existing smoke fixture cannot cover that layout.

The relevant files are `frontend/src/app/pages/overview.ts`, `frontend/src/styles.css`, `frontend/scripts/smoke.mjs`, and the legacy `public/overview.html` and `src/app/css/app.css`.
