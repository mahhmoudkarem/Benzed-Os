import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { Repositories } from '../../core/repositories/repositories';
import { DbService } from '../../core/services/db.service';
import { DataService } from '../../core/services/data.service';
import { Client, ActivityRecord } from '../../core/models/business';
import { CLIENT_STATUS, optionColor, optionLabel } from '../../core/constants/options';
import { Snapshot } from '../../core/accounting/snapshot';
import { remaining } from '../../core/accounting/metrics';
import { fmt } from '../../core/utils/format';
import { fromCents, toCents } from '../../core/utils/money';
import { EntityPage } from '../../shared/entity/entity-page';
import { EntityForm } from '../../shared/entity/entity-form';
import { PageHeader } from '../../shared/components/page-header';
import { StatCard } from '../../shared/components/stat-card';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Loading } from '../../shared/components/state-views';
import { InvoicesPage } from '../accounting/invoices-page';
import { PaymentsPage } from '../accounting/payments-page';
import { clientConfig } from './clients.config';
import { projectConfig } from '../projects/projects.config';
import { taskConfig } from '../tasks/tasks.config';
import { socialConfig } from '../social/social.config';
import { contentConfig } from '../content/content.config';
import { campaignConfig } from '../campaigns/campaigns.config';
import { clientPackageConfig } from '../packages/packages.config';

type Tab = 'overview' | 'brand' | 'social' | 'packages' | 'projects' | 'tasks' | 'content' | 'campaigns' | 'invoices' | 'payments' | 'financial' | 'activity';

