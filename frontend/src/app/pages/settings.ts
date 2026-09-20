import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Session } from '../shared/session';
import { Alerts } from '../shared/alerts';
import { CLUSTER_DYNAMIC, INDEX_DYNAMIC } from './settings-allowlists';

interface ClusterSettings {
  defaults: Record<string, string>;
  persistent: Record<string, string>;
  transient: Record<string, string>;
}
interface IndexSettings {
  [index: string]: { defaults: Record<string, string>; settings: Record<string, string> };
}

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  template: `
    <section class="py-3">
      <h1 class="h3">{{ kind === 'cluster' ? 'Cluster settings' : 'Index settings' }}</h1>
      @if (kind === 'index') {
        <label class="form-label"
          >Index<input
            class="form-control"
            [(ngModel)]="index"
            (change)="load()"
            placeholder="Index name"
        /></label>
      }
      <div class="d-flex flex-wrap gap-3 align-items-center my-3">
        <input
          class="form-control w-auto"
          [(ngModel)]="filter"
          placeholder="Filter settings"
          aria-label="Filter settings"
        /><label class="form-check"
          ><input class="form-check-input" type="checkbox" [(ngModel)]="showStatic" /> Show
          read-only settings</label
        ><button class="btn btn-primary" [disabled]="!pendingCount()" (click)="save()">
          Save {{ pendingCount() }} changes
        </button>
      </div>
      <div class="table-responsive">
        <table class="table table-sm table-striped align-middle">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Value</th>
              <th>Scope</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (name of visible(); track name) {
              <tr>
                <td>
                  <code>{{ name }}</code>
                  @if (!isDynamic(name)) {
                    <span class="badge text-bg-secondary">read only</span>
                  }
                </td>
                <td>
                  <input
                    class="form-control form-control-sm"
                    [name]="name"
                    [(ngModel)]="values[name]"
                    [readonly]="!isDynamic(name)"
                    (ngModelChange)="mark(name)"
                  />
                </td>
                <td>
                  @if (kind === 'cluster' && changes[name]) {
                    <select
                      class="form-select form-select-sm"
                      [(ngModel)]="changes[name].scope"
                      [name]="name + '-scope'"
                    >
                      <option value="transient">Transient</option>
                      <option value="persistent">Persistent</option>
                    </select>
                  }
                </td>
                <td>
                  @if (changes[name]) {
                    <button class="btn btn-link btn-sm" (click)="revert(name)">Revert</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class Settings implements OnInit {
  kind: 'cluster' | 'index';
  index = '';
  filter = '';
  showStatic = false;
  original: Record<string, string> = {};
  values: Record<string, string> = {};
  changes: Record<string, { value: string; scope: 'transient' | 'persistent' }> = {};
  constructor(
    private route: ActivatedRoute,
    private session: Session,
    private alerts: Alerts,
    private cdr: ChangeDetectorRef,
  ) {
    this.kind = route.snapshot.data['kind'] === 'index' ? 'index' : 'cluster';
    this.index = route.snapshot.queryParamMap.get('index') || '';
  }
  async ngOnInit() {
    await this.load();
  }
  isDynamic(name: string) {
    return (this.kind === 'cluster' ? CLUSTER_DYNAMIC : INDEX_DYNAMIC).has(name);
  }
  visible() {
    return Object.keys(this.values)
      .filter((name) => name.includes(this.filter) && (this.showStatic || this.isDynamic(name)))
      .sort();
  }
  pendingCount() {
    return Object.keys(this.changes).length;
  }
  mark(name: string) {
    if (this.values[name] === this.original[name]) delete this.changes[name];
    else
      this.changes[name] = {
        value: this.values[name],
        scope: this.changes[name]?.scope || 'transient',
      };
  }
  revert(name: string) {
    this.values[name] = this.original[name];
    delete this.changes[name];
  }
  async load() {
    if (this.kind === 'index' && !this.index) return;
    try {
      let values: Record<string, string>;
      if (this.kind === 'cluster') {
        const data = await this.session.send<ClusterSettings>('cluster_settings');
        values = { ...data.defaults, ...data.persistent, ...data.transient };
      } else {
        const data = await this.session.send<IndexSettings>('index_settings', {
          index: this.index,
        });
        values = { ...data[this.index].defaults, ...data[this.index].settings };
        for (const name of Object.keys(values))
          if (
            [
              'index.creation_date',
              'index.provided_name',
              'index.uuid',
              'index.version.created',
            ].some((invalid) => name.includes(invalid))
          )
            delete values[name];
      }
      this.original = values;
      this.values = { ...values };
      this.changes = {};
    } catch (error) {
      this.alerts.add('error', 'Could not load settings', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  async save() {
    try {
      if (this.kind === 'cluster') {
        const settings = {
          transient: {} as Record<string, string | null>,
          persistent: {} as Record<string, string | null>,
        };
        for (const [name, change] of Object.entries(this.changes))
          settings[change.scope][name] = change.value || null;
        await this.session.send('cluster_settings/save', { settings });
      } else {
        await this.session.send('index_settings/update', {
          index: this.index,
          settings: Object.fromEntries(
            Object.entries(this.changes).map(([name, change]) => [name, change.value]),
          ),
        });
      }
      this.alerts.add('success', 'Settings saved');
      await this.load();
    } catch (error) {
      this.alerts.add('error', 'Could not save settings', error);
    }
  }
}
