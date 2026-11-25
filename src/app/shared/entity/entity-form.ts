import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { EntityConfig, FieldDef } from './entity.types';
import { Modal } from '../components/modal';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { Repositories } from '../../core/repositories/repositories';
import { Repo } from '../../core/repositories/base.repository';
import { ToastService } from '../../core/services/toast.service';
import { ActivityService } from '../../core/services/activity.service';
import { cairoDate } from '../../core/utils/date';

interface Opt {
  value: string;
  label: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;

@Component({
  selector: 'app-entity-form',
  imports: [Modal],
  template: `
    <app-modal [title]="(record() ? lang.t('Edit ', 'تعديل ') : lang.t('New ', 'جديد: ')) + lang.l(config().singular)" [wide]="config().fields.length > 8" (closed)="closed.emit()">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        @for (f of visibleFields(); track f.key) {
          <div [class.sm:col-span-2]="f.colSpan === 2 || f.type === 'textarea' || f.type === 'multiselect'">
            @if (f.type !== 'checkbox') {
              <label class="label" [attr.for]="'f-' + f.key">{{ lang.l(f.label) }}@if (f.required) {<span style="color: var(--danger)"> *</span>}</label>
            }
            @switch (f.type) {
              @case ('textarea') {
                <textarea class="textarea" [class.invalid]="errors()[f.key]" [id]="'f-' + f.key" [value]="model()[f.key] ?? ''" (input)="set(f.key, $any($event.target).value)"></textarea>
              }
              @case ('select') {
                <select class="select" [class.invalid]="errors()[f.key]" [id]="'f-' + f.key" (change)="set(f.key, $any($event.target).value)">
                  <option value="" [selected]="!model()[f.key]">{{ f.required ? lang.t('Select…', 'اختر…') : '—' }}</option>
                  @for (o of opts(f); track o.value) {
                    <option [value]="o.value" [selected]="model()[f.key] === o.value">{{ o.label }}</option>
                  }
                </select>
              }
              @case ('multiselect') {
                <div class="flex flex-wrap gap-2 p-2 border border-line rounded-lg max-h-40 overflow-y-auto">
                  @for (o of opts(f); track o.value) {
                    <label class="flex items-center gap-1.5 text-[13px] cursor-pointer">
                      <input type="checkbox" [checked]="(model()[f.key] || []).includes(o.value)" (change)="toggleMulti(f.key, o.value, $any($event.target).checked)" />
                      {{ o.label }}
                    </label>
                  } @empty {
                    <span class="text-muted text-[13px]">{{ lang.t('No options available', 'لا توجد خيارات') }}</span>
                  }
                </div>
              }
              @case ('checkbox') {
                <label class="flex items-center gap-2 cursor-pointer mt-5">
                  <input type="checkbox" [checked]="!!model()[f.key]" (change)="set(f.key, $any($event.target).checked)" />
                  <span class="text-[13px] font-medium">{{ lang.l(f.label) }}</span>
                </label>
              }
              @default {
                <input
                  class="input"
                  [class.invalid]="errors()[f.key]"
                  [id]="'f-' + f.key"
                  [type]="inputType(f)"
                  [attr.step]="f.type === 'money' ? '0.01' : f.type === 'number' ? 'any' : null"
                  [attr.min]="f.min ?? null"
                  [attr.max]="f.max ?? null"
                  [attr.maxlength]="f.maxLength ?? null"
                  [attr.placeholder]="f.placeholder ?? null"
                  [value]="model()[f.key] ?? ''"
                  (input)="set(f.key, $any($event.target).value)"
                />
              }
            }
            @if (errors()[f.key]) {
              <div class="field-error">{{ errors()[f.key] }}</div>
            }
          </div>
        }
      </div>
      @if (formError()) {
        <div class="field-error mt-3">{{ formError() }}</div>
      }
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn" type="button" (click)="closed.emit()">{{ lang.t('Cancel', 'إلغاء') }}</button>
        <button class="btn btn-primary" type="button" [disabled]="saving()" (click)="save()">
          {{ saving() ? lang.t('Saving…', 'جارِ الحفظ…') : lang.t('Save', 'حفظ') }}
        </button>
      </div>
    </app-modal>
  `,
})
export class EntityForm implements OnInit {
  readonly config = input.required<EntityConfig>();
  readonly record = input<any | null>(null);
  readonly fixed = input<Record<string, any>>({});
  readonly presets = input<Record<string, any>>({});
  readonly saved = output<any>();
  readonly closed = output<void>();

  protected readonly lang = inject(LanguageService);
  private readonly repos = inject(Repositories);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);

  protected readonly model = signal<Record<string, any>>({});
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly formError = signal('');
  protected readonly saving = signal(false);
  private readonly lookups = signal<Record<string, Opt[]>>({});

  protected visibleFields(): FieldDef[] {
    const fx = this.fixed();
    return this.config().fields.filter((f) => !(f.key in fx));
  }

