import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Session } from '../shared/session';
import { Alerts } from '../shared/alerts';

interface Repository {
  name: string;
  type: string;
  settings: Record<string, unknown>;
}

@Component({
  selector: 'app-repositories',
  imports: [FormsModule],
  template: `
    <section class="py-3">
      <h1 class="h3">Snapshot repositories</h1>
      <div class="row g-4">
        <div class="col-lg-5">
          <h2 class="h5">Existing repositories</h2>
          <ul class="list-group">
            @for (item of repositories; track item.name) {
              <li class="list-group-item d-flex justify-content-between align-items-center">
                <span
                  ><strong>{{ item.name }}</strong> <small>{{ item.type }}</small></span
                ><span
                  ><button class="btn btn-outline-primary btn-sm me-1" (click)="edit(item)">
                    Edit</button
                  ><button class="btn btn-outline-danger btn-sm" (click)="remove(item.name)">
                    Delete
                  </button></span
                >
              </li>
            }
          </ul>
        </div>
        <div class="col-lg-7">
          <h2 class="h5">{{ editing ? 'Update' : 'Create' }} repository</h2>
          <form (ngSubmit)="save()">
            <div class="row g-2 mb-2">
              <div class="col-sm-6">
                <label class="form-label"
                  >Name<input class="form-control" name="name" [(ngModel)]="name" required
                /></label>
              </div>
              <div class="col-sm-6">
                <label class="form-label"
                  >Type<select class="form-select" name="type" [(ngModel)]="type">
                    @for (kind of types; track kind) {
                      <option [value]="kind">{{ kind }}</option>
                    }
                  </select></label
                >
              </div>
            </div>
            <div class="row g-2">
              @for (field of fields[type]; track field) {
                <div class="col-sm-6">
                  <label class="form-label"
                    >{{ field }}
                    @if (booleanFields.has(field)) {
                      <input
                        class="form-check-input ms-2"
                        type="checkbox"
                        [name]="field"
                        [(ngModel)]="settings[field]"
                      />
                    } @else {
                      <input class="form-control" [name]="field" [(ngModel)]="settings[field]" />
                    }
                  </label>
                </div>
              }
            </div>
            <button class="btn btn-primary mt-2" type="submit">Save</button
            ><button class="btn btn-outline-secondary ms-2 mt-2" type="button" (click)="reset()">
              New
            </button>
          </form>
        </div>
      </div>
    </section>
  `,
})
export class Repositories implements OnInit {
  readonly types = ['fs', 'url', 's3', 'gcs', 'hdfs', 'azure'];
  readonly booleanFields = new Set([
    'compress',
    'readonly',
    'load_defaults',
    'server_side_encryption',
  ]);
  readonly fields: Record<string, string[]> = {
    fs: [
      'location',
      'chunk_size',
      'compress',
      'max_restore_bytes_per_sec',
      'max_snapshot_bytes_per_sec',
    ],
    url: ['url'],
    s3: [
      'bucket',
      'region',
      'base_path',
      'access_key',
      'secret_key',
      'chunk_size',
      'compress',
      'max_restore_bytes_per_sec',
      'max_snapshot_bytes_per_sec',
      'max_retries',
      'server_side_encryption',
    ],
    gcs: [
      'bucket',
      'client',
      'application_name',
      'base_path',
      'chunk_size',
      'compress',
      'max_restore_bytes_per_sec',
      'max_snapshot_bytes_per_sec',
      'readonly',
    ],
    hdfs: [
      'uri',
      'path',
      'conf_location',
      'load_defaults',
      'chunk_size',
      'compress',
      'concurrent_streams',
    ],
    azure: ['container', 'base_path', 'chunk_size', 'compress', 'concurrent_streams'],
  };
  repositories: Repository[] = [];
  name = '';
  type = 'fs';
  settings: Record<string, any> = {};
  editing = false;
  constructor(
    private session: Session,
    private alerts: Alerts,
    private cdr: ChangeDetectorRef,
  ) {}
  async ngOnInit() {
    await this.load();
  }
  async load() {
    try {
      this.repositories = await this.session.send<Repository[]>('repositories');
    } catch (error) {
      this.alerts.add('error', 'Could not load repositories', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  edit(item: Repository) {
    this.name = item.name;
    this.type = item.type;
    this.settings = { ...item.settings };
    this.editing = true;
  }
  reset() {
    this.name = '';
    this.type = 'fs';
    this.settings = {};
    this.editing = false;
  }
  async save() {
    if (this.editing && !window.confirm(`Update repository ${this.name}?`)) return;
    try {
      await this.session.send('repositories/create', {
        name: this.name,
        type: this.type,
        settings: Object.fromEntries(
          Object.entries(this.settings).filter(([, value]) => value !== '' && value !== undefined),
        ),
      });
      this.alerts.add('success', 'Repository saved');
      await this.load();
    } catch (error) {
      this.alerts.add('error', 'Could not save repository', error);
    }
  }
  async remove(name: string) {
    if (!window.confirm(`Delete repository ${name}?`)) return;
    try {
      await this.session.send('repositories/delete', { name });
      this.alerts.add('success', 'Repository deleted');
      await this.load();
    } catch (error) {
      this.alerts.add('error', 'Could not delete repository', error);
    }
  }
}
