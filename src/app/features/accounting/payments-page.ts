import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DataService } from '../../core/services/data.service';
import { AccountingService } from '../../core/accounting/accounting.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { Invoice, Payment } from '../../core/models/accounting';
import { PAYMENT_METHODS, optionLabel } from '../../core/constants/options';
import { PageHeader } from '../../shared/components/page-header';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Loading } from '../../shared/components/state-views';

@Component({
  selector: 'app-payments-page',
  imports: [PageHeader, Badge, Icon, EmptyState, Loading],
  template: `
    @if (!embedded()) {
      <app-page-header [title]="lang.t('Payments', 'المدفوعات')" [subtitle]="lang.t('Payments are separate records linked to invoices. Record new payments from the Invoices page.', 'المدفوعات سجلات منفصلة مرتبطة بالفواتير. سجّل دفعة جديدة من صفحة الفواتير.')" />
    }
    <div class="card">
      <div class="flex flex-wrap items-center gap-2 p-3 border-b border-line">
        <input class="input" style="max-width: 240px" [placeholder]="lang.t('Search…', 'بحث…')" [value]="search()" (input)="search.set($any($event.target).value)" />
        <div class="flex-1"></div>
        <span class="text-[12.5px] text-muted">{{ lang.t('Cash collected: ', 'النقدية المحصّلة: ') }}<b style="color: var(--success)">{{ lang.money(total()) }}</b></span>
      </div>
      @if (loading()) { <app-loading /> }
      @else if (!view().length) { <app-empty-state icon="wallet" [title]="lang.t('No payments yet', 'لا توجد مدفوعات بعد')" /> }
      @else {
        <div class="table-wrap"><table class="table">
          <thead><tr><th>{{ lang.t('Payment', 'الدفعة') }}</th><th>{{ lang.t('Date', 'التاريخ') }}</th><th>{{ lang.t('Client', 'العميل') }}</th><th>{{ lang.t('Invoice', 'الفاتورة') }}</th><th>{{ lang.t('Method', 'الطريقة') }}</th><th class="num">{{ lang.t('Amount', 'المبلغ') }}</th><th></th></tr></thead>
          <tbody>
            @for (p of view(); track p.id) {
              <tr [style.opacity]="p.voided ? 0.5 : 1">
                <td><b>{{ p.number }}</b> @if (p.voided) {<app-badge color="red">{{ lang.t('Voided', 'ملغاة') }}</app-badge>}</td>
                <td>{{ lang.date(p.date) }}</td>
                <td>{{ client(p.clientId) }}</td>
                <td>{{ invoice(p.invoiceId) }}</td>
                <td>{{ method(p.method) }}</td>
                <td class="num">{{ lang.money(p.amount) }}</td>
                <td>@if (!p.voided) {<button class="icon-btn" style="color: var(--danger)" type="button" [title]="lang.t('Void payment', 'إلغاء الدفعة')" (click)="voidIt(p)"><app-icon name="x" [size]="16" /></button>}</td>
              </tr>
            }
          </tbody>
        </table></div>
      }
    </div>
  `,
})
export class PaymentsPage implements OnInit {
  readonly clientId = input('');
  readonly embedded = input(false);
  protected readonly lang = inject(LanguageService);
  private readonly data = inject(DataService);
  private readonly acc = inject(AccountingService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly names = signal<Record<string, string>>({});
  protected readonly search = signal('');
  protected readonly view = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.payments()
      .filter((p) => !this.clientId() || p.clientId === this.clientId())
      .filter((p) => !q || (p.number + ' ' + this.client(p.clientId) + ' ' + this.invoice(p.invoiceId)).toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  });
  protected readonly total = computed(() => this.view().filter((p) => !p.voided).reduce((a, p) => a + p.amount, 0));

  ngOnInit(): void {
    void this.load();
  }
  async load(): Promise<void> {
    const s = await this.data.snapshot();
    this.payments.set(s.payments);
    this.invoices.set(s.invoices);
    this.names.set(Object.fromEntries(s.clients.map((c) => [c.id, c.name])));
    this.loading.set(false);
  }
  protected client(id: string): string {
    return this.names()[id] || '—';
  }
  protected invoice(id: string): string {
    return this.invoices().find((i) => i.id === id)?.number || '—';
  }
  protected method(m: string): string {
    return optionLabel(PAYMENT_METHODS, m, this.lang.lang());
  }
  protected async voidIt(p: Payment): Promise<void> {
    const r = await this.confirm.ask({ titleEn: 'Void payment', titleAr: 'إلغاء الدفعة', messageEn: 'A reversal entry will be posted and the invoice balance restored.', messageAr: 'سيتم ترحيل قيد عكسي وإعادة رصيد الفاتورة.', danger: true, askReason: true, confirmEn: 'Void', confirmAr: 'إلغاء الدفعة' });
    if (!r.ok) return;
    try {
      await this.acc.voidPayment(p.id, r.reason);
      this.toast.success(this.lang.t('Payment voided', 'تم إلغاء الدفعة'));
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }
}
