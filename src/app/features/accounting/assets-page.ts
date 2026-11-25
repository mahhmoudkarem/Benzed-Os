import { Component, OnInit, inject, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DataService } from '../../core/services/data.service';
import { AccountingService } from '../../core/accounting/accounting.service';
import { ToastService } from '../../core/services/toast.service';
import { Asset } from '../../core/models/accounting';
import { PAYMENT_METHODS } from '../../core/constants/options';
import { DepRow, accumulatedThrough, depreciationSchedule } from '../../core/accounting/depreciation';
import { addMonths, cairoDate, cairoMonth } from '../../core/utils/date';
import { round2 } from '../../core/utils/money';
import { PageHeader } from '../../shared/components/page-header';
import { Modal } from '../../shared/components/modal';
import { Icon } from '../../shared/components/icon';
import { Badge } from '../../shared/components/badge';
import { EmptyState, Loading } from '../../shared/components/state-views';

interface AssetForm {
  name: string;
  purchaseDate: string;
  cost: string;
  life: string;
  salvage: string;
  method: string;
  paymentMethod: string;
  notes: string;
}

@Component({
  selector: 'app-assets-page',
  imports: [PageHeader, Modal, Icon, Badge, EmptyState, Loading],
  template: `
    <app-page-header [title]="lang.t('Equipment & assets', 'المعدات والأصول')" [subtitle]="lang.t('Purchases are capitalised (not expensed) and depreciated monthly.', 'المشتريات تُرسمل (لا تُحتسب مصروفًا مباشرًا) وتُهلك شهريًا.')">
      <button class="btn" type="button" [disabled]="busy()" (click)="runDep()"><app-icon name="refresh" [size]="15" /> {{ lang.t('Post depreciation', 'ترحيل الإهلاك') }}</button>
      <button class="btn btn-primary" type="button" (click)="open()"><app-icon name="plus" [size]="15" /> {{ lang.t('Purchase asset', 'شراء أصل') }}</button>
    </app-page-header>
    <div class="card">
      @if (loading()) { <app-loading /> }
      @else if (!assets().length) { <app-empty-state icon="cpu" [title]="lang.t('No assets yet', 'لا توجد أصول بعد')" /> }
      @else {
        <div class="table-wrap"><table class="table">
          <thead><tr>
            <th>{{ lang.t('Asset', 'الأصل') }}</th><th>{{ lang.t('Purchased', 'الشراء') }}</th><th class="num">{{ lang.t('Cost', 'التكلفة') }}</th>
            <th>{{ lang.t('Life', 'العمر') }}</th><th>{{ lang.t('Method', 'الطريقة') }}</th>
            <th class="num">{{ lang.t('Accumulated (posted)', 'المجمع (المرحّل)') }}</th><th class="num">{{ lang.t('Book value', 'القيمة الدفترية') }}</th><th></th>
          </tr></thead>
          <tbody>
            @for (a of assets(); track a.id) {
              <tr>
                <td><b>{{ a.name }}</b></td>
                <td>{{ lang.date(a.purchaseDate) }}</td>
                <td class="num">{{ lang.money(a.cost) }}</td>
                <td>{{ lang.num(a.usefulLifeMonths) }} {{ lang.t('mo', 'شهر') }}</td>
                <td><app-badge color="blue">{{ a.method === 'straight_line' ? lang.t('Straight-line', 'القسط الثابت') : lang.t('Declining balance', 'الرصيد المتناقص') }}</app-badge></td>
                <td class="num">{{ lang.money(a.accumulated) }}</td>
                <td class="num"><b>{{ lang.money(book(a)) }}</b></td>
                <td><button class="icon-btn" type="button" [title]="lang.t('Schedule', 'الجدول')" (click)="showSchedule(a)"><app-icon name="eye" [size]="16" /></button></td>
              </tr>
            }
          </tbody>
        </table></div>
      }
    </div>

    @if (formOpen()) {
      <app-modal [title]="lang.t('Purchase asset', 'شراء أصل')" (closed)="formOpen.set(false)">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2"><label class="label">{{ lang.t('Asset name', 'اسم الأصل') }} *</label><input class="input" [value]="f().name" (input)="patch({ name: $any($event.target).value })" /></div>
          <div><label class="label">{{ lang.t('Purchase date', 'تاريخ الشراء') }} *</label><input class="input" type="date" [value]="f().purchaseDate" (change)="patch({ purchaseDate: $any($event.target).value })" /></div>
          <div><label class="label">{{ lang.t('Purchase cost (EGP)', 'تكلفة الشراء (ج.م)') }} *</label><input class="input" type="number" min="0" step="0.01" [value]="f().cost" (input)="patch({ cost: $any($event.target).value })" /></div>
          <div><label class="label">{{ lang.t('Useful life (months)', 'العمر الإنتاجي (شهر)') }} *</label><input class="input" type="number" min="1" step="1" [value]="f().life" (input)="patch({ life: $any($event.target).value })" /></div>
          <div><label class="label">{{ lang.t('Salvage value (EGP)', 'قيمة الخردة (ج.م)') }}</label><input class="input" type="number" min="0" step="0.01" [value]="f().salvage" (input)="patch({ salvage: $any($event.target).value })" /></div>
          <div><label class="label">{{ lang.t('Depreciation method', 'طريقة الإهلاك') }}</label>
            <select class="select" (change)="patch({ method: $any($event.target).value })">
              <option value="straight_line" [selected]="f().method === 'straight_line'">{{ lang.t('Straight-line', 'القسط الثابت') }}</option>
              <option value="declining_balance" [selected]="f().method === 'declining_balance'">{{ lang.t('Double declining balance', 'الرصيد المتناقص المزدوج') }}</option>
            </select></div>
          <div><label class="label">{{ lang.t('Paid from', 'مدفوع من') }}</label>
            <select class="select" (change)="patch({ paymentMethod: $any($event.target).value })">
              @for (m of methods; track m.value) {<option [value]="m.value" [selected]="f().paymentMethod === m.value">{{ lang.l(m.label) }}</option>}
            </select></div>
          <div class="sm:col-span-2"><label class="label">{{ lang.t('Notes', 'ملاحظات') }}</label><input class="input" [value]="f().notes" (input)="patch({ notes: $any($event.target).value })" /></div>
        </div>
        @if (error()) {<div class="field-error mt-2">{{ error() }}</div>}
        <div class="flex justify-end gap-2 mt-4">
          <button class="btn" type="button" (click)="formOpen.set(false)">{{ lang.t('Cancel', 'إلغاء') }}</button>
          <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="save()">{{ lang.t('Save & post', 'حفظ وترحيل') }}</button>
        </div>
      </app-modal>
    }

    @if (schedule(); as sc) {
      <app-modal [title]="sc.asset.name + ' — ' + lang.t('Depreciation schedule', 'جدول الإهلاك')" [wide]="true" (closed)="schedule.set(null)">
        <div class="table-wrap" style="max-height: 55vh; overflow-y: auto"><table class="table">
          <thead><tr><th>{{ lang.t('Month', 'الشهر') }}</th><th class="num">{{ lang.t('Depreciation', 'الإهلاك') }}</th><th class="num">{{ lang.t('Accumulated', 'المجمع') }}</th><th class="num">{{ lang.t('Book value', 'القيمة الدفترية') }}</th><th>{{ lang.t('Status', 'الحالة') }}</th></tr></thead>
          <tbody>
            @for (r of sc.rows; track r.month) {
              <tr><td>{{ lang.month(r.month) }}</td><td class="num">{{ lang.money(r.amount) }}</td><td class="num">{{ lang.money(r.accumulated) }}</td><td class="num">{{ lang.money(r.bookValue) }}</td>
                <td>@if (sc.asset.depreciatedThrough && r.month <= sc.asset.depreciatedThrough) {<app-badge color="green">{{ lang.t('Posted', 'مرحّل') }}</app-badge>} @else {<span class="text-muted">{{ lang.t('Scheduled', 'مجدول') }}</span>}</td></tr>
            }
          </tbody>
        </table></div>
      </app-modal>
    }
  `,
})
export class AssetsPage implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly data = inject(DataService);
  private readonly acc = inject(AccountingService);
  private readonly toast = inject(ToastService);

  protected readonly methods = PAYMENT_METHODS.filter((m) => m.value === 'cash' || m.value === 'bank');
  protected readonly loading = signal(true);
  protected readonly assets = signal<Asset[]>([]);
  protected readonly busy = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly error = signal('');
  protected readonly schedule = signal<{ asset: Asset; rows: DepRow[] } | null>(null);
  protected readonly f = signal<AssetForm>({ name: '', purchaseDate: cairoDate(), cost: '', life: '36', salvage: '0', method: 'straight_line', paymentMethod: 'bank', notes: '' });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const s = await this.data.snapshot();
    this.assets.set([...s.assets].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate)));
    this.loading.set(false);
  }

  protected book(a: Asset): number {
    return round2(a.cost - a.accumulated);
  }
  protected patch(p: Partial<AssetForm>): void {
    this.f.update((x) => ({ ...x, ...p }));
  }
  protected open(): void {
    this.f.set({ name: '', purchaseDate: cairoDate(), cost: '', life: '36', salvage: '0', method: 'straight_line', paymentMethod: 'bank', notes: '' });
    this.error.set('');
    this.formOpen.set(true);
  }
  protected showSchedule(a: Asset): void {
    this.schedule.set({ asset: a, rows: depreciationSchedule(a) });
  }

  protected async save(): Promise<void> {
    const v = this.f();
    this.busy.set(true);
    this.error.set('');
    try {
      await this.acc.createAsset({ name: v.name, purchaseDate: v.purchaseDate, cost: Number(v.cost), salvageValue: Number(v.salvage) || 0, usefulLifeMonths: Number(v.life), method: v.method as any, paymentMethod: v.paymentMethod, notes: v.notes });
      this.toast.success(this.lang.t('Asset recorded', 'تم تسجيل الأصل'));
      this.formOpen.set(false);
      await this.load();
    } catch (e: any) {
      this.error.set(String(e?.message || e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async runDep(): Promise<void> {
    this.busy.set(true);
    try {
      const n = await this.acc.runDepreciation(cairoMonth());
      this.toast.info(n ? this.lang.t('Depreciation entries posted: ', 'قيود إهلاك مرحّلة: ') + n : this.lang.t('Nothing to post', 'لا يوجد إهلاك للترحيل'));
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    } finally {
      this.busy.set(false);
    }
  }
}

export { accumulatedThrough, addMonths };
