import { Routes } from '@angular/router';
import { Connect } from './pages/connect';
import { Rest } from './pages/rest';
import { Overview } from './pages/overview';
import { Nodes } from './pages/nodes';
import { Cat } from './pages/cat';
import { Analysis } from './pages/analysis';
import { Templates } from './pages/templates';
import { Repositories } from './pages/repositories';
import { CreateIndex } from './pages/create-index';
import { Aliases } from './pages/aliases';
import { Settings } from './pages/settings';
import { Snapshot } from './pages/snapshot';

export const routes: Routes = [
  { path: 'connect', component: Connect },
  { path: 'rest', component: Rest },
  { path: 'overview', component: Overview },
  { path: 'nodes', component: Nodes },
  { path: 'cat', component: Cat },
  { path: 'analysis', component: Analysis },
  { path: 'templates', component: Templates },
  { path: 'repository', component: Repositories },
  { path: 'create', component: CreateIndex },
  { path: 'aliases', component: Aliases },
  { path: 'cluster_settings', component: Settings, data: { kind: 'cluster' } },
  { path: 'index_settings', component: Settings, data: { kind: 'index' } },
  { path: 'snapshot', component: Snapshot },
  { path: '', pathMatch: 'full', redirectTo: 'connect' },
];
