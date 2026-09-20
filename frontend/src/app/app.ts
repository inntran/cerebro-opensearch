import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { JsonPipe, NgIf } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Alerts } from './shared/alerts';
import { Refresh } from './shared/refresh';
import { Session } from './shared/session';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIf, JsonPipe],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  menuOpen = false;
  clusterName = '';
  clusterStatus = '';
  appUsername = '';
  readonly intervals = [5000, 10000, 15000, 30000, 60000];
  readonly links = [
    { path: '/overview', label: 'Overview' },
    { path: '/nodes', label: 'Nodes' },
    { path: '/rest', label: 'REST' },
    { path: '/create', label: 'Create index' },
    { path: '/cluster_settings', label: 'Cluster settings' },
    { path: '/aliases', label: 'Aliases' },
    { path: '/analysis', label: 'Analysis' },
    { path: '/templates', label: 'Index templates' },
    { path: '/repository', label: 'Repositories' },
    { path: '/snapshot', label: 'Snapshots' },
    { path: '/cat', label: 'CAT APIs' },
  ];
  constructor(
    public session: Session,
    public alerts: Alerts,
    public refresh: Refresh,
    private cdr: ChangeDetectorRef,
  ) {
    effect(() => {
      this.session.host();
      this.refresh.tick();
      void this.loadNavbar();
    });
  }
  async loadNavbar() {
    if (!this.session.host()) {
      this.clusterName = '';
      this.clusterStatus = '';
      this.appUsername = '';
      return;
    }
    try {
      const data = await this.session.send<{
        cluster_name: string;
        status: string;
        username?: string;
      }>('navbar');
      this.clusterName = data.cluster_name;
      this.clusterStatus = data.status;
      this.appUsername = data.username || '';
      document.title = this.clusterName
        ? `${this.clusterName} [${this.clusterStatus}] - Cerebro`
        : 'Cerebro';
    } catch (error) {
      this.alerts.add('error', 'Could not load cluster status', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  setInterval(event: Event) {
    this.refresh.setInterval(Number((event.target as HTMLSelectElement).value));
  }
}
