import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Session } from '../shared/session';
import { Alerts } from '../shared/alerts';
import { Refresh } from '../shared/refresh';

@Component({
  selector: 'app-create-index',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="py-3">
      <h1 class="h3">Create index</h1>
      <form (ngSubmit)="create()">
        <div class="row g-3">
          <div class="col-lg-5">
            <label class="form-label d-block"
              >Name<input class="form-control" name="name" [(ngModel)]="name" required
            /></label>
            <label class="form-label d-block"
              >Number of shards<input
                class="form-control"
                name="shards"
                [(ngModel)]="shards"
                type="number"
                min="1"
            /></label>
            <label class="form-label d-block"
              >Number of replicas<input
                class="form-control"
                name="replicas"
                [(ngModel)]="replicas"
                type="number"
                min="0"
            /></label>
            <label class="form-label d-block"
              >Copy settings from<select
                class="form-select"
                name="source"
                [(ngModel)]="source"
                (change)="loadMetadata()"
              >
                <option value="">Choose index</option>
                @for (index of indices; track index) {
                  <option [value]="index">{{ index }}</option>
                }
              </select></label
            >
          </div>
          <div class="col-lg-7">
            <label class="form-label d-block"
              >Settings JSON<textarea
                class="form-control font-monospace"
                name="body"
                [(ngModel)]="body"
                rows="16"
              ></textarea>
            </label>
          </div>
        </div>
        <div class="mt-3">
          <a class="btn btn-outline-secondary me-2" routerLink="/overview">Back</a
          ><button class="btn btn-primary" type="submit">Create</button>
        </div>
      </form>
    </section>
  `,
})
export class CreateIndex implements OnInit {
  indices: string[] = [];
  name = '';
  shards?: number;
  replicas?: number;
  source = '';
  body = '{}';
  constructor(
    private session: Session,
    private alerts: Alerts,
    private refresh: Refresh,
    private cdr: ChangeDetectorRef,
  ) {}
  async ngOnInit() {
    try {
      this.indices = await this.session.send<string[]>('commons/indices');
    } catch (error) {
      this.alerts.add('error', 'Could not load indices', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  async loadMetadata() {
    if (!this.source) return;
    try {
      const data = await this.session.send<{ settings: unknown; mappings: unknown }>(
        'create_index/get_index_metadata',
        { index: this.source },
      );
      this.body = JSON.stringify({ settings: data.settings, mappings: data.mappings }, null, 2);
    } catch (error) {
      this.alerts.add('error', 'Could not load index metadata', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  async create() {
    try {
      let metadata = JSON.parse(this.body || '{}') as Record<string, unknown>;
      if (!Object.keys(metadata).length)
        metadata = {
          settings: {
            index: {
              ...(this.shards !== undefined ? { number_of_shards: this.shards } : {}),
              ...(this.replicas !== undefined ? { number_of_replicas: this.replicas } : {}),
            },
          },
        };
      await this.session.send('create_index/create', { index: this.name.trim(), metadata });
      this.alerts.add('success', 'Index created');
      this.refresh.now();
    } catch (error) {
      this.alerts.add('error', 'Could not create index', error);
    }
  }
}
