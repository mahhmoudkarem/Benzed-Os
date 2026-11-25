import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DataService } from '../../core/services/data.service';
import { AccountingService } from '../../core/accounting/accounting.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { DbService } from '../../core/services/db.service';
import { Account, JournalEntry, JournalLine } from '../../core/models/accounting';
import { toCents, fromCents } from '../../core/utils/money';
import { cairoDate } from '../../core/utils/date';
import { PageHeader } from '../../shared/components/page-header';
import { Modal } from '../../shared/components/modal';
import { Icon } from '../../shared/components/icon';
import { Badge } from '../../shared/components/badge';
import { EmptyState, Loading } from '../../shared/components/state-views';

interface DraftLine {
  accountId: string;
  debit: string;
  credit: string;
}

@Component({
  selector: 'app-journal-page',
  imports: [PageHeader, Modal, Icon, Badge, EmptyState, Loading],
  template: `
    <app-page-header [title]="lang.t('General journal', 'دفتر اليومية')" [subtitle]="lang.t('Posted entries cannot be edited or deleted — corrections use reversal entries.', 'القيود المرحّلة لا تُعدَّل ولا تُحذف — التصحيح بقيود عكسية.')">
      <button class="btn btn-primary" type="button" (click)="openNew()"><app-icon name="plus" [size]="15" /> {{ lang.t('Manual entry', 'قيد يدوي') }}</button>
    </app-page-header>

    <div class="card card-pad mb-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="card-title me-2">{{ lang.t('Financial periods', 'الفترات المالية') }}</div>
        <input class="input" style="width: auto" type="month" [value]="periodInput()" (change)="periodInput.set($any($event.target).value)" />
        <button class="btn btn-sm" type="button" (click)="closePeriod()">{{ lang.t('Close period', 'إغلاق الفترة') }}</button>
        @for (p of periods(); track p) {
          <span class="badge badge-gray">{{ p }} <button class="btn btn-sm btn-ghost" style="padding: 0 4px" type="button" [title]="lang.t('Reopen', 'إعادة فتح')" (click)="reopen(p)">↺</button></span>
        }
      </div>
      <div class="text-[12px] text-muted mt-1">{{ lang.t('Entries cannot be posted into a closed period.', 'لا يمكن الترحيل داخل فترة مغلقة.') }}</div>
    </div>

    <div class="card">
      <div class="flex flex-wrap items-center gap-2 p-3 border-b border-line">
        <input class="input" style="max-width: 240px" [placeholder]="lang.t('Search number or memo…', 'بحث بالرقم أو الوصف…')" [value]="search()" (input)="search.set($any($event.target).value)" />
        <input class="input" style="width: auto" type="date" [value]="from()" (change)="from.set($any($event.target).value)" />
        <span class="text-muted">→</span>
        <input class="input" style="width: auto" type="date" [value]="to()" (change)="to.set($any($event.target).value)" />
      </div>
      @if (loading()) { <app-loading /> }
      @else if (!view().length) { <app-empty-state icon="book" [title]="lang.t('No journal entries', 'لا توجد قيود')" /> }
      @else {
        <div class="table-wrap"><table class="table">
          <thead><tr><th>{{ lang.t('Entry', 'القيد') }}</th><th>{{ lang.t('Date', 'التاريخ') }}</th><th>{{ lang.t('Memo', 'الوصف') }}</th><th>{{ lang.t('Source', 'المصدر') }}</th><th class="num">{{ lang.t('Amount', 'المبلغ') }}</th><th></th></tr></thead>
          <tbody>
            @for (e of view(); track e.id) {
              <tr (click)="toggle(e.id)" style="cursor: pointer">
                <td><b>{{ e.number }}</b></td>
                <td>{{ lang.date(e.date) }}</td>
                <td>{{ e.memo }}
                  @if (e.reversedBy) {<app-badge color="amber">{{ lang.t('Reversed', 'معكوس') }}</app-badge>}
                  @if (e.reversalOf) {<app-badge color="purple">{{ lang.t('Reversal', 'قيد عكسي') }}</app-badge>}</td>
                <td><app-badge color="gray">{{ e.source }}</app-badge></td>
                <td class="num">{{ lang.money(total(e.id)) }}</td>
                <td>@if (!e.reversedBy && !e.reversalOf) {<button class="btn btn-sm" type="button" (click)="reverse(e); $event.stopPropagation()">{{ lang.t('Reverse', 'عكس') }}</button>}</td>
              </tr>
              @if (open().has(e.id)) {
                <tr><td colspan="6" style="background: var(--surface-2)">
                  <table class="table" style="background: transparent">
                    <thead><tr><th>{{ lang.t('Account', 'الحساب') }}</th><th class="num">{{ lang.t('Debit', 'مدين') }}</th><th class="num">{{ lang.t('Credit', 'دائن') }}</th></tr></thead>
                    <tbody>
                      @for (l of linesOf(e.id); track l.id) {
                        <tr><td>{{ accName(l.accountId) }}</td><td class="num">{{ l.debit ? lang.money(l.debit) : '' }}</td><td class="num">{{ l.credit ? lang.money(l.credit) : '' }}</td></tr>
                      }
                    </tbody>
                  </table>
                  @if (e.reversalReason) {<div class="text-[12.5px] text-muted px-3 pb-2">{{ lang.t('Reversal reason: ', 'سبب العكس: ') }}{{ e.reversalReason }}</div>}
                </td></tr>
              }
            }
          </tbody>
        </table></div>
      }
    </div>

    @if (formOpen()) {
      <app-modal [title]="lang.t('Manual journal entry', 'قيد يومية يدوي')" [wide]="true" (closed)="formOpen.set(false)">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div><label class="label">{{ lang.t('Date', 'التاريخ') }} *</label><input class="input" type="date" [value]="date()" (change)="date.set($any($event.target).value)" /></div>
          <div class="sm:col-span-2"><label class="label">{{ lang.t('Description', 'الوصف') }} *</label><input class="input" [value]="memo()" (input)="memo.set($any($event.target).value)" /></div>
        </div>
        @for (l of draft(); track $index) {
          <div class="grid gap-2 mb-2" style="grid-template-columns: 2.5fr 1fr 1fr auto">
            <select class="select" (change)="setLine($index, 'accountId', $any($event.target).value)">
              <option value="">{{ lang.t('Select account…', 'اختر الحساب…') }}</option>
              @for (a of accounts(); track a.id) {<option [value]="a.id" [selected]="l.accountId === a.id">{{ a.code }} · {{ lang.isArabic() ? a.nameAr : a.nameEn }}</option>}
            </select>
            <input class="input" type="number" min="0" step="0.01" [placeholder]="lang.t('Debit', 'مدين')" [value]="l.debit" (input)="setLine($index, 'debit', $any($event.target).value)" />
            <input class="input" type="number" min="0" step="0.01" [placeholder]="lang.t('Credit', 'دائن')" [value]="l.credit" (input)="setLine($index, 'credit', $any($event.target).value)" />
            <button class="icon-btn" style="color: var(--danger)" type="button" (click)="removeLine($index)"><app-icon name="trash" [size]="15" /></button>
          </div>
        }
        <button class="btn btn-sm" type="button" (click)="addLine()"><app-icon name="plus" [size]="14" /> {{ lang.t('Add line', 'إضافة سطر') }}</button>
        <div class="mt-3 p-3 rounded-lg text-[13px] flex justify-between" style="background: var(--surface-2)">
          <span>{{ lang.t('Debits: ', 'المدين: ') }}<b>{{ lang.money(draftTotals().d) }}</b></span>
          <span>{{ lang.t('Credits: ', 'الدائن: ') }}<b>{{ lang.money(draftTotals().c) }}</b></span>
          <span [style.color]="draftTotals().ok ? 'var(--success)' : 'var(--danger)'"><b>{{ draftTotals().ok ? lang.t('Balanced ✓', 'متوازن ✓') : lang.t('Not balanced', 'غير متوازن') }}</b></span>
        </div>
        @if (error()) {<div class="field-error mt-2">{{ error() }}</div>}
        <div class="flex justify-end gap-2 mt-4">
          <button class="btn" type="button" (click)="formOpen.set(false)">{{ lang.t('Cancel', 'إلغاء') }}</button>
          <button class="btn btn-primary" type="button" [disabled]="busy() || !draftTotals().ok" (click)="post()">{{ lang.t('Post entry', 'ترحيل القيد') }}</button>
        </div>
      </app-modal>
    }
  `,
})
export class JournalPage implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly data = inject(DataService);
  private readonly db = inject(DbService).db;
  private readonly acc = inject(AccountingService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly entries = signal<JournalEntry[]>([]);
  protected readonly lines = signal<JournalLine[]>([]);
  protected readonly accounts = signal<Account[]>([]);
  protected readonly periods = signal<string[]>([]);
  protected readonly search = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly open = signal<Set<string>>(new Set());
  protected readonly periodInput = signal(cairoDate().slice(0, 7));
  protected readonly formOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly date = signal(cairoDate());
  protected readonly memo = signal('');
  protected readonly draft = signal<DraftLine[]>([]);

  protected readonly view = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.entries()
      .filter((e) => (!this.from() || e.date >= this.from()) && (!this.to() || e.date <= this.to()))
      .filter((e) => !q || (e.number + ' ' + e.memo).toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  });

  protected readonly draftTotals = computed(() => {
    let d = 0;
    let c = 0;
    for (const l of this.draft()) {
      d += toCents(Number(l.debit) || 0);
      c += toCents(Number(l.credit) || 0);
    }
    return { d: fromCents(d), c: fromCents(c), ok: d > 0 && d === c };
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const s = await this.data.snapshot();
    this.entries.set(s.entries);
    this.lines.set(s.lines);
    this.accounts.set(s.accounts.filter((a) => a.active).sort((a, b) => a.code.localeCompare(b.code)));
    this.periods.set((await this.db.periods.toArray()).map((p) => p.key).sort());
    this.loading.set(false);
  }

  protected linesOf(id: string): JournalLine[] {
    return this.lines().filter((l) => l.entryId === id);
  }
  protected total(id: string): number {
    return fromCents(this.linesOf(id).reduce((a, l) => a + toCents(l.debit), 0));
  }
  protected accName(id: string): string {
    const a = this.accounts().find((x) => x.id === id);
    return a ? a.code + ' · ' + (this.lang.isArabic() ? a.nameAr : a.nameEn) : '—';
  }
  protected toggle(id: string): void {
    this.open.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  protected openNew(): void {
    this.date.set(cairoDate());
    this.memo.set('');
    this.draft.set([{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }]);
    this.error.set('');
    this.formOpen.set(true);
  }
  protected setLine(i: number, key: keyof DraftLine, v: string): void {
    this.draft.update((l) => l.map((x, idx) => (idx === i ? { ...x, [key]: v } : x)));
  }
  protected addLine(): void {
    this.draft.update((l) => [...l, { accountId: '', debit: '', credit: '' }]);
  }
  protected removeLine(i: number): void {
    this.draft.update((l) => (l.length > 2 ? l.filter((_, idx) => idx !== i) : l));
  }

  protected async post(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.acc.postManual(this.date(), this.memo(), this.draft().map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })));
      this.toast.success(this.lang.t('Entry posted', 'تم ترحيل القيد'));
      this.formOpen.set(false);
      await this.load();
    } catch (e: any) {
      this.error.set(String(e?.message || e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async reverse(e: JournalEntry): Promise<void> {
    const r = await this.confirm.ask({ titleEn: 'Reverse entry ' + e.number, titleAr: 'عكس القيد ' + e.number, messageEn: 'A new reversal entry (debits and credits swapped) will be posted today. The original stays in the journal.', messageAr: 'سيتم ترحيل قيد عكسي جديد (المدين والدائن معكوسان) بتاريخ اليوم. يبقى القيد الأصلي في الدفتر.', askReason: true, confirmEn: 'Post reversal', confirmAr: 'ترحيل العكس', danger: true });
    if (!r.ok) return;
    try {
      await this.acc.reverseEntry(e.id, r.reason);
      this.toast.success(this.lang.t('Reversal posted', 'تم ترحيل القيد العكسي'));
      await this.load();
    } catch (err: any) {
      this.toast.error(String(err?.message || err));
    }
  }

  protected async closePeriod(): Promise<void> {
    try {
      await this.acc.closePeriod(this.periodInput());
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }
  protected async reopen(p: string): Promise<void> {
    const ok = await this.confirm.confirm({ titleEn: 'Reopen period', titleAr: 'إعادة فتح الفترة', messageEn: 'Reopen ' + p + ' for posting?', messageAr: 'إعادة فتح ' + p + ' للترحيل؟' });
    if (!ok) return;
    await this.acc.reopenPeriod(p);
    await this.load();
  }
}
