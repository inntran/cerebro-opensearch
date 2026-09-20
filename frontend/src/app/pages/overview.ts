import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { DecimalPipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Alerts } from '../shared/alerts';
import { Refresh } from '../shared/refresh';
import { Session } from '../shared/session';

interface Shard {
  shard: number;
  index: string;
  node?: string;
  state: string;
  primary: boolean;
}
interface Index {
  name: string;
  closed: boolean;
  special: boolean;
  unhealthy: boolean;
  doc_count: number;
  size_in_bytes: number;
  aliases: string[];
  num_shards: number;
  num_replicas: number;
  shards: Record<string, Shard[]>;
}
interface Node {
  id: string;
  name: string;
  host: string;
  current_master: boolean;
  master: boolean;
  data: boolean;
  ingest: boolean;
}
interface OverviewData {
  cluster_name: string;
  status: string;
  number_of_nodes: number;
  active_shards: number;
  unassigned_shards: number;
  relocating_shards: number;
  initializing_shards: number;
  docs_count: number;
  size_in_bytes: number;
  closed_indices: number;
  special_indices: number;
  shard_allocation: boolean;
  indices: Index[];
  nodes: Node[];
}

@Component({
  selector: 'app-overview',
  imports: [FormsModule, DecimalPipe, JsonPipe],
  template: `
    <section class="py-3">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 class="h3 m-0">Overview</h1>
        <button class="btn btn-outline-primary btn-sm" (click)="load()">Refresh</button>
      </div>
      @if (data; as cluster) {
        <div class="row g-2 mb-3">
          <div class="col-md-3">
            <div class="card card-body">
              <strong>{{ cluster.cluster_name }}</strong
              ><span
                [class.text-success]="cluster.status === 'green'"
                [class.text-warning]="cluster.status === 'yellow'"
                [class.text-danger]="cluster.status === 'red'"
                >{{ cluster.status }}</span
              >
            </div>
          </div>
          <div class="col-md-3">
            <div class="card card-body">
              <strong>{{ cluster.number_of_nodes }}</strong> nodes
            </div>
          </div>
          <div class="col-md-3">
            <div class="card card-body">
              <strong>{{ cluster.docs_count | number }}</strong> documents
            </div>
          </div>
          <div class="col-md-3">
            <div class="card card-body">
              <strong>{{ cluster.unassigned_shards }}</strong> unassigned shards
            </div>
          </div>
        </div>
        <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
          <label class="form-check"
            ><input
              class="form-check-input"
              type="checkbox"
              [checked]="cluster.shard_allocation"
              (change)="allocation($event)"
            /><span class="form-check-label">Shard allocation</span></label
          >
          <select
            class="form-select w-auto"
            [(ngModel)]="allocationKind"
            aria-label="Allocation setting"
          >
            <option value="none">None</option>
            <option value="primaries">Primaries</option>
            <option value="new_primaries">New primaries</option>
          </select>
          <span
            >{{ cluster.active_shards }} active · {{ cluster.relocating_shards }} relocating ·
            {{ cluster.initializing_shards }} initializing</span
          >
        </div>
        <div class="row g-3 mb-3">
          <div class="col-md-6">
            <input
              class="form-control"
              placeholder="Filter indices or aliases"
              [(ngModel)]="indexFilter"
              aria-label="Filter indices"
            />
          </div>
          <div class="col-md-6">
            <input
              class="form-control"
              placeholder="Filter nodes"
              [(ngModel)]="nodeFilter"
              aria-label="Filter nodes"
            />
          </div>
        </div>
        <div class="d-flex flex-wrap gap-3 mb-2">
          <label class="form-check"
            ><input class="form-check-input" type="checkbox" [(ngModel)]="showClosed" /> Closed
            indices ({{ cluster.closed_indices }})</label
          >
          <label class="form-check"
            ><input class="form-check-input" type="checkbox" [(ngModel)]="showSpecial" /> Special
            indices ({{ cluster.special_indices }})</label
          >
          <label class="form-check"
            ><input class="form-check-input" type="checkbox" [(ngModel)]="onlyUnhealthy" /> Only
            affected indices</label
          >
          <label class="form-check"
            ><input class="form-check-input" type="checkbox" [(ngModel)]="descending" /> Sort
            descending</label
          >
        </div>
        <div class="d-flex flex-wrap gap-2 mb-3">
          <span class="align-self-center">Selected: {{ selected.size }}</span>
          @for (action of actions; track action.path) {
            <button
              class="btn btn-outline-secondary btn-sm"
              [disabled]="!selected.size"
              (click)="run(action.path, Array.from(selected).join(','), action.label)"
            >
              {{ action.label }}
            </button>
          }
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-striped align-middle">
            <thead>
              <tr>
                <th><span class="visually-hidden">Select</span></th>
                <th>Index</th>
                <th>Aliases</th>
                <th>Shards</th>
                <th>Documents</th>
                <th>Size</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (index of visibleIndices(); track index.name) {
                <tr [class.table-warning]="index.unhealthy" [class.text-muted]="index.closed">
                  <td>
                    <input
                      type="checkbox"
                      [checked]="selected.has(index.name)"
                      (change)="toggle(index.name)"
                      [attr.aria-label]="'Select ' + index.name"
                    />
                  </td>
                  <td>
                    <strong>{{ index.name }}</strong>
                  </td>
                  <td>{{ index.aliases.join(', ') }}</td>
                  <td>{{ index.num_shards }} × {{ index.num_replicas + 1 }}</td>
                  <td>{{ index.doc_count | number }}</td>
                  <td>{{ formatBytes(index.size_in_bytes) }}</td>
                  <td>
                    <div class="d-flex flex-wrap gap-1">
                      <button
                        class="btn btn-outline-secondary btn-sm"
                        (click)="details('commons/get_index_settings', { index: index.name })"
                      >
                        Settings
                      </button>
                      <button
                        class="btn btn-outline-secondary btn-sm"
                        (click)="details('commons/get_index_mapping', { index: index.name })"
                      >
                        Mapping
                      </button>
                      <button
                        class="btn btn-outline-secondary btn-sm"
                        (click)="details('commons/get_index_stats', { index: index.name })"
                      >
                        Stats
                      </button>
                      <button
                        class="btn btn-outline-primary btn-sm"
                        (click)="indexSettings(index.name)"
                      >
                        Edit
                      </button>
                      @for (action of actions; track action.path) {
                        <button
                          class="btn btn-outline-secondary btn-sm"
                          (click)="run(action.path, index.name, action.label)"
                        >
                          {{ action.label }}
                        </button>
                      }
                    </div>
                  </td>
                </tr>
                <tr>
                  <td></td>
                  <td colspan="6">
                    <small
                      >Shards:
                      @for (node of cluster.nodes; track node.id) {
                        @for (shard of index.shards[node.id] || []; track $index) {
                          <button
                            class="badge text-bg-secondary border-0 me-1"
                            [title]="node.name + ': ' + shard.state"
                            (click)="selectShard(shard, node.id)"
                          >
                            {{ shard.shard }}{{ shard.primary ? 'p' : 'r' }} · {{ node.name }}
                          </button>
                        }
                      }
                      @for (shard of index.shards['unassigned'] || []; track $index) {
                        <span class="badge text-bg-danger me-1">{{ shard.shard }} unassigned</span>
                      }
                    </small>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (selectedShard) {
          <div class="card card-body mb-3">
            <strong>Relocate shard {{ selectedShard.shard }} of {{ selectedShard.index }}</strong>
            <div class="d-flex gap-2 flex-wrap mt-2">
              @for (node of cluster.nodes; track node.id) {
                @if (node.id !== selectedShard.node) {
                  <button class="btn btn-outline-primary btn-sm" (click)="relocate(node.id)">
                    To {{ node.name }}
                  </button>
                }
              }
              <button class="btn btn-outline-secondary btn-sm" (click)="selectedShard = undefined">
                Cancel
              </button>
            </div>
          </div>
        }
        <h2 class="h4 mt-4">Nodes</h2>
        <div class="row g-2">
          @for (node of visibleNodes(); track node.id) {
            <div class="col-lg-3 col-md-4">
              <div class="card card-body">
                <strong
                  >{{ node.name }}
                  @if (node.current_master) {
                    ★
                  }</strong
                ><small>{{ node.host }}</small
                ><button
                  class="btn btn-link p-0 text-start"
                  (click)="details('commons/get_node_stats', { node: node.id })"
                >
                  View stats
                </button>
              </div>
            </div>
          }
        </div>
      }
      @if (info !== undefined) {
        <div class="card mt-3">
          <div class="card-header d-flex justify-content-between">
            Details<button
              type="button"
              class="btn-close"
              aria-label="Close"
              (click)="info = undefined"
            ></button>
          </div>
          <pre class="card-body">{{ info | json }}</pre>
        </div>
      }
    </section>
  `,
})
export class Overview {
  readonly Array = Array;
  readonly actions = [
    { path: 'close_indices', label: 'Close' },
    { path: 'open_indices', label: 'Open' },
    { path: 'force_merge', label: 'Force merge' },
    { path: 'refresh_indices', label: 'Refresh' },
    { path: 'flush_indices', label: 'Flush' },
    { path: 'clear_indices_cache', label: 'Clear cache' },
    { path: 'delete_indices', label: 'Delete' },
  ];
  data?: OverviewData;
  info?: unknown;
  selectedShard?: Shard;
  selected = new Set<string>();
  indexFilter = '';
  nodeFilter = '';
  showClosed = false;
  showSpecial = false;
  onlyUnhealthy = false;
  descending = false;
  allocationKind = 'none';
  constructor(
    private session: Session,
    private alerts: Alerts,
    private refresh: Refresh,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    effect(() => {
      this.refresh.tick();
      void this.load();
    });
  }
  async load() {
    try {
      this.data = await this.session.send<OverviewData>('overview');
    } catch (error) {
      this.alerts.add('error', 'Could not load overview', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  visibleIndices() {
    return (this.data?.indices || [])
      .filter(
        (index) =>
          (this.showClosed || !index.closed) &&
          (this.showSpecial || !index.special) &&
          (!this.onlyUnhealthy || index.unhealthy) &&
          (!this.indexFilter ||
            [index.name, ...index.aliases].some((value) =>
              value.toLowerCase().includes(this.indexFilter.toLowerCase()),
            )),
      )
      .sort((a, b) => (this.descending ? -1 : 1) * a.name.localeCompare(b.name));
  }
  visibleNodes() {
    return (this.data?.nodes || []).filter((node) =>
      node.name.toLowerCase().includes(this.nodeFilter.toLowerCase()),
    );
  }
  toggle(name: string) {
    this.selected.has(name) ? this.selected.delete(name) : this.selected.add(name);
  }
  formatBytes(value: number) {
    return value < 1024
      ? `${value} B`
      : `${(value / 1024 ** Math.floor(Math.log(value) / Math.log(1024))).toFixed(1)} ${['B', 'KB', 'MB', 'GB', 'TB'][Math.floor(Math.log(value) / Math.log(1024))]}`;
  }
  async run(path: string, indices: string, label: string) {
    if (!window.confirm(`${label} ${indices}?`)) return;
    try {
      await this.session.send(`overview/${path}`, { indices });
      this.alerts.add('success', `${label} completed`);
      this.selected.clear();
      await this.load();
    } catch (error) {
      this.alerts.add('error', `${label} failed`, error);
    }
  }
  async allocation(event: Event) {
    const enabled = (event.target as HTMLInputElement).checked;
    if (!window.confirm(`${enabled ? 'Enable' : 'Disable'} shard allocation?`)) {
      (event.target as HTMLInputElement).checked = !enabled;
      return;
    }
    try {
      await this.session.send(
        `overview/${enabled ? 'enable' : 'disable'}_shard_allocation`,
        enabled ? {} : { kind: this.allocationKind },
      );
      await this.load();
    } catch (error) {
      this.alerts.add('error', 'Could not change shard allocation', error);
    }
  }
  async details(path: string, data: Record<string, unknown>) {
    try {
      this.info = await this.session.send(path, data);
    } catch (error) {
      this.alerts.add('error', 'Could not load details', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  indexSettings(index: string) {
    this.router.navigate(['/index_settings'], { queryParams: { index } });
  }
  selectShard(shard: Shard, node: string) {
    this.selectedShard = { ...shard, node };
  }
  async relocate(to: string) {
    const shard = this.selectedShard;
    if (!shard || !window.confirm(`Relocate shard ${shard.shard} to ${to}?`)) return;
    try {
      await this.session.send('overview/relocate_shard', {
        shard: shard.shard,
        index: shard.index,
        from: shard.node,
        to,
      });
      this.selectedShard = undefined;
      await this.load();
    } catch (error) {
      this.alerts.add('error', 'Relocation failed', error);
    }
  }
}