  async ngOnInit(): Promise<void> {
    const cfg = this.config();
    const rec = this.record();
    const m: Record<string, any> = {};
    const extra = cfg.defaults ? cfg.defaults() : {};
    for (const f of cfg.fields) {
      let d = f.default;
      if (d === '$today') d = cairoDate();
      if (f.type === 'multiselect' && d === undefined) d = [];
      m[f.key] = d;
    }
    Object.assign(m, extra, this.presets());
    if (rec) Object.assign(m, cfg.toForm ? cfg.toForm(rec) : rec);
    Object.assign(m, this.fixed());
    this.model.set(m);

    const lk: Record<string, Opt[]> = {};
    for (const f of cfg.fields) {
      if (!f.lookup) continue;
      const rows: any[] = await this.repos.table(f.lookup.table).toArray();
      const filt = f.lookup.filter;
      const label = f.lookup.label;
      lk[f.key] = rows
        .filter((r) => (filt ? filt(r) : !r.archived))
        .map((r) => ({ value: r.id, label: typeof label === 'function' ? label(r) : String(r[label] ?? '') }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    this.lookups.set(lk);
  }

  protected opts(f: FieldDef): Opt[] {
    if (f.options) return f.options.map((o) => ({ value: o.value, label: this.lang.l(o.label) }));
    return this.lookups()[f.key] || [];
  }

  protected inputType(f: FieldDef): string {
    return f.type === 'money' ? 'number' : f.type;
  }

  protected set(key: string, value: any): void {
    this.model.update((m) => ({ ...m, [key]: value }));
    if (this.errors()[key]) this.errors.update((e) => ({ ...e, [key]: '' }));
  }

  protected toggleMulti(key: string, value: string, on: boolean): void {
    const cur: string[] = this.model()[key] || [];
    this.set(key, on ? Array.from(new Set([...cur, value])) : cur.filter((x) => x !== value));
  }

  private validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    const m = this.model();
    const L = (en: string, ar: string) => this.lang.t(en, ar);
    for (const f of this.visibleFields()) {
      const v = m[f.key];
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
      if (f.required && empty && f.type !== 'checkbox') {
        errs[f.key] = L('This field is required', 'هذا الحقل مطلوب');
        continue;
      }
      if (empty) continue;
      if (f.type === 'email' && !EMAIL.test(String(v))) errs[f.key] = L('Enter a valid email', 'أدخل بريدًا إلكترونيًا صحيحًا');
      if (f.type === 'url' && !URL_RE.test(String(v))) errs[f.key] = L('Enter a valid link', 'أدخل رابطًا صحيحًا');
      if (f.type === 'tel' && !/^[+\d][\d\s\-()]{5,19}$/.test(String(v))) errs[f.key] = L('Enter a valid phone number', 'أدخل رقم هاتف صحيحًا');
      if (f.type === 'number' || f.type === 'money') {
        const n = Number(v);
        if (!Number.isFinite(n)) errs[f.key] = L('Enter a valid number', 'أدخل رقمًا صحيحًا');
        else if (f.min !== undefined && n < f.min) errs[f.key] = L('Minimum value is ', 'أقل قيمة ') + f.min;
        else if (f.max !== undefined && n > f.max) errs[f.key] = L('Maximum value is ', 'أقصى قيمة ') + f.max;
      }
      if (f.maxLength && String(v).length > f.maxLength) errs[f.key] = L('Too long', 'النص طويل جدًا');
    }
    const custom = this.config().validate?.(m);
    if (custom) for (const k of Object.keys(custom)) errs[k] = this.lang.l(custom[k]);
    return errs;
  }

  protected async save(): Promise<void> {
    const errs = this.validate();
    this.errors.set(errs);
    this.formError.set('');
    if (Object.keys(errs).some((k) => errs[k])) return;
    const cfg = this.config();
    const rec = this.record();
    this.saving.set(true);
    try {
      const value: Record<string, any> = {};
      for (const f of cfg.fields) {
        let v = this.model()[f.key];
        if (f.type === 'number' || f.type === 'money') v = v === '' || v === undefined || v === null ? (f.required ? 0 : 0) : Number(v);
        if (typeof v === 'string') v = v.trim();
        if (f.type === 'select' && f.lookup && v === '') v = undefined;
        if (f.type === 'checkbox') v = !!v;
        value[f.key] = v;
      }
      Object.assign(value, this.fixed());
      let final = cfg.beforeSave ? await cfg.beforeSave(value, rec) : value;
      const repo = new Repo<any>(this.repos.table(cfg.table));
      const saved = cfg.persist ? await cfg.persist(final, rec) : rec ? await repo.update(rec.id, final) : await repo.create(final);
      const title = cfg.titleOf(saved);
      await this.activity.log(
        rec ? 'updated' : 'created',
        cfg.table,
        saved?.id,
        cfg.singular.en + (rec ? ' updated: ' : ' created: ') + title,
        (rec ? 'تم تعديل ' : 'تم إنشاء ') + cfg.singular.ar + ': ' + title,
      );
      this.toast.success(this.lang.t('Saved successfully', 'تم الحفظ بنجاح'));
      this.saved.emit(saved);
    } catch (e: any) {
      console.error(e);
      this.formError.set(String(e?.message || e));
      this.toast.error(this.lang.t('Could not save: ', 'تعذر الحفظ: ') + String(e?.message || e));
    } finally {
      this.saving.set(false);
    }
  }
}
