import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Session } from '../shared/session';
import { Alerts } from '../shared/alerts';

interface Template {
  name: string;
  template: Record<string, unknown>;
}

@Component({
  selector: 'app-templates',
  imports: [FormsModule],
  template: `
    <section class="py-3">
      <h1 class="h3">Index templates</h1>
      <div class="row g-4">
        <div class="col-lg-5">
          <input
            class="form-control mb-2"
            placeholder="Filter templates"
            [(ngModel)]="filter"
            aria-label="Filter templates"
          />
          <ul class="list-group">
            @for (item of visible(); track item.name) {
              <li class="list-group-item d-flex justify-content-between align-items-center">
                <button type="button" class="btn btn-link p-0" (click)="edit(item)">
                  {{ item.name }}</button
                ><button class="btn btn-outline-danger btn-sm" (click)="remove(item.name)">
                  Delete
                </button>
              </li>
            }
          </ul>
        </div>
        <div class="col-lg-7">
          <form (ngSubmit)="save()">
            <label class="form-label"
              >Template name<input
                class="form-control"
                name="name"
                [(ngModel)]="name"
                required /></label
            ><label class="form-label d-block"
              >Template JSON<textarea
                class="form-control font-monospace"
                name="body"
                [(ngModel)]="body"
                rows="18"
                required
              ></textarea></label
            ><button class="btn btn-primary" type="submit">
              {{ editing ? 'Update' : 'Create' }}</button
            ><button class="btn btn-outline-secondary ms-2" type="button" (click)="reset()">
              New
            </button>
          </form>
        </div>
      </div>
    </section>
  `,
})
export class Templates implements OnInit {
  templates: Template[] = [];
  filter = '';
  name = '';
  body = '{\n  "template": "*",\n  "settings": {},\n  "mappings": {},\n  "aliases": {}\n}';
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
      this.templates = await this.session.send<Template[]>('templates');
    } catch (error) {
      this.alerts.add('error', 'Could not load templates', error);
    } finally {
      this.cdr.markForCheck();
    }
  }
  visible() {
    return this.templates.filter((item) =>
      item.name.toLowerCase().includes(this.filter.toLowerCase()),
    );
  }
  edit(item: Template) {
    this.name = item.name;
    this.body = JSON.stringify(item.template, null, 2);
    this.editing = true;
  }
  reset() {
    this.name = '';
    this.body = '{}';
    this.editing = false;
  }
  async save() {
    try {
      await this.session.send('templates/create', {
        name: this.name,
        template: JSON.parse(this.body),
      });
      this.alerts.add('success', 'Template saved');
      await this.load();
      this.editing = true;
    } catch (error) {
      this.alerts.add('error', 'Could not save template', error);
    }
  }
  async remove(name: string) {
    if (!window.confirm(`Delete template ${name}?`)) return;
    try {
      await this.session.send('templates/delete', { name });
      this.alerts.add('success', 'Template deleted');
      await this.load();
    } catch (error) {
      this.alerts.add('error', 'Could not delete template', error);
    }
  }
}
