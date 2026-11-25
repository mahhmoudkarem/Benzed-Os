import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { EntityPage } from '../../shared/entity/entity-page';
import { EntityForm } from '../../shared/entity/entity-form';
import { PageHeader } from '../../shared/components/page-header';
import { Icon } from '../../shared/components/icon';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { Repositories } from '../../core/repositories/repositories';
import { ContentItem } from '../../core/models/business';
import { CONTENT_STATUS, optionColor } from '../../core/constants/options';
import { addDays, cairoDate, endOfMonth, startOfMonth, startOfWeek } from '../../core/utils/date';
import { contentConfig } from './content.config';

interface Cell {
  date: string;
  inMonth: boolean;
  items: ContentItem[];
}

@Component({
  selector: 'app-content-page',
  imports: [EntityPage, EntityForm, PageHeader, Icon],
  template: `
    <app-page-header [title]="lang.t('Content calendar', 'تقويم المحتوى')" [subtitle]="lang.t('Plan and track content. Publishing is manual — there is no platform integration.', 'خطط وتابع المحتوى. النشر يدوي — لا يوجد ربط مع المنصات.')">
      <div class="flex gap-1">
        <button class="btn btn-sm" [class.btn-primary]="view() === 'month'" type="button" (click)="view.set('month')">{{ lang.t('Month', 'شهري') }}</button>
        <button class="btn btn-sm" [class.btn-primary]="view() === 'week'" type="button" (click)="view.set('week')">{{ lang.t('Week', 'أسبوعي') }}</button>
        <button class="btn btn-sm" [class.btn-primary]="view() === 'list'" type="button" (click)="view.set('list')">{{ lang.t('List', 'قائمة') }}</button>
      </div>
    </app-page-header>

    @if (view() === 'list') {
      <app-entity-page [config]="config" [embedded]="true" />
    } @else {
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <button class="btn btn-sm" type="button" (click)="shift(-1)"><span class="rtl-flip" style="transform: scaleX(-1)"><app-icon name="chevron" [size]="14" /></span></button>
        <button class="btn btn-sm" type="button" (click)="today()">{{ lang.t('Today', 'اليوم') }}</button>
        <button class="btn btn-sm" type="button" (click)="shift(1)"><span class="rtl-flip"><app-icon name="chevron" [size]="14" /></span></button>
        <b class="mx-2">{{ title() }}</b>
        <select class="select" style="width: auto" (change)="clientFilter.set($any($event.target).value)">
          <option value="">{{ lang.t('All clients', 'كل العملاء') }}</option>
          @for (c of clients(); track c.id) {<option [value]="c.id">{{ c.name }}</option>}
        </select>
      </div>
      <div class="grid grid-cols-7 text-center text-[12px] text-muted font-semibold mb-1">
        @for (d of weekdays(); track $index) {<div>{{ d }}</div>}
      </div>
      <div class="cal-grid">
        @for (c of cells(); track c.date) {
          <div class="cal-cell" [class.dim]="!c.inMonth" [style.min-height.px]="view() === 'week' ? 260 : 92">
            <div class="flex items-center justify-between">
              <span [style.font-weight]="c.date === todayStr ? 700 : 400" [style.color]="c.date === todayStr ? 'var(--primary)' : ''">{{ dayNum(c.date) }}</span>
              <button class="icon-btn" style="width: 20px; height: 20px" type="button" (click)="newOn(c.date)" [title]="lang.t('Add content', 'إضافة محتوى')"><app-icon name="plus" [size]="12" /></button>
            </div>
            @for (i of c.items; track i.id) {
              <button class="cal-chip" type="button" [title]="i.title" (click)="edit(i)" [style.border-inline-start]="'3px solid ' + dot(i.status)">{{ i.title }}</button>
            }
          </div>
        }
      </div>
    }

    @if (formOpen()) {
      <app-entity-form [config]="config" [record]="editing()" [presets]="presets()" (saved)="onSaved()" (closed)="formOpen.set(false)" />
    }
  `,
})
export class ContentPage implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly repos = inject(Repositories);
  protected readonly config = contentConfig();
  protected readonly todayStr = cairoDate();

  protected readonly view = signal<'month' | 'week' | 'list'>('month');
  protected readonly anchor = signal(cairoDate());
  protected readonly items = signal<ContentItem[]>([]);
  protected readonly clients = signal<{ id: string; name: string }[]>([]);
  protected readonly clientFilter = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<ContentItem | null>(null);
  protected readonly presets = signal<Record<string, any>>({});

  protected readonly cells = computed<Cell[]>(() => {
    const a = this.anchor();
    const month = view_month(a);
    const first = this.view() === 'week' ? startOfWeek(a) : startOfWeek(startOfMonth(a));
    const last = this.view() === 'week' ? addDays(first, 6) : addDays(startOfWeek(endOfMonth(a)), 6);
    const list = this.items().filter((i) => !this.clientFilter() || i.clientId === this.clientFilter());
    const out: Cell[] = [];
    for (let d = first; d <= last; d = addDays(d, 1)) out.push({ date: d, inMonth: this.view() === 'week' || d.slice(0, 7) === month, items: list.filter((i) => i.publishDate === d) });
    return out;
  });

  protected readonly title = computed(() => {
    const a = this.anchor();
    if (this.view() === 'week') {
      const s = startOfWeek(a);
      return this.lang.date(s) + ' → ' + this.lang.date(addDays(s, 6));
    }
    return this.lang.month(a.slice(0, 7));
  });

  protected weekdays(): string[] {
    const sat = new Date(Date.UTC(2024, 0, 6)); // Saturday
    return Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(this.lang.isArabic() ? 'ar-EG' : 'en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(sat.getTime() + i * 86400000)));
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.items.set(await this.repos.contentItems.list());
    this.clients.set((await this.repos.clients.list()).filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name })));
  }

  protected dayNum(d: string): string {
    return this.lang.num(Number(d.slice(8)));
  }
  protected dot(status: string): string {
    const c = optionColor(CONTENT_STATUS, status);
    return { gray: '#94a3b8', blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#8b5cf6', teal: '#14b8a6' }[c] || '#94a3b8';
  }

  protected shift(dir: number): void {
    const a = this.anchor();
    if (this.view() === 'week') this.anchor.set(addDays(a, 7 * dir));
    else {
      const [y, m] = a.split('-').map(Number);
      this.anchor.set(new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10));
    }
  }
  protected today(): void {
    this.anchor.set(cairoDate());
  }
  protected newOn(date: string): void {
    this.editing.set(null);
    this.presets.set({ publishDate: date, clientId: this.clientFilter() || undefined });
    this.formOpen.set(true);
  }
  protected edit(i: ContentItem): void {
    this.presets.set({});
    this.editing.set(i);
    this.formOpen.set(true);
  }
  protected async onSaved(): Promise<void> {
    this.formOpen.set(false);
    await this.load();
  }
}

function view_month(date: string): string {
  return date.slice(0, 7);
}
