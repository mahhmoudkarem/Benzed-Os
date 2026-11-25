import { Component, OnInit, inject, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DataService } from '../../core/services/data.service';
import { AccountingService } from '../../core/accounting/accounting.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { CapitalTx } from '../../core/models/accounting';
import { CAPITAL_TYPES, PAYMENT_METHODS, optionColor, optionLabel } from '../../core/constants/options';
import { AccountingSummary, summary } from '../../core/accounting/metrics';
import { cairoDate } from '../../core/utils/date';
import { PageHeader } from '../../shared/components/page-header';
import { StatCard } from '../../shared/components/stat-card';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Loading } from '../../shared/components/state-views';

@Component({
  selector: 'app-capital-page',
  imports: [PageHeader, StatCard, Badge, Icon, EmptyState, Loading],
  template: `
    <app-page-header [title]="lang.t('Capital management', 'إدارة رأس المال')" [subtitle]="lang.t('Initial capital was entered at setup. Record owner contributions and withdrawals here.', 'تم إدخال رأس المال الابتدائي عند الإعداد. سجّل مساهمات وسحوبات المالك هنا.')" />
    @if (loading()) {
      <div class="card"><app-loading /></div>
    } @else if (s(); as s) {
      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <app-stat-card icon="layers" [label]="lang.t('Initial capital', 'رأس المال الابتدائي')" [value]="lang.money(s.initialCapital)" />
        <app-stat-card icon="plus" tone="good" [label]="lang.t('Additional capital', 'رأس مال إضافي')" [value]="lang.money(s.additionalCapital)" />
        <app-stat-card icon="users" [label]="lang.t('Owner contributions (total)', 'مساهمات المالك (إجمالي)')" [value]="lang.money(s.initialCapital + s.additionalCapital)" />
        <app-stat-card icon="upload" tone="warn" [label]="lang.t('Owner withdrawals', 'مسحوبات المالك')" [value]="lang.money(s.withdrawals)" />
        <app-stat-card icon="trend" [label]="lang.t('Retained earnings (cumulative profit)', 'الأرباح المحتجزة (الربح التراكمي)')" [value]="lang.money(s.retainedEarnings)" />
        <app-stat-card icon="wallet" [label]="lang.t('Total assets', 'إجمالي الأصول')" [value]="lang.money(s.totalAssets)" />
        <app-stat-card icon="file" [label]="lang.t('Total liabilities', 'إجمالي الالتزامات')" [value]="lang.money(s.totalLiabilities)" />
        <app-stat-card icon="dollar" tone="good" [label]="lang.t('Owner’s equity', 'حقوق الملكية')" [value]="lang.money(s.equity)" [hint]="s.balanced ? lang.t('Assets = Liabilities + Equity ✓', 'الأصول = الالتزامات + حقوق الملكية ✓') : lang.t('Balance check failed!', 'فشل فحص التوازن!')" />
      </div>
    }

    <div class="grid gap-3 mt-3 grid-cols-1 lg:grid-cols-3">
      <div class="card card-pad">
        <div class="card-title mb-3">{{ lang.t('New capital entry', 'حركة رأس مال جديدة') }}</div>
        <div class="flex flex-col gap-3">
          <div><label class="label">{{ lang.t('Type', 'النوع') }}</label>
            <select class="select" (change)="type.set($any($event.target).value)">
              @for (t of types; track t.value) {<option [value]="t.value" [selected]="type() === t.value">{{ lang.l(t.label) }}</option>}
            </select></div>
          <div><label class="label">{{ lang.t('Amount (EGP)', 'المبلغ (ج.م)') }} *</label><input class="input" type="number" min="0" step="0.01" [value]="amount()" (input)="amount.set($any($event.target).value)" /></div>
          <div><label class="label">{{ lang.t('Date', 'التاريخ') }}</label><input class="input" type="date" [value]="date()" (change)="date.set($any($event.target).value)" /></div>
          <div><label class="label">{{ lang.t('Cash / bank', 'نقدي / بنك') }}</label>
            <select class="select" (change)="method.set($any($event.target).value)">
              @for (m of methods; track m.value) {<option [value]="m.value" [selected]="method() === m.value">{{ lang.l(m.label) }}</option>}
            </select></div>
          <div><label class="label">{{ lang.t('Notes', 'ملاحظات') }}</label><input class="input" [value]="notes()" (input)="notes.set($any($event.target).value)" /></div>
          @if (error()) {<div class="field-error">{{ error() }}</div>}
          <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="save()">{{ lang.t('Post entry', 'ترحيل الحركة') }}</button>
        </div>
      </div>
      <div class="card lg:col-span-2">
        <div class="card-title p-4 pb-2">{{ lang.t('Capital history', 'سجل رأس المال') }}</div>
        @if (!list().length) {
          <app-empty-state icon="layers" [title]="lang.t('No capital entries', 'لا توجد حركات')" />
        } @else {
          <div class="table-wrap"><table class="table">
            <thead><tr><th>{{ lang.t('Date', 'التاريخ') }}</th><th>{{ lang.t('Type', 'النوع') }}</th><th>{{ lang.t('Notes', 'ملاحظات') }}</th><th class="num">{{ lang.t('Amount', 'المبلغ') }}</th><th></th></tr></thead>
            <tbody>
              @for (c of list(); track c.id) {
                <tr [style.opacity]="c.voided ? 0.5 : 1">
                  <td>{{ lang.date(c.date) }}</td>
                  <td><app-badge [color]="color(c.type)">{{ label(c.type) }}</app-badge> @if (c.voided) {<app-badge color="red">{{ lang.t('Voided', 'ملغاة') }}</app-badge>}</td>
                  <td>{{ c.notes || '—' }}</td>
                  <td class="num">{{ c.type === 'withdrawal' ? '−' : '+' }} {{ lang.money(c.amount) }}</td>
                  <td>@if (!c.voided) {<button class="icon-btn" style="color: var(--danger)" type="button" (click)="voidIt(c)"><app-icon name="x" [size]="16" /></button>}</td>
                </tr>
              }
            </tbody>
          </table></div>
        }
      </div>
    </div>
  `,
})
export class CapitalPage implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly data = inject(DataService);
  private readonly acc = inject(AccountingService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly types = CAPITAL_TYPES.filter((t) => t.value !== 'initial');
  protected readonly methods = PAYMENT_METHODS.filter((m) => m.value === 'cash' || m.value === 'bank');
  protected readonly loading = signal(true);
  protected readonly s = signal<AccountingSummary | null>(null);
  protected readonly list = signal<CapitalTx[]>([]);
  protected readonly type = signal('additional');
  protected readonly amount = signal('');
  protected readonly date = signal(cairoDate());
  protected readonly method = signal('bank');
  protected readonly notes = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const snap = await this.data.snapshot();
    this.s.set(summary(snap, '0000-01-01', snap.today));
    this.list.set([...snap.capital].sort((a, b) => b.date.localeCompare(a.date)));
    this.loading.set(false);
  }

  protected label(t: string): string {
    return optionLabel(CAPITAL_TYPES, t, this.lang.lang());
  }
  protected color(t: string): string {
    return optionColor(CAPITAL_TYPES, t);
  }

  protected async save(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.acc.recordCapital({ type: this.type() as any, amount: Number(this.amount()), date: this.date(), method: this.method(), notes: this.notes() });
      this.toast.success(this.lang.t('Capital entry posted', 'تم ترحيل الحركة'));
      this.amount.set('');
      this.notes.set('');
      await this.load();
    } catch (e: any) {
      this.error.set(String(e?.message || e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async voidIt(c: CapitalTx): Promise<void> {
    const r = await this.confirm.ask({ titleEn: 'Void capital entry', titleAr: 'إلغاء حركة رأس المال', messageEn: 'A documented reversal entry will be posted.', messageAr: 'سيتم ترحيل قيد عكسي موثق.', danger: true, askReason: true, confirmEn: 'Void', confirmAr: 'إلغاء' });
    if (!r.ok) return;
    try {
      await this.acc.voidCapital(c.id, r.reason);
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }
}
