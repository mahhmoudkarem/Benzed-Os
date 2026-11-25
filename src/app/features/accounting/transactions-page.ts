import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DataService } from '../../core/services/data.service';
import { AccountingService } from '../../core/accounting/accounting.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { FinTransaction } from '../../core/models/accounting';
import { Client, Employee, Project } from '../../core/models/business';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, SERVICE_TYPES, optionColor, optionLabel } from '../../core/constants/options';
import { cairoDate, cairoMonth, addMonths } from '../../core/utils/date';
import { sum } from '../../core/utils/money';
import { EntityConfig } from '../../shared/entity/entity.types';
import { EntityPage } from '../../shared/entity/entity-page';
import { PageHeader } from '../../shared/components/page-header';
import { Modal } from '../../shared/components/modal';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { ChartView } from '../../shared/components/chart';
import { EmptyState, Loading } from '../../shared/components/state-views';
import { AccountingService as AccSvc } from '../../core/accounting/accounting.service';

interface TxForm {
  type: 'income' | 'expense';
  amount: string;
  category: string;
  date: string;
  description: string;
  paymentMethod: string;
  paid: boolean;
  clientId: string;
  projectId: string;
  employeeId: string;
  supplier: string;
  service: string;
  notes: string;
}

@Component({
  selector: 'app-transactions-page',
  imports: [PageHeader, Modal, Badge, Icon, ChartView, EmptyState, Loading, EntityPage],
  template: `
    @if (!embedded()) {
      <app-page-header [title]="lang.t('Income & expenses', 'الإيرادات والمصروفات')" [subtitle]="lang.t('Every entry posts a balanced journal entry. Equipment purchases belong in Assets.', 'كل حركة تُرحَّل بقيد متوازن. مشتريات المعدات تُسجَّل من صفحة الأصول.')">
        <button class="btn" type="button" (click)="open('income')"><app-icon name="plus" [size]="15" /> {{ lang.t('Income', 'إيراد') }}</button>
        <button class="btn btn-primary" type="button" (click)="open('expense')"><app-icon name="plus" [size]="15" /> {{ lang.t('Expense', 'مصروف') }}</button>
      </app-page-header>
      <div class="tabs mb-3">
        <button class="tab" [class.active]="tab() === 'list'" type="button" (click)="tab.set('list')">{{ lang.t('Transactions', 'الحركات') }}</button>
        <button class="tab" [class.active]="tab() === 'summary'" type="button" (click)="tab.set('summary')">{{ lang.t('Monthly summary', 'ملخص شهري') }}</button>
        <button class="tab" [class.active]="tab() === 'recurring'" type="button" (click)="tab.set('recurring')">{{ lang.t('Recurring expenses', 'مصروفات متكررة') }}</button>
      </div>
    } @else {
      <div class="flex justify-end gap-2 mb-2">
        <button class="btn btn-sm" type="button" (click)="open('income')">{{ lang.t('+ Income', '+ إيراد') }}</button>
        <button class="btn btn-primary btn-sm" type="button" (click)="open('expense')">{{ lang.t('+ Expense', '+ مصروف') }}</button>
      </div>
    }

    @if (tab() === 'recurring' && !embedded()) {
      <app-entity-page [config]="recurringConfig" [embedded]="true" />
    } @else if (tab() === 'summary' && !embedded()) {
      <div class="flex items-center gap-2 mb-3">
        <button class="btn btn-sm" type="button" (click)="month.set(shiftMonth(-1))">‹</button>
        <b>{{ lang.month(month()) }}</b>
        <button class="btn btn-sm" type="button" (click)="month.set(shiftMonth(1))">›</button>
        <div class="flex-1"></div>
        <button class="btn" type="button" (click)="salaries()"><app-icon name="user" [size]="15" /> {{ lang.t('Generate salaries for this month', 'إنشاء مرتبات هذا الشهر') }}</button>
      </div>
      <div class="grid gap-3 grid-cols-1 lg:grid-cols-2">
        <div class="card card-pad">
          <div class="card-title mb-2">{{ lang.t('Expenses by category', 'المصروفات حسب التصنيف') }}</div>
          @if (summary().rows.length) {
            <app-chart type="doughnut" [labels]="summary().labels" [datasets]="[{ label: '', data: summary().values }]" [height]="240" />
          } @else {
            <app-empty-state icon="wallet" [title]="lang.t('No expenses this month', 'لا توجد مصروفات هذا الشهر')" />
          }
        </div>
        <div class="card card-pad">
          <div class="card-title mb-2">{{ lang.t('Totals', 'الإجماليات') }}</div>
          @for (r of summary().rows; track r.label) {
            <div class="flex justify-between py-1.5 border-b border-line text-[13px]"><span>{{ r.label }}</span><b>{{ lang.money(r.amount) }}</b></div>
          }
          <div class="flex justify-between py-2 text-[14px]"><span>{{ lang.t('Total expenses', 'إجمالي المصروفات') }}</span><b>{{ lang.money(summary().total) }}</b></div>
          <div class="flex justify-between text-[13px]"><span>{{ lang.t('Other income received', 'إيرادات أخرى مستلمة') }}</span><b>{{ lang.money(summary().income) }}</b></div>
        </div>
      </div>
    } @else {
      <div class="card">
        <div class="flex flex-wrap items-center gap-2 p-3 border-b border-line">
          <input class="input" style="max-width: 240px" [placeholder]="lang.t('Search…', 'بحث…')" [value]="search()" (input)="search.set($any($event.target).value)" />
          <select class="select" style="width: auto" (change)="typeFilter.set($any($event.target).value)">
            <option value="">{{ lang.t('Income & expenses', 'الكل') }}</option>
            <option value="expense">{{ lang.t('Expenses', 'المصروفات') }}</option>
            <option value="income">{{ lang.t('Income', 'الإيرادات') }}</option>
          </select>
          <select class="select" style="width: auto" (change)="catFilter.set($any($event.target).value)">
            <option value="">{{ lang.t('All categories', 'كل التصنيفات') }}</option>
            @for (c of allCats; track c.value) {<option [value]="c.value">{{ lang.l(c.label) }}</option>}
          </select>
          <label class="flex items-center gap-1.5 text-[13px]"><input type="checkbox" [checked]="onlyUnpaid()" (change)="onlyUnpaid.set($any($event.target).checked)" /> {{ lang.t('Unpaid only', 'غير المسدد فقط') }}</label>
        </div>
        @if (loading()) { <app-loading /> }
        @else if (!view().length) { <app-empty-state icon="wallet" [title]="lang.t('No transactions', 'لا توجد حركات')" /> }
        @else {
          <div class="table-wrap"><table class="table">
            <thead><tr><th>{{ lang.t('Date', 'التاريخ') }}</th><th>{{ lang.t('Description', 'الوصف') }}</th><th>{{ lang.t('Category', 'التصنيف') }}</th><th>{{ lang.t('Related', 'مرتبط بـ') }}</th><th>{{ lang.t('Status', 'الحالة') }}</th><th class="num">{{ lang.t('Amount', 'المبلغ') }}</th><th></th></tr></thead>
            <tbody>
              @for (t of view(); track t.id) {
                <tr [style.opacity]="t.voided ? 0.5 : 1">
                  <td>{{ lang.date(t.date) }}</td>
                  <td>{{ t.description || '—' }} @if (t.supplier) {<span class="text-muted">· {{ t.supplier }}</span>}</td>
                  <td><app-badge [color]="color(t)">{{ catLabel(t) }}</app-badge></td>
                  <td class="text-[12.5px] text-muted">{{ related(t) }}</td>
                  <td>
                    @if (t.voided) {<app-badge color="red">{{ lang.t('Voided', 'ملغاة') }}</app-badge>}
                    @else if (t.type === 'expense' && !t.paid) {<app-badge color="amber">{{ lang.t('Payable', 'مستحق السداد') }}</app-badge>}
                    @else {<app-badge color="green">{{ t.type === 'income' ? lang.t('Received', 'مستلم') : lang.t('Paid', 'مدفوع') }}</app-badge>}
                  </td>
                  <td class="num" [style.color]="t.type === 'income' ? 'var(--success)' : ''">{{ t.type === 'income' ? '+' : '−' }} {{ lang.money(t.amount) }}</td>
                  <td>
                    <div class="flex justify-end gap-0.5">
                      @if (!t.voided && t.type === 'expense' && !t.paid) {<button class="btn btn-sm" type="button" (click)="pay(t)">{{ lang.t('Pay', 'سداد') }}</button>}
                      @if (!t.voided) {<button class="icon-btn" style="color: var(--danger)" type="button" [title]="lang.t('Void', 'إلغاء')" (click)="voidIt(t)"><app-icon name="x" [size]="16" /></button>}
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table></div>
        }
      </div>
    }

    @if (formOpen()) {
      <app-modal [title]="form().type === 'expense' ? lang.t('New expense', 'مصروف جديد') : lang.t('New income', 'إيراد جديد')" [wide]="true" (closed)="formOpen.set(false)">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label class="label">{{ lang.t('Amount (EGP)', 'المبلغ (ج.م)') }} *</label><input class="input" [class.invalid]="errs().amount" type="number" min="0" step="0.01" [value]="form().amount" (input)="patch({ amount: $any($event.target).value })" />@if (errs().amount) {<div class="field-error">{{ errs().amount }}</div>}</div>
          <div><label class="label">{{ lang.t('Date', 'التاريخ') }} *</label><input class="input" type="date" [value]="form().date" (change)="patch({ date: $any($event.target).value })" /></div>
          <div><label class="label">{{ lang.t('Category', 'التصنيف') }} *</label>
            <select class="select" (change)="patch({ category: $any($event.target).value })">
              @for (c of formCats(); track c.value) {<option [value]="c.value" [selected]="form().category === c.value">{{ lang.l(c.label) }}</option>}
            </select></div>
          <div><label class="label">{{ lang.t('Payment method', 'طريقة الدفع') }}</label>
            <select class="select" (change)="patch({ paymentMethod: $any($event.target).value })">
              @for (m of methods; track m.value) {<option [value]="m.value" [selected]="form().paymentMethod === m.value">{{ lang.l(m.label) }}</option>}
            </select></div>
          <div class="sm:col-span-2"><label class="label">{{ lang.t('Description', 'الوصف') }} *</label><input class="input" [class.invalid]="errs().description" [value]="form().description" (input)="patch({ description: $any($event.target).value })" />@if (errs().description) {<div class="field-error">{{ errs().description }}</div>}</div>
          @if (form().type === 'expense') {
            <div class="sm:col-span-2"><label class="flex items-center gap-2 text-[13px]"><input type="checkbox" [checked]="form().paid" (change)="patch({ paid: $any($event.target).checked })" /> {{ lang.t('Paid now (uncheck to record as a payable bill)', 'مدفوع الآن (ألغِ التحديد لتسجيله كفاتورة مستحقة السداد)') }}</label></div>
            <div><label class="label">{{ lang.t('Supplier', 'المورد') }}</label><input class="input" [value]="form().supplier" (input)="patch({ supplier: $any($event.target).value })" /></div>
            <div><label class="label">{{ lang.t('Related employee', 'الموظف المرتبط') }}</label>
              <select class="select" (change)="patch({ employeeId: $any($event.target).value })"><option value="">—</option>@for (e of employees(); track e.id) {<option [value]="e.id" [selected]="form().employeeId === e.id">{{ e.fullName }}</option>}</select></div>
          }
          <div><label class="label">{{ lang.t('Related client', 'العميل المرتبط') }}</label>
            <select class="select" (change)="patch({ clientId: $any($event.target).value })"><option value="">—</option>@for (c of clients(); track c.id) {<option [value]="c.id" [selected]="form().clientId === c.id">{{ c.name }}</option>}</select></div>
          <div><label class="label">{{ lang.t('Related project', 'المشروع المرتبط') }}</label>
            <select class="select" (change)="patch({ projectId: $any($event.target).value })"><option value="">—</option>@for (p of projects(); track p.id) {<option [value]="p.id" [selected]="form().projectId === p.id">{{ p.name }}</option>}</select></div>
          <div><label class="label">{{ lang.t('Service (for profitability analysis)', 'الخدمة (لتحليل الربحية)') }}</label>
            <select class="select" (change)="patch({ service: $any($event.target).value })"><option value="">—</option>@for (s of services; track s.value) {<option [value]="s.value" [selected]="form().service === s.value">{{ lang.l(s.label) }}</option>}</select></div>
          <div class="sm:col-span-2"><label class="label">{{ lang.t('Notes', 'ملاحظات') }}</label><textarea class="textarea" [value]="form().notes" (input)="patch({ notes: $any($event.target).value })"></textarea></div>
        </div>
        @if (formError()) {<div class="field-error mt-2">{{ formError() }}</div>}
        <div class="flex justify-end gap-2 mt-4">
          <button class="btn" type="button" (click)="formOpen.set(false)">{{ lang.t('Cancel', 'إلغاء') }}</button>
          <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="save()">{{ lang.t('Save & post', 'حفظ وترحيل') }}</button>
        </div>
      </app-modal>
    }

    @if (payFor(); as t) {
      <app-modal [title]="lang.t('Pay bill', 'سداد مستحق')" (closed)="payFor.set(null)">
        <div class="text-[13px] mb-3">{{ t.description }} — <b>{{ lang.money(t.amount) }}</b></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label">{{ lang.t('Payment date', 'تاريخ السداد') }}</label><input class="input" type="date" [value]="payDate()" (change)="payDate.set($any($event.target).value)" /></div>
          <div><label class="label">{{ lang.t('Method', 'الطريقة') }}</label><select class="select" (change)="payMethod.set($any($event.target).value)">@for (m of methods; track m.value) {<option [value]="m.value" [selected]="payMethod() === m.value">{{ lang.l(m.label) }}</option>}</select></div>
        </div>
        @if (formError()) {<div class="field-error mt-2">{{ formError() }}</div>}
        <div class="flex justify-end gap-2 mt-4">
          <button class="btn" type="button" (click)="payFor.set(null)">{{ lang.t('Cancel', 'إلغاء') }}</button>
          <button class="btn btn-primary" type="button" (click)="confirmPay(t)">{{ lang.t('Pay', 'سداد') }}</button>
        </div>
      </app-modal>
    }
  `,
})
export class TransactionsPage implements OnInit {
  readonly clientId = input('');
  readonly projectId = input('');
  readonly embedded = input(false);

