import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Refresh } from './refresh';

interface ApiResponse<T> {
  status: number;
  body: T;
  error?: unknown;
}

@Injectable({ providedIn: 'root' })
export class Session {
  readonly host = signal<string | null>(
    new URLSearchParams(window.location.hash.split('?')[1] || '').get('host') ||
      sessionStorage.getItem('cerebro.host'),
  );
  readonly username = signal<string | null>(null);
  private password?: string;
  constructor(
    private http: HttpClient,
    private router: Router,
    private refresh: Refresh,
  ) {}
  connect(host: string, username?: string, password?: string) {
    this.host.set(host);
    sessionStorage.setItem('cerebro.host', host);
    this.username.set(username || null);
    this.password = password;
    this.refresh.now();
  }
  disconnect() {
    this.host.set(null);
    sessionStorage.removeItem('cerebro.host');
    this.username.set(null);
    this.password = undefined;
    this.router.navigate(['/connect']);
  }
  async get<T>(path: string): Promise<T> {
    return this.unwrap(await firstValueFrom(this.http.get<ApiResponse<T>>('/' + path)));
  }
  async probe(host: string, username?: string, password?: string): Promise<number> {
    const data = await firstValueFrom(
      this.http.post<ApiResponse<unknown>>('/connect', { host, username, password }),
    );
    return data.status;
  }
  async send<T>(path: string, data: Record<string, unknown> = {}): Promise<T> {
    const host = this.host();
    if (!host) throw new Error('Choose a cluster first');
    const response = await firstValueFrom(
      this.http.post<ApiResponse<T>>('/' + path, {
        ...data,
        host,
        username: this.username(),
        password: this.password,
      }),
    );
    return this.unwrap(response);
  }
  private unwrap<T>(response: ApiResponse<T>): T {
    if (response.status === 303) window.location.href = '/login';
    if (response.status === 401) {
      this.router.navigate(['/connect'], {
        queryParams: { host: this.host(), unauthorized: true },
      });
      throw new Error('Cluster authorization required');
    }
    if (response.status < 200 || response.status >= 300)
      throw response.body || response.error || new Error(`HTTP ${response.status}`);
    return response.body;
  }
}
