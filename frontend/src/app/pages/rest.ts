import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { Session } from '../shared/session';
import { Alerts } from '../shared/alerts';

@Component({
  selector: 'app-rest',
  imports: [FormsModule, JsonPipe],
  template: `
    <section class="container-fluid py-3">
      <h1 class="h3">REST API</h1>
      <form (ngSubmit)="execute()">
        <div class="input-group mb-3">
          <select
            class="form-select flex-grow-0 w-auto"
            name="method"
            [(ngModel)]="method"
            aria-label="HTTP method"
          >
            @for (value of methods; track value) {
              <option>{{ value }}</option>
            }
          </select>
          <input
            class="form-control"
            name="path"
            [(ngModel)]="path"
            placeholder="/_cluster/health"
            aria-label="API path"
            list="rest-options"
            required
          />
          <datalist id="rest-options">
            @for (index of indices; track index) {
              <option [value]="'/' + index"></option>
            }
          </datalist>
          <button class="btn btn-primary" type="submit" [disabled]="busy">Send</button>
          <button class="btn btn-outline-secondary" type="button" (click)="copyCurl()">
            Copy cURL
          </button>
        </div>
        <label class="form-label" for="request-body">Request body</label>
        <textarea
          id="request-body"
          class="form-control font-monospace"
          name="body"
          [(ngModel)]="body"
          rows="8"
        ></textarea>
      </form>
      @if (result !== undefined) {
        <h2 class="h5 mt-4">Response</h2>
        <pre class="border rounded p-3 bg-white">{{ result | json }}</pre>
      }
      @if (history.length) {
        <h2 class="h5 mt-4">History</h2>
        <ul class="list-group">
          @for (item of history; track $index) {
            <li class="list-group-item">
              <button class="btn btn-link p-0" type="button" (click)="load(item)">
                {{ item.method }} {{ item.path }}
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class Rest implements OnInit {
  readonly methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'];
  method = 'GET';
  path = '/';
  body = '';
  busy = false;
  result: unknown;
  history: { method: string; path: string; body?: string }[] = [];
  indices: string[] = [];
  constructor(
    private session: Session,
    private alerts: Alerts,
    private cdr: ChangeDetectorRef,
  ) {}
  async ngOnInit() {
    await this.loadHistory();
    try {
      this.indices = (await this.session.send<{ indices: string[] }>('rest')).indices;
    } catch (error) {
      this.alerts.add('error', 'Could not load index suggestions', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  async loadHistory() {
    try {
      this.history = await this.session.send<typeof this.history>('rest/history');
    } catch (error) {
      this.alerts.add('error', 'Could not load request history', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  load(item: { method: string; path: string; body?: string }) {
    this.method = item.method;
    this.path = item.path;
    this.body = item.body || '';
  }
  async execute() {
    this.busy = true;
    try {
      let data: unknown = this.body;
      try {
        data = JSON.parse(this.body || '{}');
      } catch {
        /* NDJSON and plain text are valid request bodies. */
      }
      this.result = await this.session.send('rest/request', {
        method: this.method,
        path: this.path,
        data,
      });
      await this.loadHistory();
    } catch (error) {
      this.result = error;
      this.alerts.add('error', 'REST request failed', error);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  async copyCurl() {
    const path = this.path.startsWith('/') ? this.path : `/${this.path}`;
    const contentType =
      path.endsWith('_bulk') || path.endsWith('_msearch')
        ? 'application/x-ndjson'
        : 'application/json';
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
    const command =
      `curl -H 'Content-type: ${contentType}' -X${this.method} ${quote((this.session.host() || '') + path)}` +
      (['POST', 'PUT'].includes(this.method) ? ` -d ${quote(this.body)}` : '');
    try {
      await navigator.clipboard.writeText(command);
      this.alerts.add('info', 'cURL command copied');
    } catch (error) {
      this.alerts.add('error', 'Could not copy cURL command', error);
    }
  }
}
