import { Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ColumnDef, EntityConfig, EntityCtx, EntityPageApi, FilterDef, LookupDef } from './entity.types';
import { EntityForm } from './entity-form';
import { Icon } from '../components/icon';
import { Badge } from '../components/badge';
import { EmptyState, ErrorState, Loading } from '../components/state-views';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { Repositories } from '../../core/repositories/repositories';
import { Repo } from '../../core/repositories/base.repository';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { ActivityService } from '../../core/services/activity.service';
import { optionColor, optionLabel } from '../../core/constants/options';

const PAGE_SIZE = 15;

/** صفحة CRUD عامة مبنية على EntityConfig: بحث، فلاتر، ترتيب، ترقيم، إضافة/تعديل/أرشفة/حذف */
@Component({
  selector: 'app-entity-page',
  imports: [RouterLink, Icon, Badge, EntityForm, EmptyState, ErrorState, Loading],
  template: `
    <div class="card">
      <div class="flex flex-wrap items-center gap-2 p-3 border-b border-line">
        @if (!embedded()) {
          <div class="font-semibold text-[15px] me-2">{{ lang.l(config().title) }}</div>
        }
        <div class="relative" style="min-width: 190px; flex: 1 1 190px; max-width: 320px">
          <span class="absolute top-1/2 -translate-y-1/2 start-2.5 text-muted pointer-events-none"><app-icon name="search" [size]="15" /></span>
          <input class="input" style="padding-inline-start: 32px" [placeholder]="lang.t('Search…', 'بحث…')" [value]="search()" (input)="search.set($any($event.target).value); page.set(1)" />
        </div>
        @for (f of config().filters || []; track f.key) {
          <select class="select" style="width: auto; max-width: 180px" (change)="setFilter(f.key, $any($event.target).value)">
            <option value="">{{ lang.l(f.label) }}: {{ lang.t('All', 'الكل') }}</option>
            @for (o of filterOptions(f); track o.value) {
              <option [value]="o.value" [selected]="filters()[f.key] === o.value">{{ o.label }}</option>
            }
          </select>
        }
        @if (config().archive) {
          <label class="flex items-center gap-1.5 text-[13px] cursor-pointer">
            <input type="checkbox" [checked]="showArchived()" (change)="showArchived.set($any($event.target).checked); page.set(1)" />
            {{ lang.t('Show archived', 'عرض المؤرشف') }}
          </label>
        }
        <div class="flex-1"></div>
        @for (a of config().toolbar || []; track $index) {
          <button class="btn" type="button" (click)="a.run(api)"><app-icon [name]="a.icon" [size]="15" /> {{ lang.l(a.label) }}</button>
        }
        @if (config().allowAdd !== false) {
          <button class="btn btn-primary" type="button" (click)="openNew()"><app-icon name="plus" [size]="15" /> {{ lang.t('Add', 'إضافة') }} {{ lang.l(config().singular) }}</button>
        }
      </div>

      @if (loading()) {
        <app-loading />
      } @else if (error()) {
        <app-error-state [message]="error()"><button class="btn" type="button" (click)="reload()">{{ lang.t('Retry', 'إعادة المحاولة') }}</button></app-error-state>
      } @else if (!view().length) {
        <app-empty-state [icon]="config().icon || 'layers'" [title]="rows().length ? lang.t('No matching results', 'لا توجد نتائج مطابقة') : lang.t('Nothing here yet', 'لا توجد سجلات بعد')" [text]="rows().length ? '' : lang.l(config().emptyText) || lang.t('Add your first record to get started.', 'أضف أول سجل للبدء.')">
          @if (!rows().length && config().allowAdd !== false) {
            <button class="btn btn-primary" type="button" (click)="openNew()"><app-icon name="plus" [size]="15" /> {{ lang.t('Add', 'إضافة') }} {{ lang.l(config().singular) }}</button>
          }
        </app-empty-state>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                @for (c of config().columns; track c.key) {
                  <th [class.sortable]="!c.noSort" [class.num]="c.type === 'money' || c.type === 'number'" (click)="sortBy(c)">
                    {{ lang.l(c.label) }}
                    @if (sort().key === c.key) {
                      <span>{{ sort().dir === 'asc' ? '▲' : '▼' }}</span>
                    }
                  </th>
                }
                <th style="width: 1%"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of paged(); track row.id) {
                <tr [style.opacity]="row.archived ? 0.55 : 1">
                  @for (c of config().columns; track c.key) {
                    <td [class.num]="c.type === 'money' || c.type === 'number'">
                      @if (c.type === 'badge') {
                        <app-badge [color]="badgeColor(c, row)">{{ cell(row, c) }}</app-badge>
                      } @else if (c.link && config().detailRoute) {
                        <a class="font-semibold no-underline" [routerLink]="config().detailRoute!(row)">{{ cell(row, c) }}</a>
                      } @else {
                        {{ cell(row, c) }}
                      }
                    </td>
                  }
                  <td>
                    <div class="flex items-center gap-0.5 justify-end">
                      @for (a of config().rowActions || []; track $index) {
                        @if (!a.show || a.show(row)) {
                          <button class="icon-btn" type="button" [title]="lang.l(a.label)" (click)="a.run(row, api)"><app-icon [name]="a.icon" [size]="16" /></button>
                        }
                      }
                      @if (config().detailRoute) {
                        <a class="icon-btn" [routerLink]="config().detailRoute!(row)" [title]="lang.t('Details', 'التفاصيل')"><app-icon name="eye" [size]="16" /></a>
                      }
                      @if (config().allowEdit !== false) {
                        <button class="icon-btn" type="button" [title]="lang.t('Edit', 'تعديل')" (click)="openEdit(row)"><app-icon name="edit" [size]="16" /></button>
                      }
                      @if (config().archive) {
                        <button class="icon-btn" type="button" [title]="row.archived ? lang.t('Restore', 'استعادة') : lang.t('Archive', 'أرشفة')" (click)="toggleArchive(row)"><app-icon name="archive" [size]="16" /></button>
                      }
                      @if (config().allowDelete !== false) {
                        <button class="icon-btn" type="button" [title]="lang.t('Delete', 'حذف')" (click)="remove(row)" style="color: var(--danger)"><app-icon name="trash" [size]="16" /></button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between p-3 border-t border-line text-[12.5px] text-muted">
          <span>{{ lang.num(view().length) }} {{ lang.t('records', 'سجل') }}</span>
          @if (pages() > 1) {
            <div class="flex items-center gap-2">
              <button class="btn btn-sm" type="button" [disabled]="page() <= 1" (click)="page.set(page() - 1)">‹</button>
              <span>{{ lang.num(page()) }} / {{ lang.num(pages()) }}</span>
              <button class="btn btn-sm" type="button" [disabled]="page() >= pages()" (click)="page.set(page() + 1)">›</button>
            </div>
          }
        </div>
      }
    </div>

    @if (formOpen()) {
      <app-entity-form [config]="config()" [record]="editing()" [fixed]="fixed()" (saved)="onSaved()" (closed)="formOpen.set(false)" />
    }
  `,
})
export class EntityPage implements OnInit {
  readonly config = input.required<EntityConfig>();
  readonly fixed = input<Record<string, any>>({});
  readonly embedded = input(false);

