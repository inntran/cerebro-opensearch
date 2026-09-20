import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { Session } from '../shared/session';
import { Alerts } from '../shared/alerts';

@Component({
  selector: 'app-analysis',
  imports: [FormsModule, JsonPipe],
  template: `
    <section class="py-3">
      <h1 class="h3">Analyze text</h1>
      <div class="row g-3">
        <div class="col-md-6">
          <div class="card card-body">
            <h2 class="h5">By analyzer</h2>
            <label class="form-label"
              >Index<select
                class="form-select"
                [(ngModel)]="analyzerIndex"
                (change)="loadAnalyzers()"
              >
                <option value="">Choose index</option>
                @for (index of indices; track index) {
                  <option [value]="index">{{ index }}</option>
                }
              </select></label
            >
            <label class="form-label"
              >Analyzer<select class="form-select" [(ngModel)]="analyzer">
                <option value="">Choose analyzer</option>
                @for (item of analyzers; track item) {
                  <option [value]="item">{{ item }}</option>
                }
              </select></label
            >
            <textarea
              class="form-control mb-2"
              [(ngModel)]="analyzerText"
              rows="5"
              aria-label="Text to analyze"
            ></textarea>
            <button
              class="btn btn-primary"
              (click)="analyze('analyzer')"
              [disabled]="!analyzer || !analyzerText"
            >
              Analyze
            </button>
            @if (analyzerResult) {
              <pre class="mt-3">{{ analyzerResult | json }}</pre>
            }
          </div>
        </div>
        <div class="col-md-6">
          <div class="card card-body">
            <h2 class="h5">By field</h2>
            <label class="form-label"
              >Index<select class="form-select" [(ngModel)]="fieldIndex" (change)="loadFields()">
                <option value="">Choose index</option>
                @for (index of indices; track index) {
                  <option [value]="index">{{ index }}</option>
                }
              </select></label
            >
            <label class="form-label"
              >Field<select class="form-select" [(ngModel)]="field">
                <option value="">Choose field</option>
                @for (item of fields; track item) {
                  <option [value]="item">{{ item }}</option>
                }
              </select></label
            >
            <textarea
              class="form-control mb-2"
              [(ngModel)]="fieldText"
              rows="5"
              aria-label="Text to analyze"
            ></textarea>
            <button
              class="btn btn-primary"
              (click)="analyze('field')"
              [disabled]="!field || !fieldText"
            >
              Analyze
            </button>
            @if (fieldResult) {
              <pre class="mt-3">{{ fieldResult | json }}</pre>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class Analysis implements OnInit {
  indices: string[] = [];
  analyzers: string[] = [];
  fields: string[] = [];
  analyzerIndex = '';
  fieldIndex = '';
  analyzer = '';
  field = '';
  analyzerText = '';
  fieldText = '';
  analyzerResult?: unknown;
  fieldResult?: unknown;
  constructor(
    private session: Session,
    private alerts: Alerts,
    private cdr: ChangeDetectorRef,
  ) {}
  async ngOnInit() {
    try {
      this.indices = await this.session.send<string[]>('analysis/indices');
    } catch (error) {
      this.alerts.add('error', 'Could not load indices', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  async loadAnalyzers() {
    try {
      this.analyzers = await this.session.send<string[]>('analysis/analyzers', {
        index: this.analyzerIndex,
      });
    } catch (error) {
      this.alerts.add('error', 'Could not load analyzers', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  async loadFields() {
    try {
      this.fields = await this.session.send<string[]>('analysis/fields', {
        index: this.fieldIndex,
      });
    } catch (error) {
      this.alerts.add('error', 'Could not load fields', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  async analyze(kind: 'field' | 'analyzer') {
    try {
      const data =
        kind === 'field'
          ? { index: this.fieldIndex, field: this.field, text: this.fieldText }
          : { index: this.analyzerIndex, analyzer: this.analyzer, text: this.analyzerText };
      const response = await this.session.send(`analysis/analyze/${kind}`, data);
      if (kind === 'field') this.fieldResult = response;
      else this.analyzerResult = response;
    } catch (error) {
      this.alerts.add('error', 'Analysis failed', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
}
