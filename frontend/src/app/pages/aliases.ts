import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { Session } from '../shared/session';
import { Alerts } from '../shared/alerts';
import { Refresh } from '../shared/refresh';

interface Alias {
  alias: string;
  index: string;
  filter?: unknown;
  index_routing?: string;
  search_routing?: string;
}
interface Change {
  add?: Alias;
  remove?: { alias: string; index: string };
}

@Component({
  selector: 'app-aliases',
  imports: [FormsModule, JsonPipe],
  template: `
    <section class="py-3">
      <h1 class="h3">Aliases</h1>
      <div class="row g-4">
        <div class="col-lg-6">
          <h2 class="h5">Current aliases</h2>
          <div class="row g-2 mb-2">
            <div class="col">
              <input
                class="form-control"
                [(ngModel)]="aliasFilter"
                placeholder="Filter alias"
                aria-label="Filter alias"
              />
            </div>
            <div class="col">
              <input
                class="form-control"
                [(ngModel)]="indexFilter"
                placeholder="Filter index"
                aria-label="Filter index"
              />
            </div>
          </div>
          <ul class="list-group">
            @for (item of visible(); track $index) {
              <li class="list-group-item d-flex justify-content-between">
                <span
                  ><strong>{{ item.alias }}</strong> → {{ item.index }}
                  @if (item.filter) {
                    <pre>{{ item.filter | json }}</pre>
                  }</span
                ><button
                  class="btn btn-outline-danger btn-sm align-self-start"
                  (click)="remove(item)"
                >
                  Remove
                </button>
              </li>
            }
          </ul>
        </div>
        <div class="col-lg-6">
          <h2 class="h5">Pending changes</h2>
          <ul class="list-group mb-3">
            @for (change of changes; track $index) {
              <li class="list-group-item d-flex justify-content-between">
                {{ change.add ? 'Add' : 'Remove' }} {{ (change.add || change.remove)?.alias }}
                <button class="btn btn-link" (click)="changes.splice($index, 1)">Undo</button>
              </li>
            }
          </ul>
          <button class="btn btn-primary mb-4" [disabled]="!changes.length" (click)="save()">
            Apply changes
          </button>
          <h2 class="h5">Add alias</h2>
          <form (ngSubmit)="add()">
            <label class="form-label d-block"
              >Alias<input class="form-control" name="alias" [(ngModel)]="newAlias.alias" required
            /></label>
            <label class="form-label d-block"
              >Index<select class="form-select" name="index" [(ngModel)]="newAlias.index" required>
                <option value="">Choose index</option>
                @for (index of indices; track index) {
                  <option [value]="index">{{ index }}</option>
                }
              </select></label
            >
            <div class="row g-2">
              <div class="col">
                <label class="form-label"
                  >Index routing<input
                    class="form-control"
                    name="indexRouting"
                    [(ngModel)]="newAlias.index_routing"
                /></label>
              </div>
              <div class="col">
                <label class="form-label"
                  >Search routing<input
                    class="form-control"
                    name="searchRouting"
                    [(ngModel)]="newAlias.search_routing"
                /></label>
              </div>
            </div>
            <label class="form-label d-block"
              >Filter JSON<textarea
                class="form-control font-monospace"
                name="filter"
                [(ngModel)]="filterJson"
                rows="5"
              ></textarea></label
            ><button class="btn btn-outline-primary" type="submit">Queue alias</button>
          </form>
        </div>
      </div>
    </section>
  `,
})
export class Aliases implements OnInit {
  aliases: Alias[] = [];
  indices: string[] = [];
  changes: Change[] = [];
  aliasFilter = '';
  indexFilter = '';
  filterJson = '{}';
  newAlias: Alias = { alias: '', index: '' };
  constructor(
    private session: Session,
    private alerts: Alerts,
    private refresh: Refresh,
    private cdr: ChangeDetectorRef,
  ) {}
  async ngOnInit() {
    await Promise.all([this.load(), this.loadIndices()]);
  }
  async load() {
    try {
      this.aliases = await this.session.send<Alias[]>('aliases/get_aliases');
    } catch (error) {
      this.alerts.add('error', 'Could not load aliases', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  async loadIndices() {
    try {
      this.indices = await this.session.send<string[]>('commons/indices');
    } catch (error) {
      this.alerts.add('error', 'Could not load indices', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  visible() {
    return this.aliases.filter(
      (item) =>
        item.alias.toLowerCase().includes(this.aliasFilter.toLowerCase()) &&
        item.index.toLowerCase().includes(this.indexFilter.toLowerCase()),
    );
  }
  add() {
    try {
      this.changes.push({
        add: {
          ...this.newAlias,
          alias: this.newAlias.alias.toLowerCase(),
          index: this.newAlias.index.toLowerCase(),
          filter: JSON.parse(this.filterJson || '{}'),
        },
      });
      this.newAlias = { alias: '', index: '' };
      this.filterJson = '{}';
    } catch (error) {
      this.alerts.add('error', 'Invalid alias filter JSON', error);
    }
  }
  remove(alias: Alias) {
    this.changes.push({ remove: { alias: alias.alias, index: alias.index } });
  }
  async save() {
    if (!window.confirm(`Apply ${this.changes.length} alias changes?`)) return;
    try {
      await this.session.send('aliases/update_aliases', { changes: this.changes });
      this.changes = [];
      this.alerts.add('success', 'Aliases updated');
      this.refresh.now();
      await this.load();
    } catch (error) {
      this.alerts.add('error', 'Could not update aliases', error);
    }
  }
}
