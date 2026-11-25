import { Component, OnInit, inject, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DbService } from '../../core/services/db.service';
import { ToastService } from '../../core/services/toast.service';
import { ClientPackage, PackagePlan, PackageUsage, UsageItem } from '../../core/models/business';
import { SERVICE_TYPES, optionLabel } from '../../core/constants/options';
import { addMonths, cairoMonth, endOfMonth, isoNow } from '../../core/utils/date';
import { uid } from '../../core/utils/id';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Loading } from '../../shared/components/state-views';
import { Badge } from '../../shared/components/badge';

interface Row {
  usage: PackageUsage;
  clientName: string;
  packageName: string;
}

@Component({
  selector: 'app-package-tracking',
  imports: [Icon, EmptyState, Loading, Badge],
  template: `
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <button class="btn btn-sm" type="button" (click)="shift(-1)"><span style="display:inline-block;transform:scaleX(-1)"><app-icon name="chevron" [size]="14" /></span></button>
      <b>{{ lang.month(month()) }}</b>
      <button class="btn btn-sm" type="button" (click)="shift(1)"><app-icon name="chevron" [size]="14" /></button>
      <span class="text-muted text-[12.5px]">{{ lang.t('Counts are entered manually: Completed ≥ Approved ≥ Delivered.', 'الأعداد تُدخل يدويًا: المكتمل ≥ المعتمد ≥ المسلّم.') }}</span>
    </div>
    @if (loading()) {
      <div class="card"><app-loading /></div>
    } @else if (!rows().length) {
      <div class="card"><app-empty-state icon="package" [title]="lang.t('No active package assignments for this month', 'لا توجد باقات مُعيّنة نشطة لهذا الشهر')" [text]="lang.t('Create a package plan, then assign it to a client in the “Assignments” tab.', 'أنشئ خطة باقة ثم عيّنها لعميل من تبويب «التعيينات».')" /></div>
    } @else {
      <div class="flex flex-col gap-3">
        @for (r of rows(); track r.usage.id) {
          <div class="card">
            <div class="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-line">
              <div><b>{{ r.clientName }}</b> <span class="text-muted">· {{ r.packageName }}</span></div>
              @if (overdueCount(r) > 0) {
                <app-badge color="red">{{ lang.t('Overdue work: ', 'عمل متأخر: ') }}{{ lang.num(overdueCount(r)) }}</app-badge>
              } @else if (remainingTotal(r) === 0) {
                <app-badge color="green">{{ lang.t('Fully delivered', 'تم تسليم الكل') }}</app-badge>
              } @else {
                <app-badge color="blue">{{ lang.t('Remaining: ', 'المتبقي: ') }}{{ lang.num(remainingTotal(r)) }}</app-badge>
              }
            </div>
            <div class="table-wrap">
              <table class="table">
                <thead><tr>
                  <th>{{ lang.t('Service', 'الخدمة') }}</th>
                  <th class="num">{{ lang.t('Required', 'المطلوب') }}</th>
                  <th class="num">{{ lang.t('Completed', 'المكتمل') }}</th>
                  <th class="num">{{ lang.t('Approved', 'المعتمد') }}</th>
                  <th class="num">{{ lang.t('Delivered', 'المسلّم') }}</th>
                  <th class="num">{{ lang.t('Remaining', 'المتبقي') }}</th>
                </tr></thead>
                <tbody>
                  @for (it of r.usage.items; track it.type) {
                    <tr>
                      <td>{{ svcLabel(it.type) }}</td>
                      <td class="num">{{ lang.num(it.required) }}</td>
                      <td class="num"><span class="inline-flex items-center gap-1"><button class="btn btn-sm" style="padding:2px 8px" type="button" (click)="bump(r, it, 'completed', -1)">−</button><b style="min-width:22px;display:inline-block;text-align:center">{{ lang.num(it.completed) }}</b><button class="btn btn-sm" style="padding:2px 8px" type="button" (click)="bump(r, it, 'completed', 1)">+</button></span></td>
                      <td class="num"><span class="inline-flex items-center gap-1"><button class="btn btn-sm" style="padding:2px 8px" type="button" (click)="bump(r, it, 'approved', -1)">−</button><b style="min-width:22px;display:inline-block;text-align:center">{{ lang.num(it.approved) }}</b><button class="btn btn-sm" style="padding:2px 8px" type="button" (click)="bump(r, it, 'approved', 1)">+</button></span></td>
                      <td class="num"><span class="inline-flex items-center gap-1"><button class="btn btn-sm" style="padding:2px 8px" type="button" (click)="bump(r, it, 'delivered', -1)">−</button><b style="min-width:22px;display:inline-block;text-align:center">{{ lang.num(it.delivered) }}</b><button class="btn btn-sm" style="padding:2px 8px" type="button" (click)="bump(r, it, 'delivered', 1)">+</button></span></td>
                      <td class="num" [style.color]="remaining(it) > 0 && isPast() ? 'var(--danger)' : ''"><b>{{ lang.num(remaining(it)) }}</b></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="p-3 border-t border-line">
              <div class="label">{{ lang.t('Extra services (outside the package)', 'خدمات إضافية (خارج الباقة)') }}</div>
              @for (x of r.usage.extras; track $index) {
                <div class="flex items-center justify-between text-[13px] py-1">
                  <span>{{ x.description }} × {{ lang.num(x.quantity) }}</span>
                  <span class="flex items-center gap-2">{{ lang.money(x.price * x.quantity) }}
                    <button class="icon-btn" style="width: 26px; height: 26px; color: var(--danger)" type="button" (click)="removeExtra(r, $index)"><app-icon name="trash" [size]="14" /></button></span>
                </div>
              }
              <div class="flex flex-wrap gap-2 mt-2">
                <input class="input" style="flex: 2 1 160px" [placeholder]="lang.t('Description', 'الوصف')" [value]="exDesc()" (input)="exDesc.set($any($event.target).value)" />
                <input class="input" style="flex: 1 1 70px" type="number" min="1" [placeholder]="lang.t('Qty', 'الكمية')" [value]="exQty()" (input)="exQty.set($any($event.target).value)" />
                <input class="input" style="flex: 1 1 90px" type="number" min="0" [placeholder]="lang.t('Unit price', 'سعر الوحدة')" [value]="exPrice()" (input)="exPrice.set($any($event.target).value)" />
                <button class="btn" type="button" (click)="addExtra(r)"><app-icon name="plus" [size]="14" /> {{ lang.t('Add extra', 'إضافة') }}</button>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class PackageTracking implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly db = inject(DbService).db;
  private readonly toast = inject(ToastService);

  protected readonly month = signal(cairoMonth());
  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(true);
  protected readonly exDesc = signal('');
  protected readonly exQty = signal('1');
  protected readonly exPrice = signal('0');

  ngOnInit(): void {
    void this.load();
  }

  protected shift(n: number): void {
    this.month.set(addMonths(this.month(), n));
    void this.load();
  }

  protected isPast(): boolean {
    return this.month() < cairoMonth();
  }

  protected svcLabel(t: string): string {
    return optionLabel(SERVICE_TYPES, t, this.lang.lang());
  }
  protected remaining(it: UsageItem): number {
    return Math.max(0, it.required - it.delivered);
  }
  protected remainingTotal(r: Row): number {
    return r.usage.items.reduce((a, it) => a + this.remaining(it), 0);
  }
  protected overdueCount(r: Row): number {
    return this.isPast() ? this.remainingTotal(r) : 0;
  }
  protected stepper(r: Row, it: UsageItem, field: 'completed' | 'approved' | 'delivered'): string {
    return String(it[field]);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const m = this.month();
      const from = m + '-01';
      const to = endOfMonth(from);
      const [assigns, plans, clients] = await Promise.all([this.db.clientPackages.toArray(), this.db.packages.toArray(), this.db.clients.toArray()]);
      const planMap = new Map<string, PackagePlan>(plans.map((p) => [p.id, p]));
      const active = assigns.filter((a: ClientPackage) => a.status === 'active' && a.startDate <= to && (!a.endDate || a.endDate >= from));
      const out: Row[] = [];
      for (const a of active) {
        const plan = planMap.get(a.packageId);
        if (!plan) continue;
        let usage = await this.db.packageUsage.where('[clientPackageId+month]').equals([a.id, m]).first();
        if (!usage) {
          const now = isoNow();
          usage = {
            id: uid(),
            clientPackageId: a.id,
            clientId: a.clientId,
            month: m,
            items: plan.services.map((s) => ({ type: s.type, required: s.quantity, completed: 0, approved: 0, delivered: 0 })),
            extras: [],
            createdAt: now,
            updatedAt: now,
          };
          await this.db.packageUsage.add(usage);
        }
        out.push({ usage, clientName: clients.find((c) => c.id === a.clientId)?.name || '—', packageName: plan.name });
      }
      this.rows.set(out);
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    } finally {
      this.loading.set(false);
    }
  }

  private async persist(r: Row): Promise<void> {
    await this.db.packageUsage.update(r.usage.id, { items: r.usage.items, extras: r.usage.extras, updatedAt: isoNow() } as any);
    this.rows.update((l) => [...l]);
  }

  /** تعديل رقم مع الحفاظ على التسلسل: مكتمل ≥ معتمد ≥ مسلّم */
  protected async bump(r: Row, it: UsageItem, field: 'completed' | 'approved' | 'delivered', delta: number): Promise<void> {
    const v = Math.max(0, it[field] + delta);
    it[field] = v;
    if (it.approved > it.completed) it.approved = it.completed;
    if (it.delivered > it.approved) it.delivered = it.approved;
    if (field === 'approved' && it.completed < it.approved) it.completed = it.approved;
    if (field === 'delivered') {
      if (it.approved < it.delivered) it.approved = it.delivered;
      if (it.completed < it.approved) it.completed = it.approved;
    }
    await this.persist(r);
  }

  protected async addExtra(r: Row): Promise<void> {
    const desc = this.exDesc().trim();
    const qty = Number(this.exQty());
    const price = Number(this.exPrice());
    if (!desc || !(qty > 0) || !(price >= 0)) {
      this.toast.warning(this.lang.t('Enter a description, quantity and price.', 'أدخل الوصف والكمية والسعر.'));
      return;
    }
    r.usage.extras = [...r.usage.extras, { description: desc, quantity: qty, price }];
    this.exDesc.set('');
    this.exQty.set('1');
    this.exPrice.set('0');
    await this.persist(r);
  }

  protected async removeExtra(r: Row, i: number): Promise<void> {
    r.usage.extras = r.usage.extras.filter((_, idx) => idx !== i);
    await this.persist(r);
  }
}
