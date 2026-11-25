import { Component, OnInit, inject, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DataService } from '../../core/services/data.service';
import { DbService } from '../../core/services/db.service';
import { ToastService } from '../../core/services/toast.service';
import { Account, AccountType } from '../../core/models/accounting';
import { accountBalance } from '../../core/accounting/ledger';
import { Snapshot } from '../../core/accounting/snapshot';
import { isoNow } from '../../core/utils/date';
import { uid } from '../../core/utils/id';
import { PageHeader } from '../../shared/components/page-header';
import { Modal } from '../../shared/components/modal';
import { Icon } from '../../shared/components/icon';
import { Badge } from '../../shared/components/badge';
import { Loading } from '../../shared/components/state-views';

@Component({
  selector: 'app-chart-page',
  imports: [PageHeader, Modal, Icon, Badge, Loading],
  template: `
    <app-page-header [title]="lang.t('Chart of accounts', 'دليل الحسابات')" [subtitle]="lang.t('System accounts are used by the posting rules and cannot be removed.', 'الحسابات النظامية تستخدمها قواعد الترحيل ولا يمكن حذفها.')">
      <button class="btn btn-primary" type="button" (click)="open()"><app-icon name="plus" [size]="15" /> {{ lang.t('New account', 'حساب جديد') }}</button>
    </app-page-header>
    <div class="card">
      @if (loading()) { <app-loading /> } @else {
        <div class="table-wrap"><table class="table">
          <thead><tr><th>{{ lang.t('Code', 'الكود') }}</th><th>{{ lang.t('Name', 'الاسم') }}</th><th>{{ lang.t('Type', 'النوع') }}</th><th>{{ lang.t('Normal balance', 'الرصيد الطبيعي') }}</th><th class="num">{{ lang.t('Balance', 'الرصيد') }}</th><th>{{ lang.t('Status', 'الحالة') }}</th><th></th></tr></thead>
          <tbody>
            @for (a of accounts(); track a.id) {
              <tr [style.opacity]="a.active ? 1 : 0.5">
                <td><b>{{ a.code }}</b></td>
                <td>{{ lang.isArabic() ? a.nameAr : a.nameEn }} @if (a.system) {<app-badge color="blue">{{ lang.t('System', 'نظامي') }}</app-badge>}</td>
                <td>{{ typeLabel(a.type) }}</td>
                <td>{{ a.normal === 'debit' ? lang.t('Debit', 'مدين') : lang.t('Credit', 'دائن') }}</td>
                <td class="num">{{ lang.money(balance(a)) }}</td>
                <td>{{ a.active ? lang.t('Active', 'نشط') : lang.t('Inactive', 'غير نشط') }}</td>
                <td>@if (!a.system) {<button class="btn btn-sm" type="button" (click)="toggle(a)">{{ a.active ? lang.t('Deactivate', 'تعطيل') : lang.t('Activate', 'تفعيل') }}</button>}</td>
              </tr>
            }
          </tbody>
        </table></div>
      }
    </div>
    @if (formOpen()) {
      <app-modal [title]="lang.t('New account', 'حساب جديد')" (closed)="formOpen.set(false)">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label class="label">{{ lang.t('Code', 'الكود') }} *</label><input class="input" [value]="code()" (input)="code.set($any($event.target).value)" placeholder="5900" /></div>
          <div><label class="label">{{ lang.t('Type', 'النوع') }}</label>
            <select class="select" (change)="type.set($any($event.target).value)">
              @for (t of types; track t) {<option [value]="t" [selected]="type() === t">{{ typeLabel(t) }}</option>}
            </select></div>
          <div><label class="label">{{ lang.t('Name (English)', 'الاسم (إنجليزي)') }} *</label><input class="input" [value]="nameEn()" (input)="nameEn.set($any($event.target).value)" /></div>
          <div><label class="label">{{ lang.t('Name (Arabic)', 'الاسم (عربي)') }} *</label><input class="input" [value]="nameAr()" (input)="nameAr.set($any($event.target).value)" /></div>
        </div>
        @if (error()) {<div class="field-error mt-2">{{ error() }}</div>}
        <div class="flex justify-end gap-2 mt-4">
          <button class="btn" type="button" (click)="formOpen.set(false)">{{ lang.t('Cancel', 'إلغاء') }}</button>
          <button class="btn btn-primary" type="button" (click)="save()">{{ lang.t('Save', 'حفظ') }}</button>
        </div>
      </app-modal>
    }
  `,
})
export class ChartPage implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly data = inject(DataService);
  private readonly db = inject(DbService).db;
  private readonly toast = inject(ToastService);

  protected readonly types: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];
  protected readonly loading = signal(true);
  protected readonly accounts = signal<Account[]>([]);
  private snap: Snapshot | null = null;
  protected readonly formOpen = signal(false);
  protected readonly code = signal('');
  protected readonly type = signal<AccountType>('expense');
  protected readonly nameEn = signal('');
  protected readonly nameAr = signal('');
  protected readonly error = signal('');

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.snap = await this.data.snapshot();
    this.accounts.set([...this.snap.accounts].sort((a, b) => a.code.localeCompare(b.code)));
    this.loading.set(false);
  }

  protected balance(a: Account): number {
    return this.snap ? accountBalance(a, this.snap.lines) : 0;
  }
  protected typeLabel(t: string): string {
    const m: Record<string, [string, string]> = { asset: ['Asset', 'أصل'], liability: ['Liability', 'التزام'], equity: ['Equity', 'حقوق ملكية'], revenue: ['Revenue', 'إيراد'], expense: ['Expense', 'مصروف'] };
    return this.lang.t(m[t][0], m[t][1]);
  }
  protected open(): void {
    this.code.set('');
    this.nameEn.set('');
    this.nameAr.set('');
    this.type.set('expense');
    this.error.set('');
    this.formOpen.set(true);
  }

  protected async save(): Promise<void> {
    const code = this.code().trim();
    if (!/^\d{4,6}$/.test(code)) return void this.error.set(this.lang.t('Code must be 4–6 digits', 'الكود من 4 إلى 6 أرقام'));
    if (!this.nameEn().trim() || !this.nameAr().trim()) return void this.error.set(this.lang.t('Both names are required', 'الاسمان مطلوبان'));
    if (this.accounts().some((a) => a.code === code)) return void this.error.set(this.lang.t('This code already exists', 'هذا الكود موجود'));
    const t = this.type();
    const now = isoNow();
    try {
      await this.db.accounts.add({ id: uid(), code, nameEn: this.nameEn().trim(), nameAr: this.nameAr().trim(), type: t, normal: t === 'asset' || t === 'expense' ? 'debit' : 'credit', isCash: false, system: false, active: true, createdAt: now, updatedAt: now });
      this.formOpen.set(false);
      await this.load();
    } catch (e: any) {
      this.error.set(String(e?.message || e));
    }
  }

  protected async toggle(a: Account): Promise<void> {
    try {
      await this.db.accounts.update(a.id, { active: !a.active, updatedAt: isoNow() });
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }
}
