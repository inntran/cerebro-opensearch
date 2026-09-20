import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Alerts } from '../shared/alerts';
import { Session } from '../shared/session';

@Component({
  selector: 'app-connect',
  imports: [FormsModule],
  template: `
    <section class="mx-auto mt-5" style="max-width: 38rem">
      <h1 class="h3 mb-4">Connect to OpenSearch</h1>
      @if (feedback) {
        <div class="alert alert-warning" role="alert">{{ feedback }}</div>
      }
      <form (ngSubmit)="connect()">
        <label class="form-label" for="host">Host URL</label>
        <input
          class="form-control mb-3"
          id="host"
          name="host"
          [(ngModel)]="host"
          required
          placeholder="http://localhost:9200"
          list="known-hosts"
        />
        <datalist id="known-hosts">
          @for (known of hosts; track known) {
            <option [value]="known"></option>
          }
        </datalist>
        @if (unauthorized) {
          <label class="form-label" for="username">Username</label>
          <input
            class="form-control mb-3"
            id="username"
            name="username"
            [(ngModel)]="username"
            autocomplete="username"
          />
          <label class="form-label" for="password">Password</label>
          <input
            class="form-control mb-3"
            id="password"
            name="password"
            type="password"
            [(ngModel)]="password"
            autocomplete="current-password"
          />
        }
        <button class="btn btn-primary" type="submit" [disabled]="busy || !host">
          {{ busy ? 'Connecting…' : 'Connect' }}
        </button>
      </form>
    </section>
  `,
})
export class Connect implements OnInit {
  host = '';
  hosts: string[] = [];
  username = '';
  password = '';
  unauthorized = false;
  busy = false;
  feedback = '';
  constructor(
    private session: Session,
    private router: Router,
    private route: ActivatedRoute,
    private alerts: Alerts,
    private cdr: ChangeDetectorRef,
  ) {}
  async ngOnInit() {
    this.host = this.route.snapshot.queryParamMap.get('host') || this.session.host() || '';
    this.unauthorized = this.route.snapshot.queryParamMap.has('unauthorized');
    try {
      this.hosts = await this.session.get<string[]>('connect/hosts');
    } catch (error) {
      this.alerts.add('error', 'Could not load known hosts', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  async connect() {
    this.busy = true;
    this.feedback = '';
    try {
      const status = await this.session.probe(
        this.host,
        this.unauthorized ? this.username : undefined,
        this.unauthorized ? this.password : undefined,
      );
      if (status === 200) {
        this.session.connect(
          this.host,
          this.unauthorized ? this.username : undefined,
          this.unauthorized ? this.password : undefined,
        );
        await this.router.navigate(['/overview'], { queryParams: { host: this.host } });
      } else if (status === 401) {
        this.unauthorized = true;
        this.feedback = 'Enter cluster credentials';
      } else this.feedback = `Unexpected response: ${status}`;
    } catch (error) {
      this.alerts.add('error', 'Connection failed', error);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
