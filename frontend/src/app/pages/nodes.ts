import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { DecimalPipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Session } from '../shared/session';
import { Alerts } from '../shared/alerts';
import { Refresh } from '../shared/refresh';

interface Node {
  name: string;
  host: string;
  master: boolean;
  current_master: boolean;
  data: boolean;
  ingest: boolean;
  coordinating: boolean;
  cpu: { load: number; process: number; os: number };
  heap: { percent: number; used: number; max: number };
  disk?: { percent: number; available: number; total: number };
  uptime: number;
  attributes: Record<string, string>;
  jvm?: string;
  version: string;
}

@Component({
  selector: 'app-nodes',
  imports: [FormsModule, DecimalPipe, KeyValuePipe],
  template: `
    <section class="py-3">
      <h1 class="h3">Nodes</h1>
      <div class="row g-2 align-items-center mb-3">
        <div class="col-md-4">
          <input
            class="form-control"
            placeholder="Filter nodes"
            [(ngModel)]="filter"
            aria-label="Filter nodes"
          />
        </div>
        <div class="col-md-8 d-flex flex-wrap gap-3">
          @for (role of roles; track role) {
            <label class="form-check"
              ><input
                class="form-check-input"
                type="checkbox"
                [checked]="enabled.has(role)"
                (change)="toggle(role)"
              />
              {{ role }}</label
            >
          }
        </div>
      </div>
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead>
            <tr>
              @for (column of columns; track column.key) {
                <th>
                  <button type="button" class="btn btn-link p-0" (click)="sort(column.key)">
                    {{ column.label }}
                    @if (sortKey === column.key) {
                      {{ descending ? '▼' : '▲' }}
                    }
                  </button>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (node of visible(); track node.name) {
              <tr>
                <td>
                  <strong
                    >{{ node.name }}
                    @if (node.current_master) {
                      ★
                    }
                  </strong>
                  <div>
                    <small>{{ node.host }}</small>
                  </div>
                  <div>
                    @for (attribute of node.attributes | keyvalue; track attribute.key) {
                      <span class="badge text-bg-secondary me-1" [title]="attribute.key">{{
                        attribute.value
                      }}</span>
                    }
                  </div>
                  <small>JVM {{ node.jvm }} · OpenSearch {{ node.version }}</small>
                </td>
                <td>{{ node.cpu.load | number: '1.2-2' }}</td>
                <td>{{ node.cpu.process }}%</td>
                <td>{{ node.heap.percent }}%</td>
                <td>{{ node.disk?.percent ?? '—' }}%</td>
                <td>{{ node.uptime | number }} ms</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class Nodes {
  nodes: Node[] = [];
  filter = '';
  readonly roles = ['master', 'data', 'ingest', 'coordinating'];
  readonly enabled = new Set(this.roles);
  readonly columns = [
    { key: 'name', label: 'Name' },
    { key: 'cpu.load', label: 'Load' },
    { key: 'cpu.process', label: 'CPU' },
    { key: 'heap.percent', label: 'Heap' },
    { key: 'disk.percent', label: 'Disk' },
    { key: 'uptime', label: 'Uptime' },
  ];
  sortKey = 'name';
  descending = false;
  constructor(
    private session: Session,
    private alerts: Alerts,
    private refresh: Refresh,
    private cdr: ChangeDetectorRef,
  ) {
    effect(() => {
      this.refresh.tick();
      void this.load();
    });
  }
  async load() {
    try {
      this.nodes = await this.session.send<Node[]>('nodes');
    } catch (error) {
      this.alerts.add('error', 'Could not load nodes', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  toggle(role: string) {
    this.enabled.has(role) ? this.enabled.delete(role) : this.enabled.add(role);
  }
  sort(key: string) {
    this.descending = this.sortKey === key ? !this.descending : false;
    this.sortKey = key;
  }
  private value(node: Node, key: string): string | number {
    return key
      .split('.')
      .reduce<unknown>((value, part) => (value as Record<string, unknown>)?.[part], node) as
      string | number;
  }
  visible() {
    return this.nodes
      .filter(
        (node) =>
          node.name.toLowerCase().includes(this.filter.toLowerCase()) &&
          this.roles.some(
            (role) =>
              this.enabled.has(role) && Boolean((node as unknown as Record<string, unknown>)[role]),
          ),
      )
      .sort(
        (a, b) =>
          (this.descending ? -1 : 1) *
          (typeof this.value(a, this.sortKey) === 'number'
            ? Number(this.value(a, this.sortKey)) - Number(this.value(b, this.sortKey))
            : String(this.value(a, this.sortKey)).localeCompare(
                String(this.value(b, this.sortKey)),
              )),
      );
  }
}