@Component({
  selector: 'app-client-details',
  imports: [RouterLink, EntityPage, EntityForm, PageHeader, StatCard, Badge, Icon, EmptyState, Loading, InvoicesPage, PaymentsPage],
  template: `
    @if (loading()) {
      <div class="card"><app-loading /></div>
    } @else if (!client()) {
      <div class="card"><app-empty-state icon="users" [title]="lang.t('Client not found', 'العميل غير موجود')"><a routerLink="/clients" class="btn">{{ lang.t('Back to clients', 'العودة للعملاء') }}</a></app-empty-state></div>
    } @else if (client(); as c) {
      <app-page-header [title]="c.name" [subtitle]="[c.companyName, c.brandName].filter(x => x).join(' · ')">
        <app-badge [color]="statusColor(c.status)">{{ statusLabel(c.status) }}</app-badge>
        <button class="btn" type="button" (click)="editing.set(true)"><app-icon name="edit" [size]="15" /> {{ lang.t('Edit', 'تعديل') }}</button>
      </app-page-header>

      <div class="tabs mb-3">
        @for (t of tabs; track t.id) {
          <button class="tab" [class.active]="tab() === t.id" type="button" (click)="tab.set(t.id)">{{ lang.t(t.en, t.ar) }}</button>
        }
      </div>

      @switch (tab()) {
        @case ('overview') {
          <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 mb-3">
            <app-stat-card icon="file" [label]="lang.t('Total invoiced', 'إجمالي المفوتر')" [value]="lang.money(fin().invoiced)" />
            <app-stat-card icon="wallet" tone="good" [label]="lang.t('Paid', 'المدفوع')" [value]="lang.money(fin().paid)" />
            <app-stat-card icon="alert" tone="warn" [label]="lang.t('Outstanding', 'المستحق')" [value]="lang.money(fin().outstanding)" />
            <app-stat-card icon="briefcase" [label]="lang.t('Projects / open tasks', 'المشاريع / المهام المفتوحة')" [value]="lang.num(counts().projects) + ' / ' + lang.num(counts().openTasks)" />
          </div>
          <div class="card card-pad grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
            @for (r of overviewRows(); track r[0]) {
              <div class="flex justify-between border-b border-line py-1.5"><span class="text-muted">{{ r[0] }}</span><b>{{ r[1] || '—' }}</b></div>
            }
            @if (c.notes) {<div class="sm:col-span-2"><div class="label">{{ lang.t('Notes', 'ملاحظات') }}</div><div style="white-space: pre-line">{{ c.notes }}</div></div>}
          </div>
        }
        @case ('brand') {
          <div class="card card-pad flex flex-col gap-3 text-[13px]">
            <div><div class="label">{{ lang.t('Brand name', 'اسم العلامة') }}</div><b>{{ c.brandName || '—' }}</b></div>
            <div><div class="label">{{ lang.t('Business type', 'نوع النشاط') }}</div><b>{{ c.businessType || '—' }}</b></div>
            <div><div class="label">{{ lang.t('Brand voice / tone', 'نبرة العلامة') }}</div><b>{{ c.brandVoice || '—' }}</b></div>
            <div><div class="label">{{ lang.t('Target audience', 'الجمهور المستهدف') }}</div><b>{{ c.targetAudience || '—' }}</b></div>
            <div><div class="label">{{ lang.t('Brand colors', 'ألوان العلامة') }}</div><b>{{ c.brandColors || '—' }}</b></div>
            <div><div class="label">{{ lang.t('Brand notes', 'ملاحظات العلامة') }}</div><div style="white-space: pre-line">{{ c.brandNotes || '—' }}</div></div>
          </div>
        }
        @case ('social') { <app-entity-page [config]="social" [fixed]="fixed()" [embedded]="true" /> }
        @case ('packages') { <app-entity-page [config]="packages" [fixed]="fixed()" [embedded]="true" /> }
        @case ('projects') { <app-entity-page [config]="projects" [fixed]="fixed()" [embedded]="true" /> }
        @case ('tasks') { <app-entity-page [config]="tasks" [fixed]="fixed()" [embedded]="true" /> }
        @case ('content') { <app-entity-page [config]="content" [fixed]="fixed()" [embedded]="true" /> }
        @case ('campaigns') { <app-entity-page [config]="campaigns" [fixed]="fixed()" [embedded]="true" /> }
        @case ('invoices') { <app-invoices-page [clientId]="c.id" [embedded]="true" /> }
        @case ('payments') { <app-payments-page [clientId]="c.id" [embedded]="true" /> }
        @case ('financial') {
          <div class="card">
            <div class="card-title p-4 pb-2">{{ lang.t('Financial history by month', 'السجل المالي شهريًا') }}</div>
            @if (!months().length) {
              <app-empty-state icon="dollar" [title]="lang.t('No financial activity', 'لا يوجد نشاط مالي')" />
            } @else {
              <div class="table-wrap"><table class="table">
                <thead><tr><th>{{ lang.t('Month', 'الشهر') }}</th><th class="num">{{ lang.t('Invoiced', 'المفوتر') }}</th><th class="num">{{ lang.t('Paid', 'المدفوع') }}</th><th class="num">{{ lang.t('Linked expenses', 'مصروفات مرتبطة') }}</th></tr></thead>
                <tbody>
                  @for (m of months(); track m.month) {
                    <tr><td>{{ monthName(m.month) }}</td><td class="num">{{ lang.money(m.invoiced) }}</td><td class="num">{{ lang.money(m.paid) }}</td><td class="num">{{ lang.money(m.expenses) }}</td></tr>
                  }
                </tbody>
              </table></div>
            }
          </div>
        }
        @default {
          <div class="card">
            @for (a of activity(); track a.id) {
              <div class="flex justify-between gap-3 p-3 border-b border-line last:border-0 text-[13px]"><span>{{ lang.isArabic() ? a.messageAr : a.messageEn }}</span><span class="text-muted text-[12px] whitespace-nowrap">{{ lang.dateTime(a.at) }}</span></div>
            } @empty {
              <app-empty-state icon="clock" [title]="lang.t('No activity yet', 'لا يوجد نشاط بعد')" />
            }
          </div>
        }
      }

      @if (editing()) {
        <app-entity-form [config]="config" [record]="c" (saved)="onEdited()" (closed)="editing.set(false)" />
      }
    }
  `,
})
export class ClientDetails implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly repos = inject(Repositories);
  private readonly db = inject(DbService).db;
  private readonly data = inject(DataService);

  protected readonly config = clientConfig();
  protected readonly social = socialConfig();
  protected readonly packages = clientPackageConfig();
  protected readonly projects = projectConfig();
  protected readonly tasks = taskConfig();
  protected readonly content = contentConfig();
  protected readonly campaigns = campaignConfig();

  protected readonly tabs: { id: Tab; en: string; ar: string }[] = [
    { id: 'overview', en: 'Overview', ar: 'نظرة عامة' },
    { id: 'brand', en: 'Brand profile', ar: 'ملف العلامة' },
    { id: 'social', en: 'Social accounts', ar: 'حسابات السوشيال' },
    { id: 'packages', en: 'Services & packages', ar: 'الخدمات والباقات' },
    { id: 'projects', en: 'Projects', ar: 'المشاريع' },
    { id: 'tasks', en: 'Tasks', ar: 'المهام' },
    { id: 'content', en: 'Content calendar', ar: 'تقويم المحتوى' },
    { id: 'campaigns', en: 'Campaigns', ar: 'الحملات' },
    { id: 'invoices', en: 'Invoices', ar: 'الفواتير' },
    { id: 'payments', en: 'Payments', ar: 'المدفوعات' },
    { id: 'financial', en: 'Financial history', ar: 'السجل المالي' },
    { id: 'activity', en: 'Activity history', ar: 'سجل النشاط' },
  ];

  protected readonly loading = signal(true);
  protected readonly tab = signal<Tab>('overview');
  protected readonly editing = signal(false);
  protected readonly client = signal<Client | null>(null);
  protected readonly manager = signal('');
  protected readonly snap = signal<Snapshot | null>(null);
  protected readonly activity = signal<ActivityRecord[]>([]);
  protected readonly fixed = computed(() => ({ clientId: this.client()?.id || '' }));

  protected readonly fin = computed(() => {
    const s = this.snap();
    const c = this.client();
    if (!s || !c) return { invoiced: 0, paid: 0, outstanding: 0 };
    const inv = s.invoices.filter((i) => i.clientId === c.id && i.status !== 'draft' && i.status !== 'cancelled');
    const invoiced = inv.reduce((a, i) => a + toCents(i.total), 0);
    const paid = s.payments.filter((p) => p.clientId === c.id && !p.voided).reduce((a, p) => a + toCents(p.amount), 0);
    const out = inv.filter((i) => i.status === 'issued' || i.status === 'partial').reduce((a, i) => a + toCents(remaining(i)), 0);
    return { invoiced: fromCents(invoiced), paid: fromCents(paid), outstanding: fromCents(out) };
  });

  protected readonly counts = computed(() => {
    const s = this.snap();
    const c = this.client();
    if (!s || !c) return { projects: 0, openTasks: 0 };
    return { projects: s.projects.filter((p) => p.clientId === c.id && !p.archived).length, openTasks: s.tasks.filter((t) => t.clientId === c.id && t.status !== 'completed').length };
  });

  protected readonly months = computed(() => {
    const s = this.snap();
    const c = this.client();
    if (!s || !c) return [];
    const map = new Map<string, { invoiced: number; paid: number; expenses: number }>();
    const get = (m: string) => map.get(m) || map.set(m, { invoiced: 0, paid: 0, expenses: 0 }).get(m)!;
    s.invoices.filter((i) => i.clientId === c.id && i.status !== 'draft' && i.status !== 'cancelled').forEach((i) => (get(i.issueDate.slice(0, 7)).invoiced += i.total));
    s.payments.filter((p) => p.clientId === c.id && !p.voided).forEach((p) => (get(p.date.slice(0, 7)).paid += p.amount));
    s.transactions.filter((t) => t.clientId === c.id && t.type === 'expense' && !t.voided).forEach((t) => (get(t.date.slice(0, 7)).expenses += t.amount));
    return Array.from(map.entries()).map(([month, v]) => ({ month, ...v })).sort((a, b) => b.month.localeCompare(a.month));
  });

  protected readonly overviewRows = computed<[string, string][]>(() => {
    const c = this.client();
    if (!c) return [];
    const t = (en: string, ar: string) => this.lang.t(en, ar);
    return [
      [t('Email', 'البريد'), c.email],
      [t('Phone', 'الهاتف'), c.phone],
      [t('WhatsApp', 'واتساب'), c.whatsapp],
      [t('Country / City', 'الدولة / المدينة'), [c.country, c.city].filter((x) => x).join(' / ')],
      [t('Address', 'العنوان'), c.address],
      [t('Start date', 'تاريخ البدء'), this.lang.date(c.startDate)],
      [t('Account manager', 'مدير الحساب'), this.manager()],
      [t('Business type', 'نوع النشاط'), c.businessType],
    ];
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') || '';
    const c = (await this.repos.clients.get(id)) || null;
    this.client.set(c);
    if (c) {
      this.snap.set(await this.data.snapshot());
      this.manager.set(c.accountManagerId ? (await this.repos.employees.get(c.accountManagerId))?.fullName || '' : '');
      this.activity.set((await this.db.activities.where('entityId').equals(id).toArray()).sort((a, b) => b.at.localeCompare(a.at)));
    }
    this.loading.set(false);
  }

  protected statusLabel(s: string): string {
    return optionLabel(CLIENT_STATUS, s, this.lang.lang());
  }
  protected statusColor(s: string): string {
    return optionColor(CLIENT_STATUS, s);
  }
  protected monthName(m: string): string {
    return fmt.month(m, this.lang.lang());
  }

  protected async onEdited(): Promise<void> {
    this.editing.set(false);
    await this.load();
  }
}
