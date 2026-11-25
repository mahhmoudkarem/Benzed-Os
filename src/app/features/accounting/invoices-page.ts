import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DataService } from '../../core/services/data.service';
import { DbService } from '../../core/services/db.service';
import { AccountingService } from '../../core/accounting/accounting.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { Invoice, InvoiceItem, Payment } from '../../core/models/accounting';
import { Client, Project } from '../../core/models/business';
import { PAYMENT_METHODS, SERVICE_TYPES, optionLabel } from '../../core/constants/options';
import { invoiceTotals } from '../../core/accounting/ledger';
import { remaining } from '../../core/accounting/metrics';
import { addDays, cairoDate } from '../../core/utils/date';
import { PageHeader } from '../../shared/components/page-header';
import { Modal } from '../../shared/components/modal';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { EmptyState, ErrorState, Loading } from '../../shared/components/state-views';

interface InvForm {
  id?: string;
  clientId: string;
  projectId: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  discount: number;
  taxRate: number;
  notes: string;
}

type StatusKey = 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled';

@Component({
  selector: 'app-invoices-page',
  imports: [PageHeader, Modal, Badge, Icon, EmptyState, ErrorState, Loading],
  template: `
    @if (!embedded()) {
      <app-page-header [title]="lang.t('Invoices', 'الفواتير')" [subtitle]="lang.t('Outstanding invoices are receivables — they are not cash until a payment is recorded.', 'الفواتير المستحقة هي مديونيات — لا تُعد نقدية إلا بعد تسجيل دفعة.')">
        <button class="btn btn-primary" type="button" (click)="openNew()"><app-icon name="plus" [size]="15" /> {{ lang.t('New invoice', 'فاتورة جديدة') }}</button>
      </app-page-header>
    } @else {
      <div class="flex justify-end mb-2"><button class="btn btn-primary btn-sm" type="button" (click)="openNew()"><app-icon name="plus" [size]="14" /> {{ lang.t('New invoice', 'فاتورة جديدة') }}</button></div>
    }

    <div class="card">
      <div class="flex flex-wrap items-center gap-2 p-3 border-b border-line">
        <input class="input" style="max-width: 240px" [placeholder]="lang.t('Search number or client…', 'بحث بالرقم أو العميل…')" [value]="search()" (input)="search.set($any($event.target).value)" />
        <select class="select" style="width: auto" (change)="statusFilter.set($any($event.target).value)">
          <option value="">{{ lang.t('All statuses', 'كل الحالات') }}</option>
          @for (s of statusList; track s) {<option [value]="s">{{ statusLabel(s) }}</option>}
        </select>
        <div class="flex-1"></div>
        <span class="text-[12.5px] text-muted">{{ lang.t('Outstanding: ', 'المستحق: ') }}<b style="color: var(--warning)">{{ lang.money(totalOutstanding()) }}</b></span>
      </div>
      @if (loading()) { <app-loading /> }
      @else if (error()) { <app-error-state [message]="error()" /> }
      @else if (!view().length) { <app-empty-state icon="file" [title]="lang.t('No invoices', 'لا توجد فواتير')" /> }
      @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th>{{ lang.t('Number', 'الرقم') }}</th><th>{{ lang.t('Client', 'العميل') }}</th><th>{{ lang.t('Issue', 'الإصدار') }}</th><th>{{ lang.t('Due', 'الاستحقاق') }}</th>
              <th class="num">{{ lang.t('Total', 'الإجمالي') }}</th><th class="num">{{ lang.t('Paid', 'المدفوع') }}</th><th class="num">{{ lang.t('Remaining', 'المتبقي') }}</th><th>{{ lang.t('Status', 'الحالة') }}</th><th></th>
            </tr></thead>
            <tbody>
              @for (i of view(); track i.id) {
                <tr>
                  <td><b>{{ i.number }}</b></td>
                  <td>{{ clientName(i.clientId) }}</td>
                  <td>{{ lang.date(i.issueDate) }}</td>
                  <td>{{ lang.date(i.dueDate) }}</td>
                  <td class="num">{{ lang.money(i.total) }}</td>
                  <td class="num">{{ lang.money(i.amountPaid) }}</td>
                  <td class="num"><b>{{ i.status === 'cancelled' || i.status === 'draft' ? '—' : lang.money(rem(i)) }}</b></td>
                  <td><app-badge [color]="statusColor(statusOf(i))">{{ statusLabel(statusOf(i)) }}</app-badge></td>
                  <td>
                    <div class="flex justify-end gap-0.5">
                      <button class="icon-btn" type="button" [title]="lang.t('View', 'عرض')" (click)="viewing.set(i)"><app-icon name="eye" [size]="16" /></button>
                      @if (i.status === 'draft') {
                        <button class="icon-btn" type="button" [title]="lang.t('Edit', 'تعديل')" (click)="openEdit(i)"><app-icon name="edit" [size]="16" /></button>
                        <button class="btn btn-sm" type="button" (click)="issue(i)">{{ lang.t('Issue', 'إصدار') }}</button>
                        <button class="icon-btn" style="color: var(--danger)" type="button" (click)="deleteDraft(i)"><app-icon name="trash" [size]="16" /></button>
                      }
                      @if (i.status === 'issued' || i.status === 'partial') {
                        <button class="btn btn-sm btn-primary" type="button" (click)="openPay(i)">{{ lang.t('Record payment', 'تسجيل دفعة') }}</button>
                      }
                      @if (i.status === 'issued') {
                        <button class="btn btn-sm" type="button" (click)="cancel(i)">{{ lang.t('Cancel', 'إلغاء') }}</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (formOpen()) {
      <app-modal [title]="form().id ? lang.t('Edit draft invoice', 'تعديل مسودة فاتورة') : lang.t('New invoice', 'فاتورة جديدة')" [wide]="true" (closed)="formOpen.set(false)">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="label">{{ lang.t('Client', 'العميل') }} *</label>
            <select class="select" [class.invalid]="formErr().clientId" (change)="setClient($any($event.target).value)">
              <option value="">{{ lang.t('Select…', 'اختر…') }}</option>
              @for (c of clients(); track c.id) {<option [value]="c.id" [selected]="form().clientId === c.id">{{ c.name }}</option>}
            </select>
            @if (formErr().clientId) {<div class="field-error">{{ formErr().clientId }}</div>}
          </div>
          <div>
            <label class="label">{{ lang.t('Project (optional)', 'المشروع (اختياري)') }}</label>
            <select class="select" (change)="patch({ projectId: $any($event.target).value })">
              <option value="">—</option>
              @for (p of clientProjects(); track p.id) {<option [value]="p.id" [selected]="form().projectId === p.id">{{ p.name }}</option>}
            </select>
          </div>
          <div><label class="label">{{ lang.t('Issue date', 'تاريخ الإصدار') }} *</label><input class="input" type="date" [value]="form().issueDate" (change)="patch({ issueDate: $any($event.target).value })" /></div>
          <div><label class="label">{{ lang.t('Due date', 'تاريخ الاستحقاق') }} *</label><input class="input" type="date" [value]="form().dueDate" (change)="patch({ dueDate: $any($event.target).value })" /></div>
        </div>

        <div class="label mt-4">{{ lang.t('Items', 'البنود') }}</div>
        @for (it of form().items; track $index) {
          <div class="grid gap-2 mb-2" style="grid-template-columns: 2fr 1.2fr .7fr 1fr auto">
            <input class="input" [placeholder]="lang.t('Description', 'الوصف')" [value]="it.description" (input)="setItem($index, 'description', $any($event.target).value)" />
            <select class="select" (change)="setItem($index, 'service', $any($event.target).value)">
              @for (s of services; track s.value) {<option [value]="s.value" [selected]="it.service === s.value">{{ lang.l(s.label) }}</option>}
            </select>
            <input class="input" type="number" min="0" step="any" [value]="it.quantity" (input)="setItem($index, 'quantity', $any($event.target).value)" />
            <input class="input" type="number" min="0" step="0.01" [value]="it.unitPrice" (input)="setItem($index, 'unitPrice', $any($event.target).value)" />
            <button class="icon-btn" style="color: var(--danger)" type="button" (click)="removeItem($index)"><app-icon name="trash" [size]="15" /></button>
          </div>
        }
        @if (formErr().items) {<div class="field-error">{{ formErr().items }}</div>}
        <button class="btn btn-sm" type="button" (click)="addItem()"><app-icon name="plus" [size]="14" /> {{ lang.t('Add item', 'إضافة بند') }}</button>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div><label class="label">{{ lang.t('Discount (EGP)', 'الخصم (ج.م)') }}</label><input class="input" type="number" min="0" step="0.01" [value]="form().discount" (input)="patch({ discount: +$any($event.target).value })" /></div>
          <div><label class="label">{{ lang.t('Tax rate %', 'نسبة الضريبة %') }}</label><input class="input" type="number" min="0" max="100" step="0.01" [value]="form().taxRate" (input)="patch({ taxRate: +$any($event.target).value })" /></div>
          <div class="sm:col-span-2"><label class="label">{{ lang.t('Notes', 'ملاحظات') }}</label><textarea class="textarea" [value]="form().notes" (input)="patch({ notes: $any($event.target).value })"></textarea></div>
        </div>
        <div class="mt-4 p-3 rounded-lg text-[13px]" style="background: var(--surface-2)">
          <div class="flex justify-between"><span>{{ lang.t('Subtotal', 'المجموع') }}</span><b>{{ lang.money(totals().subtotal) }}</b></div>
          <div class="flex justify-between"><span>{{ lang.t('Discount', 'الخصم') }}</span><b>− {{ lang.money(totals().discount) }}</b></div>
          <div class="flex justify-between"><span>{{ lang.t('Tax', 'الضريبة') }}</span><b>{{ lang.money(totals().taxAmount) }}</b></div>
          <div class="flex justify-between text-[15px] mt-1"><span>{{ lang.t('Total', 'الإجمالي') }}</span><b>{{ lang.money(totals().total) }}</b></div>
        </div>
        @if (formError()) {<div class="field-error mt-2">{{ formError() }}</div>}
        <div class="flex justify-end gap-2 mt-4">
          <button class="btn" type="button" (click)="formOpen.set(false)">{{ lang.t('Cancel', 'إلغاء') }}</button>
          <button class="btn" type="button" [disabled]="busy()" (click)="save(false)">{{ lang.t('Save as draft', 'حفظ كمسودة') }}</button>
          <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="save(true)">{{ lang.t('Save & issue', 'حفظ وإصدار') }}</button>
        </div>
      </app-modal>
    }

    @if (payFor(); as inv) {
      <app-modal [title]="lang.t('Record payment — ', 'تسجيل دفعة — ') + inv.number" (closed)="payFor.set(null)">
        <div class="text-[13px] mb-3">{{ lang.t('Remaining balance: ', 'الرصيد المتبقي: ') }}<b>{{ lang.money(rem(inv)) }}</b></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label class="label">{{ lang.t('Amount', 'المبلغ') }} *</label><input class="input" type="number" min="0" step="0.01" [value]="pay().amount" (input)="patchPay({ amount: $any($event.target).value })" /></div>
          <div><label class="label">{{ lang.t('Date', 'التاريخ') }} *</label><input class="input" type="date" [value]="pay().date" (change)="patchPay({ date: $any($event.target).value })" /></div>
          <div><label class="label">{{ lang.t('Method', 'طريقة الدفع') }}</label>
            <select class="select" (change)="patchPay({ method: $any($event.target).value })">
              @for (m of methods; track m.value) {<option [value]="m.value" [selected]="pay().method === m.value">{{ lang.l(m.label) }}</option>}
            </select></div>
          <div><label class="label">{{ lang.t('Reference', 'المرجع') }}</label><input class="input" [value]="pay().reference" (input)="patchPay({ reference: $any($event.target).value })" /></div>
        </div>
        @if (formError()) {<div class="field-error mt-2">{{ formError() }}</div>}
        <div class="flex justify-end gap-2 mt-4">
          <button class="btn" type="button" (click)="payFor.set(null)">{{ lang.t('Cancel', 'إلغاء') }}</button>
          <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="savePay(inv)">{{ lang.t('Record payment', 'تسجيل الدفعة') }}</button>
        </div>
      </app-modal>
    }

    @if (viewing(); as v) {
      <app-modal [title]="v.number" [wide]="true" (closed)="viewing.set(null)">
        <div class="text-[13px] mb-3 flex flex-wrap gap-x-6 gap-y-1">
          <span>{{ lang.t('Client: ', 'العميل: ') }}<b>{{ clientName(v.clientId) }}</b></span>
          <span>{{ lang.t('Issued: ', 'الإصدار: ') }}<b>{{ lang.date(v.issueDate) }}</b></span>
          <span>{{ lang.t('Due: ', 'الاستحقاق: ') }}<b>{{ lang.date(v.dueDate) }}</b></span>
          <app-badge [color]="statusColor(statusOf(v))">{{ statusLabel(statusOf(v)) }}</app-badge>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>{{ lang.t('Description', 'الوصف') }}</th><th>{{ lang.t('Service', 'الخدمة') }}</th><th class="num">{{ lang.t('Qty', 'الكمية') }}</th><th class="num">{{ lang.t('Unit price', 'سعر الوحدة') }}</th><th class="num">{{ lang.t('Amount', 'المبلغ') }}</th></tr></thead>
          <tbody>
            @for (it of v.items; track $index) {
              <tr><td>{{ it.description }}</td><td>{{ svc(it.service) }}</td><td class="num">{{ lang.num(it.quantity, 2) }}</td><td class="num">{{ lang.money(it.unitPrice) }}</td><td class="num">{{ lang.money(it.quantity * it.unitPrice) }}</td></tr>
            }
          </tbody>
        </table></div>
        <div class="mt-3 text-[13px] flex flex-col items-end gap-0.5">
          <span>{{ lang.t('Subtotal: ', 'المجموع: ') }}<b>{{ lang.money(v.subtotal) }}</b></span>
          <span>{{ lang.t('Discount: ', 'الخصم: ') }}<b>{{ lang.money(v.discount) }}</b></span>
          <span>{{ lang.t('Tax: ', 'الضريبة: ') }}<b>{{ lang.money(v.taxAmount) }}</b></span>
          <span class="text-[15px]">{{ lang.t('Total: ', 'الإجمالي: ') }}<b>{{ lang.money(v.total) }}</b></span>
          <span>{{ lang.t('Paid: ', 'المدفوع: ') }}<b>{{ lang.money(v.amountPaid) }}</b> · {{ lang.t('Remaining: ', 'المتبقي: ') }}<b>{{ lang.money(rem(v)) }}</b></span>
        </div>
        <div class="label mt-4">{{ lang.t('Payments', 'المدفوعات') }}</div>
        @for (p of paymentsOf(v.id); track p.id) {
          <div class="flex justify-between text-[13px] py-1.5 border-b border-line" [style.opacity]="p.voided ? 0.5 : 1">
            <span>{{ p.number }} · {{ lang.date(p.date) }} · {{ method(p.method) }} @if (p.voided) {<app-badge color="red">{{ lang.t('Voided', 'ملغاة') }}</app-badge>}</span>
            <b>{{ lang.money(p.amount) }}</b>
          </div>
        } @empty {
          <div class="text-muted text-[13px]">{{ lang.t('No payments yet', 'لا توجد دفعات بعد') }}</div>
        }
      </app-modal>
    }
  `,
})
export class InvoicesPage implements OnInit {
  readonly clientId = input('');
  readonly projectId = input('');
  readonly embedded = input(false);

