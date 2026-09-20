import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { chromium } from 'playwright-core';

const assets = resolve('../public/angular');
const calls = [];
const index = {
  name: 'test',
  closed: false,
  special: false,
  unhealthy: false,
  doc_count: 5,
  size_in_bytes: 1024,
  aliases: [],
  num_shards: 1,
  num_replicas: 0,
  shards: { node1: [{ shard: 0, index: 'test', node: 'node1', state: 'STARTED', primary: true }] },
};
const node = {
  id: 'node1',
  name: 'node-one',
  host: 'localhost',
  current_master: true,
  master: true,
  data: true,
  ingest: true,
  coordinating: true,
  cpu: { load: 0, process: 0, os: 0 },
  heap: { percent: 10, used: 100, max: 1000 },
  disk: { percent: 10, available: 100, total: 1000 },
  uptime: 1000,
  attributes: {},
  version: '3.0',
};
const responses = {
  '/connect/hosts': ['http://localhost:9200'],
  '/connect': {},
  '/navbar': { cluster_name: 'Smoke cluster', status: 'green' },
  '/overview': {
    cluster_name: 'Smoke cluster',
    status: 'green',
    number_of_nodes: 1,
    active_shards: 1,
    unassigned_shards: 0,
    relocating_shards: 0,
    initializing_shards: 0,
    docs_count: 5,
    size_in_bytes: 1024,
    closed_indices: 0,
    special_indices: 0,
    shard_allocation: true,
    indices: [index],
    nodes: [node],
  },
  '/nodes': [node],
  '/cat': [{ name: 'test', docs: 5 }],
  '/analysis/indices': ['test'],
  '/analysis/analyzers': ['standard'],
  '/analysis/fields': ['message'],
  '/analysis/analyze/analyzer': [{ token: 'hello' }],
  '/analysis/analyze/field': [{ token: 'hello' }],
  '/templates': [{ name: 'test-template', template: { template: 'test-*' } }],
  '/repositories': [{ name: 'repo', type: 'fs', settings: { location: '/tmp/snapshots' } }],
  '/snapshots': { repositories: ['repo'], indices: [{ name: 'test', special: false }] },
  '/snapshots/load': [
    { snapshot: 'snap', start_time: '2026-01-01T00:00:00Z', state: 'SUCCESS', indices: ['test'] },
  ],
  '/aliases/get_aliases': [{ alias: 'alias', index: 'test' }],
  '/cluster_settings': {
    defaults: { 'cluster.routing.allocation.enable': 'all' },
    persistent: {},
    transient: {},
  },
  '/commons/indices': ['test'],
  '/rest/history': [],
  '/rest': { indices: ['test'], host: 'http://localhost:9200' },
  '/rest/request': { acknowledged: true },
  '/create_index/get_index_metadata': { settings: {}, mappings: {} },
  '/analysis/analyze/field': [{ token: 'hello' }],
};

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname in responses || request.method === 'POST') {
    let body = '';
    for await (const chunk of request) body += chunk;
    calls.push({ path: pathname, data: body ? JSON.parse(body) : {} });
    const payload = JSON.stringify({
      status: 200,
      body:
        pathname === '/index_settings'
          ? { test: { defaults: {}, settings: { 'index.number_of_replicas': '1' } } }
          : (responses[pathname] ?? { acknowledged: true }),
    });
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(payload);
    return;
  }
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (name.includes('..')) {
    response.writeHead(400).end();
    return;
  }
  try {
    const data = await readFile(join(assets, name));
    const type =
      {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.woff2': 'font/woff2',
      }[extname(name)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type }).end(data);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.setDefaultTimeout(5000);
page.on('dialog', (dialog) => dialog.accept());
const base = `http://127.0.0.1:${port}/`;
const route = (name) =>
  `${base}#/${name}${name.includes('?') ? '&' : '?'}host=http%3A%2F%2Flocalhost%3A9200`;
const visit = async (path, heading) => {
  await page.goto(route(path));
  await page.getByRole('heading', { name: heading, exact: true }).waitFor();
};
const called = (path) => calls.some((call) => call.path === path);

try {
  await visit('connect', 'Connect to OpenSearch');
  await page.locator('#host').fill('http://localhost:9200');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByRole('heading', { name: 'Overview' }).waitFor();
  assert.ok(called('/connect'));

  for (const [path, heading] of Object.entries({
    nodes: 'Nodes',
    rest: 'REST API',
    aliases: 'Aliases',
    create: 'Create index',
    analysis: 'Analyze text',
    templates: 'Index templates',
    cluster_settings: 'Cluster settings',
    index_settings: 'Index settings',
    snapshot: 'Snapshots',
    repository: 'Snapshot repositories',
    cat: 'CAT APIs',
  })) {
    await visit(path + (path === 'index_settings' ? '?index=test' : ''), heading);
    assert.equal(await page.locator('app-root').count(), 1, `${path} should render`);
  }

  await visit('overview', 'Overview');
  assert.equal(await page.locator('.overview-matrix thead th').count(), 2);
  assert.equal(await page.locator('.overview-matrix tbody tr').count(), 1);
  assert.equal(await page.locator('.overview-matrix tbody .overview-shard-started').count(), 1);
  assert.match(await page.locator('.overview-matrix tbody th').first().innerText(), /node-one/);
  await page.getByRole('checkbox', { name: 'Select test' }).check();
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
  assert.ok(called('/overview/delete_indices'));

  await visit('rest', 'REST API');
  await page.locator('input[name=path]').fill('/_cluster/health');
  await page.getByRole('button', { name: 'Send' }).click();
  assert.ok(called('/rest/request'));

  await visit('templates', 'Index templates');
  await page.locator('input[name=name]').fill('new-template');
  await page.locator('textarea[name=body]').fill('{"template":"new-*"}');
  await page.getByRole('button', { name: 'Create' }).click();
  assert.ok(called('/templates/create'));

  await visit('aliases', 'Aliases');
  await page.locator('input[name=alias]').fill('new-alias');
  await page.locator('select[name=index]').selectOption('test');
  await page.getByRole('button', { name: 'Queue alias' }).click();
  await page.getByRole('button', { name: /Apply changes/ }).click();
  assert.ok(called('/aliases/update_aliases'));

  await visit('snapshot', 'Snapshots');
  await page.locator('select[name=newRepository]').selectOption('repo');
  await page.locator('input[name=newName]').fill('new-snapshot');
  await page.getByRole('button', { name: 'Create snapshot' }).click();
  assert.ok(called('/snapshots/create'));

  await visit('cluster_settings', 'Cluster settings');
  await page.locator('app-settings table tbody input').first().fill('none');
  await page.getByRole('button', { name: /Save 1 changes/ }).click();
  assert.ok(called('/cluster_settings/save'));
  console.log('Angular route and mutation smoke checks passed');
} finally {
  await browser.close();
  server.close();
}