  protected readonly lang = inject(LanguageService);
  private readonly repos = inject(Repositories);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);

  protected readonly rows = signal<any[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly filters = signal<Record<string, string>>({});
  protected readonly showArchived = signal(false);
  protected readonly sort = signal<{ key: string; dir: 'asc' | 'desc' }>({ key: '', dir: 'asc' });
  protected readonly page = signal(1);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<any | null>(null);
  private readonly maps = signal<Record<string, Map<string, string>>>({});
  private readonly filterLookups = signal<Record<string, { value: string; label: string }[]>>({});

  protected readonly api: EntityPageApi = { reload: () => this.reload(), fixed: {} };

  protected readonly view = computed(() => {
    const cfg = this.config();
    const q = this.search().trim().toLowerCase();
    const f = this.filters();
    const maps = this.maps();
    const arch = this.showArchived();
    let list = this.rows().filter((r) => (cfg.archive ? (arch ? true : !r.archived) : true));
    for (const k of Object.keys(f)) if (f[k]) list = list.filter((r) => String(r[k] ?? '') === f[k]);
    if (q) {
      list = list.filter((r) => {
        const parts = cfg.searchKeys.map((k) => String(r[k] ?? ''));
        for (const c of cfg.columns) if (c.type === 'lookup') parts.push(maps[c.key]?.get(r[c.key]) || '');
        return parts.join(' ').toLowerCase().includes(q);
      });
    }
    const s = this.sort();
    const key = s.key || cfg.defaultSort?.key || '';
    const dir = s.key ? s.dir : cfg.defaultSort?.dir || 'asc';
    if (key) {
      const col = cfg.columns.find((c) => c.key === key);
      const val = (r: any) => (col?.type === 'lookup' ? maps[key]?.get(r[key]) || '' : r[key] ?? '');
      list = [...list].sort((a, b) => {
        const x = val(a);
        const y = val(b);
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return dir === 'asc' ? c : -c;
      });
    }
    return list;
  });

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.view().length / PAGE_SIZE)));
  protected readonly paged = computed(() => this.view().slice((this.page() - 1) * PAGE_SIZE, this.page() * PAGE_SIZE));

  constructor() {
    // لو الـ fixed اتغيّر نعيد التحميل
    // الـ effect يتابع config و fixed بس. الـ reload جوه untracked علشان
    // قراءة rows() جوّاه متخليش الـ effect يعيد نفسه في loop لا نهائي
    effect(() => {
      this.config();
      const fx = this.fixed();
      untracked(() => {
        this.api.fixed = fx;
        void this.reload();
      });
    });
  }

  ngOnInit(): void {
    this.api.fixed = this.fixed();
  }

  async reload(): Promise<void> {
    const cfg = this.config();
    this.loading.set(this.rows().length === 0);
    this.error.set('');
    try {
      let rows: any[] = await this.repos.table(cfg.table).toArray();
      const fx = this.fixed();
      for (const k of Object.keys(fx)) rows = rows.filter((r) => r[k] === fx[k]);
      this.rows.set(rows);

      const maps: Record<string, Map<string, string>> = {};
      for (const c of cfg.columns) if (c.type === 'lookup' && c.lookup) maps[c.key] = await this.loadMap(c.lookup);
      this.maps.set(maps);
      const fl: Record<string, { value: string; label: string }[]> = {};
      for (const f of cfg.filters || []) if (f.lookup) fl[f.key] = Array.from((await this.loadMap(f.lookup)).entries()).map(([value, label]) => ({ value, label }));
      this.filterLookups.set(fl);
    } catch (e: any) {
      console.error(e);
      this.error.set(this.lang.t('Failed to load data: ', 'فشل تحميل البيانات: ') + String(e?.message || e));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMap(l: LookupDef): Promise<Map<string, string>> {
    const rows: any[] = await this.repos.table(l.table).toArray();
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.id, typeof l.label === 'function' ? l.label(r) : String(r[l.label] ?? ''));
    return m;
  }

  protected filterOptions(f: FilterDef): { value: string; label: string }[] {
    if (f.options) return f.options.map((o) => ({ value: o.value, label: this.lang.l(o.label) }));
    return this.filterLookups()[f.key] || [];
  }

  protected setFilter(key: string, value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
    this.page.set(1);
  }

  protected sortBy(c: ColumnDef): void {
    if (c.noSort || c.type === 'custom') return;
    const s = this.sort();
    this.sort.set({ key: c.key, dir: s.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' });
  }

  private ctx(): EntityCtx {
    return { maps: this.maps(), money: (n) => this.lang.money(n), date: (s) => this.lang.date(s), lang: this.lang.lang() };
  }

  protected cell(row: any, c: ColumnDef): string {
    const v = row[c.key];
    switch (c.type) {
      case 'money':
        return this.lang.money(Number(v) || 0);
      case 'number':
        return this.lang.num(Number(v) || 0, 1);
      case 'percent':
        return this.lang.num(Number(v) || 0, 0) + '%';
      case 'date':
        return v ? this.lang.date(v) : '—';
      case 'lookup':
        return this.maps()[c.key]?.get(v) || '—';
      case 'bool':
        return v ? '✓' : '—';
      case 'badge':
        return optionLabel(c.options || [], v, this.lang.lang());
      case 'custom':
        return c.render ? c.render(row, this.ctx()) : '';
      default:
        return v === undefined || v === null || v === '' ? '—' : String(v);
    }
  }

  protected badgeColor(c: ColumnDef, row: any): string {
    return optionColor(c.options || [], row[c.key]);
  }

  protected openNew(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(row: any): void {
    this.editing.set(row);
    this.formOpen.set(true);
  }

  protected async onSaved(): Promise<void> {
    this.formOpen.set(false);
    await this.reload();
  }

  protected async toggleArchive(row: any): Promise<void> {
    const cfg = this.config();
    const archiving = !row.archived;
    const ok = await this.confirm.confirm({
      titleEn: archiving ? 'Archive record' : 'Restore record',
      titleAr: archiving ? 'أرشفة السجل' : 'استعادة السجل',
      messageEn: (archiving ? 'Archive ' : 'Restore ') + cfg.titleOf(row) + '?',
      messageAr: (archiving ? 'أرشفة ' : 'استعادة ') + cfg.titleOf(row) + '؟',
    });
    if (!ok) return;
    try {
      await new Repo<any>(this.repos.table(cfg.table)).update(row.id, { archived: archiving });
      await this.activity.log(archiving ? 'archived' : 'restored', cfg.table, row.id, cfg.singular.en + (archiving ? ' archived: ' : ' restored: ') + cfg.titleOf(row), (archiving ? 'تمت أرشفة ' : 'تمت استعادة ') + cfg.singular.ar + ': ' + cfg.titleOf(row));
      this.toast.success(this.lang.t('Done', 'تم'));
      await this.reload();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }

  protected async remove(row: any): Promise<void> {
    const cfg = this.config();
    try {
      const blocked = cfg.deleteGuard ? await cfg.deleteGuard(row) : null;
      if (blocked) {
        this.toast.warning(this.lang.l(blocked));
        return;
      }
      const ok = await this.confirm.confirm({
        titleEn: 'Delete record',
        titleAr: 'حذف السجل',
        messageEn: 'Delete "' + cfg.titleOf(row) + '" permanently? This cannot be undone.',
        messageAr: 'حذف "' + cfg.titleOf(row) + '" نهائيًا؟ لا يمكن التراجع.',
        danger: true,
        confirmEn: 'Delete',
        confirmAr: 'حذف',
      });
      if (!ok) return;
      if (cfg.remove) await cfg.remove(row);
      else await this.repos.table(cfg.table).delete(row.id);
      await this.activity.log('deleted', cfg.table, row.id, cfg.singular.en + ' deleted: ' + cfg.titleOf(row), 'تم حذف ' + cfg.singular.ar + ': ' + cfg.titleOf(row));
      this.toast.success(this.lang.t('Deleted', 'تم الحذف'));
      await this.reload();
    } catch (e: any) {
      console.error(e);
      this.toast.error(String(e?.message || e));
    }
  }
}