  protected readonly lang = inject(LanguageService);
  private readonly data = inject(DataService);
  private readonly db = inject(DbService).db;
  private readonly acc = inject(AccountingService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly services = SERVICE_TYPES;
  protected readonly methods = PAYMENT_METHODS;
  protected readonly statusList: StatusKey[] = ['draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled'];

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');
  protected readonly busy = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly formErr = signal<{ clientId?: string; items?: string }>({});
  protected readonly viewing = signal<Invoice | null>(null);
  protected readonly payFor = signal<Invoice | null>(null);
  protected readonly pay = signal({ amount: '', date: cairoDate(), method: 'cash', reference: '' });
  protected readonly form = signal<InvForm>(this.blank());

  protected readonly totals = computed(() => invoiceTotals(this.form().items, this.form().discount, this.form().taxRate));
  protected readonly clientProjects = computed(() => this.projects().filter((p) => p.clientId === this.form().clientId && !p.archived));

  protected readonly view = computed(() => {
    const q = this.search().trim().toLowerCase();
    const sf = this.statusFilter();
    return this.invoices()
      .filter((i) => (!this.clientId() || i.clientId === this.clientId()) && (!this.projectId() || i.projectId === this.projectId()))
      .filter((i) => !sf || this.statusOf(i) === sf)
      .filter((i) => !q || (i.number + ' ' + this.clientName(i.clientId)).toLowerCase().includes(q))
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number));
  });
  protected readonly totalOutstanding = computed(() => this.view().filter((i) => i.status === 'issued' || i.status === 'partial').reduce((a, i) => a + remaining(i), 0));

  private blank(): InvForm {
    return { clientId: '', projectId: '', issueDate: cairoDate(), dueDate: addDays(cairoDate(), 14), items: [{ description: '', service: 'other', quantity: 1, unitPrice: 0 }], discount: 0, taxRate: 0, notes: '' };
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const s = await this.data.snapshot();
      this.invoices.set(s.invoices);
      this.payments.set(s.payments);
      this.clients.set(s.clients.filter((c) => !c.archived));
      this.projects.set(s.projects);
      this.error.set('');
    } catch (e: any) {
      this.error.set(String(e?.message || e));
    } finally {
      this.loading.set(false);
    }
  }

  protected rem(i: Invoice): number {
    return remaining(i);
  }
  protected clientName(id: string): string {
    return this.clients().find((c) => c.id === id)?.name || (this.invoices().length ? '—' : '');
  }
  protected paymentsOf(id: string): Payment[] {
    return this.payments().filter((p) => p.invoiceId === id);
  }
  protected svc(v: string): string {
    return optionLabel(SERVICE_TYPES, v, this.lang.lang());
  }
  protected method(v: string): string {
    return optionLabel(PAYMENT_METHODS, v, this.lang.lang());
  }
  protected statusOf(i: Invoice): StatusKey {
    if ((i.status === 'issued' || i.status === 'partial') && i.dueDate < cairoDate()) return 'overdue';
    return i.status;
  }
  protected statusLabel(s: string): string {
    const m: Record<string, [string, string]> = { draft: ['Draft', 'مسودة'], issued: ['Issued', 'صادرة'], partial: ['Partially paid', 'مدفوعة جزئيًا'], paid: ['Paid', 'مدفوعة'], overdue: ['Overdue', 'متأخرة'], cancelled: ['Cancelled', 'ملغاة'] };
    return this.lang.t(m[s][0], m[s][1]);
  }
  protected statusColor(s: string): string {
    return ({ draft: 'gray', issued: 'blue', partial: 'amber', paid: 'green', overdue: 'red', cancelled: 'gray' } as Record<string, string>)[s];
  }

  // ---- form
  protected patch(p: Partial<InvForm>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }
  protected setClient(id: string): void {
    this.patch({ clientId: id, projectId: '' });
    this.formErr.update((e) => ({ ...e, clientId: '' }));
  }
  protected setItem(i: number, key: keyof InvoiceItem, value: any): void {
    this.form.update((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, [key]: key === 'quantity' || key === 'unitPrice' ? Number(value) : value } : it)) }));
  }
  protected addItem(): void {
    this.form.update((f) => ({ ...f, items: [...f.items, { description: '', service: 'other', quantity: 1, unitPrice: 0 }] }));
  }
  protected removeItem(i: number): void {
    this.form.update((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items }));
  }

  protected openNew(): void {
    this.form.set({ ...this.blank(), clientId: this.clientId(), projectId: this.projectId() });
    this.formErr.set({});
    this.formError.set('');
    this.formOpen.set(true);
  }
  protected openEdit(i: Invoice): void {
    this.form.set({ id: i.id, clientId: i.clientId, projectId: i.projectId || '', issueDate: i.issueDate, dueDate: i.dueDate, items: i.items.map((x) => ({ ...x })), discount: i.discount, taxRate: i.taxRate, notes: i.notes });
    this.formErr.set({});
    this.formError.set('');
    this.formOpen.set(true);
  }

  protected async save(issue: boolean): Promise<void> {
    const f = this.form();
    const errs: { clientId?: string; items?: string } = {};
    if (!f.clientId) errs.clientId = this.lang.t('Select a client', 'اختر العميل');
    if (!f.items.some((i) => i.description.trim() && i.quantity > 0)) errs.items = this.lang.t('Add at least one item with a description', 'أضف بندًا واحدًا على الأقل بوصف');
    this.formErr.set(errs);
    if (errs.clientId || errs.items) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      const inv = await this.acc.saveInvoice({ id: f.id, clientId: f.clientId, projectId: f.projectId || undefined, items: f.items.filter((i) => i.description.trim()), discount: f.discount, taxRate: f.taxRate, issueDate: f.issueDate, dueDate: f.dueDate, notes: f.notes }, issue);
      this.toast.success(this.lang.t('Invoice saved: ', 'تم حفظ الفاتورة: ') + inv.number);
      this.formOpen.set(false);
      await this.load();
    } catch (e: any) {
      this.formError.set(String(e?.message || e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async issue(i: Invoice): Promise<void> {
    try {
      await this.acc.issueInvoice(i.id);
      this.toast.success(this.lang.t('Invoice issued', 'تم إصدار الفاتورة'));
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }

  protected async deleteDraft(i: Invoice): Promise<void> {
    const ok = await this.confirm.confirm({ titleEn: 'Delete draft', titleAr: 'حذف المسودة', messageEn: 'Delete draft ' + i.number + '?', messageAr: 'حذف المسودة ' + i.number + '؟', danger: true, confirmEn: 'Delete', confirmAr: 'حذف' });
    if (!ok) return;
    try {
      await this.acc.deleteDraftInvoice(i.id);
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }

  protected async cancel(i: Invoice): Promise<void> {
    const r = await this.confirm.ask({ titleEn: 'Cancel invoice', titleAr: 'إلغاء الفاتورة', messageEn: 'A documented reversal entry will be posted for ' + i.number + '.', messageAr: 'سيتم ترحيل قيد عكسي موثّق للفاتورة ' + i.number + '.', danger: true, askReason: true, confirmEn: 'Cancel invoice', confirmAr: 'إلغاء الفاتورة' });
    if (!r.ok) return;
    try {
      await this.acc.cancelInvoice(i.id, r.reason);
      this.toast.success(this.lang.t('Invoice cancelled', 'تم إلغاء الفاتورة'));
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }

  // ---- payments
  protected openPay(i: Invoice): void {
    this.pay.set({ amount: String(remaining(i)), date: cairoDate(), method: 'cash', reference: '' });
    this.formError.set('');
    this.payFor.set(i);
  }
  protected patchPay(p: Partial<{ amount: string; date: string; method: string; reference: string }>): void {
    this.pay.update((x) => ({ ...x, ...p }));
  }
  protected async savePay(i: Invoice): Promise<void> {
    this.busy.set(true);
    this.formError.set('');
    try {
      const p = this.pay();
      await this.acc.recordPayment({ invoiceId: i.id, amount: Number(p.amount), date: p.date, method: p.method, reference: p.reference, notes: '' });
      this.toast.success(this.lang.t('Payment recorded', 'تم تسجيل الدفعة'));
      this.payFor.set(null);
      await this.load();
    } catch (e: any) {
      this.formError.set(String(e?.message || e));
    } finally {
      this.busy.set(false);
    }
  }
}
