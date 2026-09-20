import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Session } from '../shared/session';
import { Alerts } from '../shared/alerts';

@Component({
  selector: 'app-cat',
  imports: [FormsModule],
  template: `
    <section class="py-3">
      <h1 class="h3">CAT APIs</h1>
      <div class="input-group mb-3" style="max-width: 32rem">
        <select class="form-select" [(ngModel)]="api" aria-label="CAT API">
          @for (item of apis; track item) {
            <option [value]="item">{{ item }}</option>
          }</select
        ><button class="btn btn-primary" (click)="load()">Run</button>
      </div>
      @if (rows.length) {
        <div class="table-responsive">
          <table class="table table-striped table-sm">
            <thead>
              <tr>
                @for (column of columns; track column) {
                  <th>
                    <button class="btn btn-link p-0" (click)="sort(column)">
                      {{ column }}
                      @if (sortColumn === column) {
                        {{ ascending ? '▲' : '▼' }}
                      }
                    </button>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of visible(); track $index) {
                <tr>
                  @for (column of columns; track column) {
                    <td>{{ row[column] }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @if (loaded && !rows.length) {
        <p>No results.</p>
      }
    </section>
  `,
})
export class Cat {
  readonly apis = [
    'aliases',
    'allocation',
    'count',
    'fielddata',
    'health',
    'indices',
    'master',
    'nodeattrs',
    'nodes',
    'pending tasks',
    'plugins',
    'recovery',
    'repositories',
    'thread pool',
    'shards',
    'segments',
  ];
  api = 'indices';
  rows: Record<string, unknown>[] = [];
  columns: string[] = [];
  loaded = false;
  sortColumn = '';
  ascending = true;
  constructor(
    private session: Session,
    private alerts: Alerts,
    private cdr: ChangeDetectorRef,
  ) {}
  async load() {
    try {
      this.rows = await this.session.send<Record<string, unknown>[]>('cat', {
        api: this.api.replaceAll(' ', '_'),
      });
      this.columns = Object.keys(this.rows[0] || {});
      this.loaded = true;
    } catch (error) {
      this.alerts.add('error', 'CAT request failed', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  sort(column: string) {
    this.ascending = this.sortColumn === column ? !this.ascending : true;
    this.sortColumn = column;
  }
  visible() {
    return [...this.rows].sort((a, b) =>
      this.sortColumn
        ? (this.ascending ? 1 : -1) *
          String(a[this.sortColumn]).localeCompare(String(b[this.sortColumn]), undefined, {
            numeric: true,
          })
        : 0,
    );
  }
}
