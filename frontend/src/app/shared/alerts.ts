import { Injectable, signal } from '@angular/core';

export type AlertKind = 'error' | 'success' | 'info';
export interface AlertItem {
  id: number;
  kind: AlertKind;
  message: string;
  detail?: unknown;
}

@Injectable({ providedIn: 'root' })
export class Alerts {
  readonly items = signal<AlertItem[]>([]);
  private nextId = 0;
  add(kind: AlertKind, message: string, detail?: unknown) {
    const id = ++this.nextId;
    this.items.update((items) => [{ id, kind, message, detail }, ...items].slice(0, 3));
    window.setTimeout(() => this.remove(id), kind === 'error' ? 7500 : 2500);
  }
  remove(id: number) {
    this.items.update((items) => items.filter((item) => item.id !== id));
  }
}