  protected readonly lang = inject(LanguageService);
  private readonly data = inject(DataService);
  private readonly acc: AccSvc = inject(AccountingService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly methods = PAYMENT_METHODS;
  protected readonly services = SERVICE_TYPES;
  protected readonly allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  protected readonly tab = signal<'list' | 'summary' | 'recurring'>('list');
  protected readonly loading = signal(true);
  protected readonly txs = signal<FinTransaction[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly employees = signal<Employee[]>([]);
  protected readonly search = signal('');
  protected readonly typeFilter = signal('');
  protected readonly catFilter = signal('');
  protected readonly onlyUnpaid = signal(false);
  protected readonly month = signal(cairoMonth());
  protected readonly busy = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly errs = signal<{ amount?: string; description?: string }>({});
  protected readonly form = signal<TxForm>(this.blank('expense'));
  protected readonly payFor = signal<FinTransaction | null>(null);
  protected readonly payDate = signal(cairoDate());
  protected readonly payMethod = signal('cash');

  protected readonly recurringConfig: EntityConfig = {
    table: 'recurringExpenses',
    title: { en: 'Recurring expenses', ar: 'مصروفات متكررة' },
    singular: { en: 'Recurring expense', ar: 'مصروف متكرر' },
    icon: 'refresh',
    titleOf: (r) => r.name,
    searchKeys: ['name', 'supplier'],
    defaultSort: { key: 'name', dir: 'asc' },
    columns: [
      { key: 'name', label: { en: 'Name', ar: 'الاسم' } },
      { key: 'category', label: { en: 'Category', ar: 'التصنيف' }, type: 'badge', options: EXPENSE_CATEGORIES },
      { key: 'amount', label: { en: 'Amount', ar: 'المبلغ' }, type: 'money' },
      { key: 'dayOfMonth', label: { en: 'Day of month', ar: 'يوم الشهر' }, type: 'number' },
      { key: 'startDate', label: { en: 'Starts', ar: 'يبدأ' }, type: 'date' },
      { key: 'active', label: { en: 'Active', ar: 'نشط' }, type: 'bool' },
      { key: 'lastGeneratedMonth', label: { en: 'Last generated', ar: 'آخر توليد' } },
    ],
    fields: [
      { key: 'name', label: { en: 'Name', ar: 'الاسم' }, type: 'text', required: true, colSpan: 2 },
      { key: 'amount', label: { en: 'Amount (EGP)', ar: 'المبلغ (ج.م)' }, type: 'money', required: true, min: 0.01 },
      { key: 'category', label: { en: 'Category', ar: 'التصنيف' }, type: 'select', options: EXPENSE_CATEGORIES, required: true, default: 'rent_utilities' },
      { key: 'dayOfMonth', label: { en: 'Day of month (1-28)', ar: 'يوم الشهر (1-28)' }, type: 'number', required: true, min: 1, max: 28, default: 1 },
      { key: 'startDate', label: { en: 'Start date', ar: 'تاريخ البدء' }, type: 'date', required: true, default: '$today' },
      { key: 'endDate', label: { en: 'End date (optional)', ar: 'تاريخ الانتهاء (اختياري)' }, type: 'date' },
      { key: 'paymentMethod', label: { en: 'Payment method', ar: 'طريقة الدفع' }, type: 'select', options: PAYMENT_METHODS, required: true, default: 'cash' },
      { key: 'supplier', label: { en: 'Supplier', ar: 'المورد' }, type: 'text' },
      { key: 'autoPaid', label: { en: 'Mark as paid when generated', ar: 'اعتبره مدفوعًا عند التوليد' }, type: 'checkbox', default: true },
      { key: 'active', label: { en: 'Active', ar: 'نشط' }, type: 'checkbox', default: true },
    ],
    toolbar: [{ icon: 'refresh', label: { en: 'Generate due now', ar: 'توليد المستحق الآن' }, run: async (api) => { const n = await this.acc.generateRecurring(cairoDate()); this.toast.info(this.lang.t('Generated: ', 'تم توليد: ') + n); await api.reload(); await this.load(); } }],
    beforeSave: (v) => ({ ...v, endDate: v['endDate'] || undefined }),
  };

  protected readonly formCats = computed(() => (this.form().type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES));

  protected readonly view = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.txs()
      .filter((t) => (!this.clientId() || t.clientId === this.clientId()) && (!this.projectId() || t.projectId === this.projectId()))
      .filter((t) => !this.typeFilter() || t.type === this.typeFilter())
      .filter((t) => !this.catFilter() || t.category === this.catFilter())
      .filter((t) => !this.onlyUnpaid() || (t.type === 'expense' && !t.paid && !t.voided))
      .filter((t) => !q || (t.description + ' ' + t.supplier + ' ' + t.notes).toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  protected readonly summary = computed(() => {
    const m = this.month();
    const L = this.lang.lang();
    const list = this.txs().filter((t) => !t.voided && t.date.startsWith(m));
    const by = new Map<string, number>();
    for (const t of list.filter((x) => x.type === 'expense')) by.set(t.category, (by.get(t.category) || 0) + t.amount);
    const rows = Array.from(by.entries()).map(([k, v]) => ({ label: optionLabel(EXPENSE_CATEGORIES, k, L), amount: sum([v]) })).sort((a, b) => b.amount - a.amount);
    return {
      rows,
      labels: rows.map((r) => r.label),
      values: rows.map((r) => r.amount),
      total: sum(rows.map((r) => r.amount)),
      income: sum(list.filter((t) => t.type === 'income').map((t) => t.amount)),
    };
  });

  private blank(type: 'income' | 'expense'): TxForm {
    return { type, amount: '', category: type === 'expense' ? 'other' : 'service_revenue', date: cairoDate(), description: '', paymentMethod: 'cash', paid: true, clientId: '', projectId: '', employeeId: '', supplier: '', service: '', notes: '' };
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const s = await this.data.snapshot();
    this.txs.set(s.transactions);
    this.clients.set(s.clients.filter((c) => !c.archived));
    this.projects.set(s.projects.filter((p) => !p.archived));
    this.employees.set(s.employees.filter((e) => !e.archived));
    this.loading.set(false);
  }

  protected shiftMonth(n: number): string {
    return addMonths(this.month(), n);
  }
  protected color(t: FinTransaction): string {
    return optionColor(t.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES, t.category);
  }
  protected catLabel(t: FinTransaction): string {
    return optionLabel(t.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES, t.category, this.lang.lang());
  }
  protected related(t: FinTransaction): string {
    const parts: string[] = [];
    const c = this.clients().find((x) => x.id === t.clientId);
    const p = this.projects().find((x) => x.id === t.projectId);
    const e = this.employees().find((x) => x.id === t.employeeId);
    if (c) parts.push(c.name);
    if (p) parts.push(p.name);
    if (e) parts.push(e.fullName);
    return parts.join(' · ');
  }

  protected patch(p: Partial<TxForm>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }

  protected open(type: 'income' | 'expense'): void {
    this.form.set({ ...this.blank(type), clientId: this.clientId(), projectId: this.projectId() });
    this.errs.set({});
    this.formError.set('');
    this.formOpen.set(true);
  }

  protected async save(): Promise<void> {
    const f = this.form();
    const errs: { amount?: string; description?: string } = {};
    if (!(Number(f.amount) > 0)) errs.amount = this.lang.t('Enter an amount greater than zero', 'أدخل مبلغًا أكبر من صفر');
    if (!f.description.trim()) errs.description = this.lang.t('Description is required', 'الوصف مطلوب');
    this.errs.set(errs);
    if (errs.amount || errs.description) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      await this.acc.recordTransaction({
        type: f.type,
        amount: Number(f.amount),
        category: f.category,
        date: f.date,
        description: f.description.trim(),
        paymentMethod: f.paymentMethod,
        paid: f.paid,
        clientId: f.clientId || undefined,
        projectId: f.projectId || undefined,
        employeeId: f.employeeId || undefined,
        supplier: f.supplier,
        service: f.service,
        notes: f.notes,
      });
      this.toast.success(this.lang.t('Posted successfully', 'تم الترحيل بنجاح'));
      this.formOpen.set(false);
      await this.load();
    } catch (e: any) {
      this.formError.set(String(e?.message || e));
    } finally {
      this.busy.set(false);
    }
  }

  protected pay(t: FinTransaction): void {
    this.payDate.set(cairoDate());
    this.payMethod.set(t.paymentMethod || 'cash');
    this.formError.set('');
    this.payFor.set(t);
  }

  protected async confirmPay(t: FinTransaction): Promise<void> {
    try {
      await this.acc.payTransaction(t.id, this.payDate(), this.payMethod());
      this.toast.success(this.lang.t('Bill paid', 'تم السداد'));
      this.payFor.set(null);
      await this.load();
    } catch (e: any) {
      this.formError.set(String(e?.message || e));
    }
  }

  protected async voidIt(t: FinTransaction): Promise<void> {
    const r = await this.confirm.ask({ titleEn: 'Void transaction', titleAr: 'إلغاء المعاملة', messageEn: 'Documented reversal entries will be posted. The original record stays in history.', messageAr: 'سيتم ترحيل قيود عكسية موثقة. يبقى السجل الأصلي في السجل التاريخي.', danger: true, askReason: true, confirmEn: 'Void', confirmAr: 'إلغاء' });
    if (!r.ok) return;
    try {
      await this.acc.voidTransaction(t.id, r.reason);
      this.toast.success(this.lang.t('Voided', 'تم الإلغاء'));
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }

  protected async salaries(): Promise<void> {
    const m = this.month();
    const ok = await this.confirm.confirm({ titleEn: 'Generate salaries', titleAr: 'إنشاء المرتبات', messageEn: 'Create a paid salary expense for each active employee for ' + m + ' (skips employees already recorded).', messageAr: 'إنشاء مصروف مرتب مدفوع لكل موظف نشط عن ' + m + ' (يتخطى من تم تسجيله).' });
    if (!ok) return;
    try {
      const n = await this.acc.generateSalaries(m, 'bank');
      this.toast.success(this.lang.t('Salary entries created: ', 'تم إنشاء مرتبات: ') + n);
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }
}
