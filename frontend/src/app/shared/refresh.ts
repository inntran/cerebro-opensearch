import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Refresh {
  readonly interval = signal(15000);
  readonly tick = signal(0);
  private timer?: number;
  constructor() {
    this.schedule();
  }
  setInterval(milliseconds: number) {
    this.interval.set(milliseconds);
    this.now();
    window.clearTimeout(this.timer);
    this.schedule();
  }
  now() {
    this.tick.update((value) => value + 1);
  }
  private schedule() {
    this.timer = window.setTimeout(() => {
      this.now();
      this.schedule();
    }, this.interval());
  }
}
