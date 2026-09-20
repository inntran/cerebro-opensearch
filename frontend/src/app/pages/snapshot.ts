import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Session } from '../shared/session';
import { Alerts } from '../shared/alerts';

interface SnapshotItem {
  snapshot: string;
  start_time: string;
  state: string;
  indices: string[];
}
interface IndexItem {
  name: string;
  special: boolean;
}
interface SnapshotInitial {
  repositories: string[];
  indices: IndexItem[];
}

@Component({
  selector: 'app-snapshot',
  imports: [FormsModule, DatePipe],
  template: `
    <section class="py-3">
      <h1 class="h3">Snapshots</h1>
      <div class="row g-4">
        <div class="col-lg-6">
          <h2 class="h5">Existing snapshots</h2>
          <label class="form-label d-block"
            >Repository<select
              class="form-select"
              [(ngModel)]="repository"
              (change)="loadSnapshots()"
            >
              <option value="">Choose repository</option>
              @for (item of repositories; track item) {
                <option [value]="item">{{ item }}</option>
              }
            </select></label
          >
          <ul class="list-group">
            @for (item of snapshots; track item.snapshot) {
              <li class="list-group-item">
                <div class="d-flex justify-content-between">
                  <span
                    ><strong>{{ item.snapshot }}</strong> · {{ item.state }}<br /><small>{{
                      item.start_time | date: 'medium'
                    }}</small></span
                  >
                  <div>
                    <button
                      class="btn btn-outline-primary btn-sm me-1"
                      (click)="restoreItem = item"
                    >
                      Restore</button
                    ><button class="btn btn-outline-danger btn-sm" (click)="remove(item.snapshot)">
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            }
          </ul>
        </div>
        <div class="col-lg-6">
          <h2 class="h5">Create snapshot</h2>
          <form (ngSubmit)="create()">
            <label class="form-label d-block"
              >Repository<select
                class="form-select"
                name="newRepository"
                [(ngModel)]="newRepository"
                required
              >
                <option value="">Choose repository</option>
                @for (item of repositories; track item) {
                  <option [value]="item">{{ item }}</option>
                }
              </select></label
            >
            <label class="form-label d-block"
              >Name<input class="form-control" name="newName" [(ngModel)]="newName" required
            /></label>
            <label class="form-check"
              ><input
                class="form-check-input"
                type="checkbox"
                name="ignoreUnavailable"
                [(ngModel)]="ignoreUnavailable"
              />
              Ignore unavailable indices</label
            >
            <label class="form-check"
              ><input
                class="form-check-input"
                type="checkbox"
                name="includeGlobalState"
                [(ngModel)]="includeGlobalState"
              />
              Include global state</label
            >
            <label class="form-check mt-2"
              ><input
                class="form-check-input"
                type="checkbox"
                name="showSpecial"
                [(ngModel)]="showSpecial"
              />
              Show special indices</label
            >
            <label class="form-label d-block mt-2"
              >Indices (none means all)<select
                class="form-select"
                name="selectedIndices"
                [(ngModel)]="selectedIndices"
                multiple
                size="9"
              >
                @for (index of visibleIndices(); track index.name) {
                  <option [value]="index.name">{{ index.name }}</option>
                }
              </select></label
            >
            <button class="btn btn-primary" type="submit">Create snapshot</button>
          </form>
        </div>
      </div>
      @if (restoreItem) {
        <div class="card card-body mt-3">
          <div class="d-flex justify-content-between">
            <h2 class="h5">Restore {{ restoreItem.snapshot }}</h2>
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              (click)="restoreItem = undefined"
            ></button>
          </div>
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label"
                >Rename pattern<input
                  class="form-control"
                  [(ngModel)]="renamePattern"
                  placeholder="index_(.+)"
              /></label>
            </div>
            <div class="col-md-6">
              <label class="form-label"
                >Rename replacement<input
                  class="form-control"
                  [(ngModel)]="renameReplacement"
                  placeholder="restored_index_$1"
              /></label>
            </div>
          </div>
          <div class="d-flex gap-3 my-2">
            <label class="form-check"
              ><input class="form-check-input" type="checkbox" [(ngModel)]="restoreAliases" />
              Include aliases</label
            ><label class="form-check"
              ><input class="form-check-input" type="checkbox" [(ngModel)]="restoreGlobalState" />
              Include global state</label
            ><label class="form-check"
              ><input
                class="form-check-input"
                type="checkbox"
                [(ngModel)]="restoreIgnoreUnavailable"
              />
              Ignore unavailable</label
            >
          </div>
          <label class="form-label"
            >Indices (none means all)<select
              class="form-select"
              [(ngModel)]="restoreIndices"
              multiple
              size="6"
            >
              @for (name of restoreItem.indices; track name) {
                <option [value]="name">{{ name }}</option>
              }
            </select></label
          >
          <button class="btn btn-warning mt-2" type="button" (click)="restore()">Restore</button>
        </div>
      }
    </section>
  `,
})
export class Snapshot implements OnInit {
  repositories: string[] = [];
  indices: IndexItem[] = [];
  repository = '';
  snapshots: SnapshotItem[] = [];
  newRepository = '';
  newName = '';
  ignoreUnavailable = false;
  includeGlobalState = true;
  showSpecial = false;
  selectedIndices: string[] = [];
  restoreItem?: SnapshotItem;
  renamePattern = '';
  renameReplacement = '';
  restoreAliases = true;
  restoreGlobalState = true;
  restoreIgnoreUnavailable = true;
  restoreIndices: string[] = [];
  constructor(
    private session: Session,
    private alerts: Alerts,
    private cdr: ChangeDetectorRef,
  ) {}
  async ngOnInit() {
    try {
      const data = await this.session.send<SnapshotInitial>('snapshots');
      this.repositories = data.repositories;
      this.indices = data.indices;
    } catch (error) {
      this.alerts.add('error', 'Could not load repositories', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  visibleIndices() {
    return this.indices.filter((index) => this.showSpecial || !index.special);
  }
  async loadSnapshots() {
    if (!this.repository) {
      this.snapshots = [];
      return;
    }
    try {
      this.snapshots = await this.session.send<SnapshotItem[]>('snapshots/load', {
        repository: this.repository,
      });
    } catch (error) {
      this.alerts.add('error', 'Could not load snapshots', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  async create() {
    try {
      await this.session.send('snapshots/create', {
        repository: this.newRepository,
        snapshot: this.newName,
        ignoreUnavailable: this.ignoreUnavailable,
        includeGlobalState: this.includeGlobalState,
        indices: this.selectedIndices,
      });
      this.alerts.add('success', 'Snapshot created');
      if (this.repository === this.newRepository) await this.loadSnapshots();
    } catch (error) {
      this.alerts.add('error', 'Could not create snapshot', error);
    }
  }
  async remove(snapshot: string) {
    if (!window.confirm(`Delete snapshot ${snapshot}?`)) return;
    try {
      await this.session.send('snapshots/delete', { repository: this.repository, snapshot });
      this.alerts.add('success', 'Snapshot deleted');
      await this.loadSnapshots();
    } catch (error) {
      this.alerts.add('error', 'Could not delete snapshot', error);
    }
  }
  async restore() {
    if (!this.restoreItem || !window.confirm(`Restore snapshot ${this.restoreItem.snapshot}?`))
      return;
    try {
      await this.session.send('snapshots/restore', {
        repository: this.repository,
        snapshot: this.restoreItem.snapshot,
        renamePattern: this.renamePattern,
        renameReplacement: this.renameReplacement,
        ignoreUnavailable: this.restoreIgnoreUnavailable,
        includeAliases: this.restoreAliases,
        includeGlobalState: this.restoreGlobalState,
        indices: this.restoreIndices,
      });
      this.alerts.add('success', 'Snapshot restore started');
      this.restoreItem = undefined;
    } catch (error) {
      this.alerts.add('error', 'Could not restore snapshot', error);
    }
  }
}
