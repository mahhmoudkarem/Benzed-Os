import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DataService } from '../../core/services/data.service';
import { SettingsService } from '../../core/services/settings.service';
import { Snapshot } from '../../core/accounting/snapshot';
import { ProfitRow, clientProfitability, projectProfitability, serviceProfitability } from '../../core/accounting/metrics';
import { Insight, analyze, baseline } from '../../core/intelligence/analyzer';
import { AssistantAnswer, SUGGESTED_QUESTIONS, answerQuestion } from '../../core/intelligence/assistant';
import { ScenarioType, SimulationResult, simulate } from '../../core/intelligence/simulator';
import { SERVICE_TYPES, optionLabel } from '../../core/constants/options';
import { PageHeader } from '../../shared/components/page-header';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Loading } from '../../shared/components/state-views';

type Tab = 'insights' | 'profit' | 'assistant' | 'simulator';

interface Chat {
  q: string;
  a: AssistantAnswer;
}

@Component({
  selector: 'app-intelligence-page',
  imports: [RouterLink, PageHeader, Badge, Icon, EmptyState, Loading],
  template: `
    <app-page-header [title]="lang.t('BENZED Financial Intelligence', 'BENZED للذكاء المالي')" [subtitle]="lang.t('Rule-based analysis of your recorded data. Every recommendation shows the numbers behind it.', 'تحليل قائم على قواعد لبياناتك المسجلة. كل توصية تعرض الأرقام التي بُنيت عليها.')" />
    <div class="tabs mb-3">
      <button class="tab" [class.active]="tab() === 'insights'" type="button" (click)="tab.set('insights')">{{ lang.t('Insights', 'التحليلات') }}</button>
      <button class="tab" [class.active]="tab() === 'profit'" type="button" (click)="tab.set('profit')">{{ lang.t('Profitability', 'الربحية') }}</button>
      <button class="tab" [class.active]="tab() === 'assistant'" type="button" (click)="tab.set('assistant')">{{ lang.t('Financial assistant', 'المساعد المالي') }}</button>
      <button class="tab" [class.active]="tab() === 'simulator'" type="button" (click)="tab.set('simulator')">{{ lang.t('What-if simulator', 'محاكي القرارات') }}</button>
    </div>

    @if (loading()) {
      <div class="card"><app-loading /></div>
    } @else {
      @switch (tab()) {
        @case ('insights') {
          <div class="card card-pad mb-3 flex flex-wrap items-center gap-3">
            <label class="text-[13px] font-semibold">{{ lang.t('Monthly profit target (EGP)', 'هدف الربح الشهري (ج.م)') }}</label>
            <input class="input" style="width: 160px" type="number" min="0" [value]="target()" (change)="saveTarget($any($event.target).value)" />
            <span class="text-[12px] text-muted">{{ lang.t('Used for break-even / target analysis. 0 = break-even only.', 'يُستخدم لتحليل التعادل / الهدف. 0 = التعادل فقط.') }}</span>
          </div>
          <div class="flex flex-col gap-3">
            @for (i of insights(); track i.id) {
              <div class="card card-pad" [style.border-inline-start]="'4px solid ' + sevHex(i.severity)">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="font-semibold">{{ lang.l(i.title) }}</div>
                  <app-badge [color]="sevColor(i.severity)">{{ sevLabel(i.severity) }}</app-badge>
                </div>
                <div class="text-[13px] text-muted mt-1">{{ lang.l(i.message) }}</div>
                @if (i.evidence.length) {
                  <div class="mt-2 p-2.5 rounded-lg text-[12.5px]" style="background: var(--surface-2)">
                    <div class="font-semibold mb-1">{{ lang.t('Data & calculation', 'البيانات والحساب') }}</div>
                    @for (e of i.evidence; track $index) {
                      <div class="flex justify-between gap-3"><span>{{ lang.l(e.label) }}</span><b>{{ lang.l(e.value) }}</b></div>
                    }
                  </div>
                }
                @if (i.link) {<a [routerLink]="i.link" class="text-[12.5px] mt-2 inline-block">{{ lang.t('Open', 'فتح') }} →</a>}
              </div>
            } @empty {
              <div class="card"><app-empty-state icon="spark" [title]="lang.t('No insights yet', 'لا توجد تحليلات بعد')" /></div>
            }
          </div>
        }
        @case ('profit') {
          <div class="flex flex-col gap-3">
            @for (g of profitGroups(); track g.title) {
              <div class="card">
                <div class="card-title p-4 pb-2">{{ g.title }}</div>
                @if (!g.rows.length) {
                  <div class="px-4 pb-4 text-muted text-[13px]">{{ g.empty }}</div>
                } @else {
                  <div class="table-wrap"><table class="table">
                    <thead><tr><th>{{ g.nameLabel }}</th><th class="num">{{ lang.t('Revenue', 'الإيراد') }}</th><th class="num">{{ lang.t('Direct costs', 'التكاليف المباشرة') }}</th><th class="num">{{ lang.t('Profit', 'الربح') }}</th><th class="num">{{ lang.t('Margin', 'الهامش') }}</th>@if (g.showBudget) {<th class="num">{{ lang.t('Budget', 'الميزانية') }}</th>}</tr></thead>
                    <tbody>
                      @for (r of g.rows; track r.id) {
                        <tr><td>{{ g.service ? svcName(r.name) : r.name }}</td><td class="num">{{ lang.money(r.revenue) }}</td><td class="num">{{ lang.money(r.cost) }}</td><td class="num" [style.color]="r.profit < 0 ? 'var(--danger)' : ''">{{ lang.money(r.profit) }}</td><td class="num">{{ r.revenue ? lang.pct(r.margin) : '—' }}</td>@if (g.showBudget) {<td class="num">{{ r.extra ? lang.money(r.extra) : '—' }}</td>}</tr>
                      }
                    </tbody>
                  </table></div>
                }
                <div class="px-4 pb-3 text-[12px] text-muted">{{ g.note }}</div>
              </div>
            }
          </div>
        }
        @case ('assistant') {
          <div class="card card-pad mb-3 text-[13px]" style="border-inline-start: 4px solid var(--primary)">
            <b>{{ lang.t('Local rule-based assistant.', 'مساعد محلي قائم على قواعد.') }}</b>
            {{ lang.t('It is not a conversational AI. It recognises the questions below, calculates from your records and shows its steps. An external AI can be added later.', 'ليس ذكاءً اصطناعيًا محادثيًا. يتعرف على الأسئلة أدناه ويحسب من سجلاتك ويعرض الخطوات. يمكن إضافة ذكاء اصطناعي خارجي لاحقًا.') }}
          </div>
          <div class="flex flex-wrap gap-2 mb-3">
            @for (q of suggestions; track $index) {
              <button class="btn btn-sm" type="button" (click)="ask(lang.l(q))">{{ lang.l(q) }}</button>
            }
          </div>
          <div class="flex gap-2 mb-3">
            <input class="input" [placeholder]="lang.t('Ask a financial question…', 'اسأل سؤالًا ماليًا…')" [value]="question()" (input)="question.set($any($event.target).value)" (keydown.enter)="ask(question())" />
            <button class="btn btn-primary" type="button" (click)="ask(question())"><app-icon name="spark" [size]="15" /> {{ lang.t('Ask', 'اسأل') }}</button>
          </div>
          <div class="flex flex-col gap-3">
            @for (c of chat(); track $index) {
              <div class="card card-pad">
                <div class="text-[12.5px] text-muted mb-1">{{ lang.t('You asked:', 'سؤالك:') }} {{ c.q }}</div>
                <div class="font-semibold">{{ lang.l(c.a.text) }}</div>
                @if (c.a.rows.length) {
                  <div class="mt-2 p-2.5 rounded-lg text-[12.5px]" style="background: var(--surface-2)">
                    @for (r of c.a.rows; track $index) {<div class="flex justify-between gap-3"><span>{{ lang.l(r.label) }}</span><b>{{ lang.l(r.value) }}</b></div>}
                  </div>
                }
                @for (k of c.a.calc; track $index) {<div class="text-[12px] text-muted mt-1.5">ƒ {{ lang.l(k) }}</div>}
              </div>
            }
          </div>
        }
        @default {
          <div class="grid gap-3 grid-cols-1 lg:grid-cols-3">
            <div class="card card-pad">
              <div class="card-title mb-3">{{ lang.t('Scenario', 'السيناريو') }}</div>
              <div class="flex flex-col gap-3">
                <select class="select" (change)="setScenario($any($event.target).value)">
                  @for (s of scenarios; track s.id) {<option [value]="s.id" [selected]="scenario() === s.id">{{ lang.t(s.en, s.ar) }}</option>}
                </select>
                @if (needsAmount()) {
                  <div><label class="label">{{ amountLabel() }}</label><input class="input" type="number" min="0" [value]="amount()" (input)="amount.set(+$any($event.target).value)" /></div>
                }
                @if (needsPercent()) {
                  <div><label class="label">{{ lang.t('Percent %', 'النسبة %') }}</label><input class="input" type="number" [value]="percent()" (input)="percent.set(+$any($event.target).value)" /></div>
                }
                <div><label class="label">{{ lang.t('Horizon (months)', 'الأفق (شهور)') }}</label><input class="input" type="number" min="1" max="36" [value]="horizon()" (input)="horizon.set(+$any($event.target).value)" /></div>
                <div class="text-[12px] text-muted">{{ lang.t('Simulations never change your accounting records.', 'المحاكاة لا تغيّر أي سجل محاسبي.') }}</div>
              </div>
            </div>
            <div class="card card-pad lg:col-span-2">
              @if (sim(); as r) {
                <div class="grid grid-cols-2 gap-3">
                  <div class="p-3 rounded-lg" style="background: var(--surface-2)"><div class="kpi-label">{{ lang.t('Current monthly profit (avg)', 'الربح الشهري الحالي (متوسط)') }}</div><div class="kpi-value">{{ lang.money(r.currentProfit) }}</div></div>
                  <div class="p-3 rounded-lg" style="background: var(--primary-soft)"><div class="kpi-label">{{ lang.t('Projected monthly profit', 'الربح الشهري المتوقع') }}</div><div class="kpi-value" [style.color]="r.projectedProfit < 0 ? 'var(--danger)' : ''">{{ lang.money(r.projectedProfit) }}</div></div>
                  <div class="p-3 rounded-lg" style="background: var(--surface-2)"><div class="kpi-label">{{ lang.t('Current cash balance', 'رصيد النقدية الحالي') }}</div><div class="kpi-value">{{ lang.money(r.currentCash) }}</div></div>
                  <div class="p-3 rounded-lg" style="background: var(--primary-soft)"><div class="kpi-label">{{ lang.t('Projected cash after', 'النقدية المتوقعة بعد') }} {{ lang.num(horizon()) }} {{ lang.t('months', 'شهر') }}</div><div class="kpi-value" [style.color]="r.projectedCash < 0 ? 'var(--danger)' : ''">{{ lang.money(r.projectedCash) }}</div></div>
                </div>
                <div class="mt-3 text-[13px]"><b>{{ lang.t('Financial impact', 'الأثر المالي') }}:</b> {{ lang.t('monthly profit', 'الربح الشهري') }} {{ r.profitImpact >= 0 ? '+' : '' }}{{ lang.money(r.profitImpact) }} · {{ lang.t('cash vs. no change', 'النقدية مقابل عدم التغيير') }} {{ r.cashImpact >= 0 ? '+' : '' }}{{ lang.money(r.cashImpact) }}</div>
                <div class="mt-3 p-2.5 rounded-lg text-[12.5px]" style="background: var(--surface-2)">
                  <div class="font-semibold mb-1">{{ lang.t('Calculation', 'الحساب') }}</div>
                  @for (st of r.steps; track $index) {<div class="flex justify-between"><span>{{ lang.l(st.label) }}</span><b>{{ lang.money(st.value) }}</b></div>}
                  <div class="text-muted mt-1">{{ lang.t('Projected cash = current cash + projected monthly profit × months − one-off cost (profit is used as an approximation of cash flow).', 'النقدية المتوقعة = النقدية الحالية + الربح الشهري المتوقع × الأشهر − التكلفة لمرة واحدة (الربح تقدير تقريبي للتدفق النقدي).') }}</div>
                </div>
                <div class="mt-3"><div class="font-semibold text-[13px] mb-1">{{ lang.t('Risk indicators', 'مؤشرات المخاطر') }}</div>
                  @for (k of r.risks; track $index) {<div class="mb-1"><app-badge [color]="k.level === 'high' ? 'red' : k.level === 'medium' ? 'amber' : 'green'">{{ lang.l(k.text) }}</app-badge></div>}
                </div>
              }
            </div>
          </div>
        }
      }
    }
  `,
})
export class IntelligencePage implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly data = inject(DataService);
  private readonly settings = inject(SettingsService);

  protected readonly suggestions = SUGGESTED_QUESTIONS;
  protected readonly scenarios: { id: ScenarioType; en: string; ar: string }[] = [
    { id: 'hire', en: 'Hire a new employee', ar: 'توظيف موظف جديد' },
    { id: 'raise_salaries', en: 'Increase salaries', ar: 'زيادة المرتبات' },
    { id: 'lose_client', en: 'Lose a client', ar: 'خسارة عميل' },
    { id: 'new_client', en: 'Acquire a new client', ar: 'اكتساب عميل جديد' },
    { id: 'buy_equipment', en: 'Purchase equipment', ar: 'شراء معدات' },
    { id: 'marketing', en: 'Increase marketing expenses', ar: 'زيادة مصروفات التسويق' },
    { id: 'prices', en: 'Change service prices', ar: 'تغيير أسعار الخدمات' },
    { id: 'operating_costs', en: 'Increase operating costs', ar: 'زيادة تكاليف التشغيل' },
  ];

  protected readonly tab = signal<Tab>('insights');
  protected readonly loading = signal(true);
  protected readonly target = signal(0);
  private readonly snap = signal<Snapshot | null>(null);
  protected readonly insights = signal<Insight[]>([]);
  protected readonly question = signal('');
  protected readonly chat = signal<Chat[]>([]);

  protected readonly scenario = signal<ScenarioType>('hire');
  protected readonly amount = signal(8000);
  protected readonly percent = signal(15);
  protected readonly horizon = signal(6);

  protected readonly needsAmount = computed(() => ['hire', 'lose_client', 'new_client', 'buy_equipment', 'marketing'].includes(this.scenario()));
  protected readonly needsPercent = computed(() => ['raise_salaries', 'prices', 'operating_costs'].includes(this.scenario()));
  protected readonly sim = computed<SimulationResult | null>(() => {
    const s = this.snap();
    if (!s) return null;
    return simulate(baseline(s), { type: this.scenario(), amount: this.amount(), percent: this.percent(), horizon: this.horizon() });
  });

  protected readonly profitGroups = computed(() => {
    const s = this.snap();
    if (!s) return [];
    this.lang.lang();
    const t = (en: string, ar: string) => this.lang.t(en, ar);
    const svc: ProfitRow[] = serviceProfitability(s);
    return [
      { title: t('Client profitability', 'ربحية العملاء'), nameLabel: t('Client', 'العميل'), rows: clientProfitability(s), showBudget: false, service: false, empty: t('No client revenue or costs yet.', 'لا توجد إيرادات أو تكاليف عملاء بعد.'), note: t('Costs = expenses linked to the client or to the client’s projects. Salaries are not allocated.', 'التكاليف = مصروفات مرتبطة بالعميل أو بمشاريعه. المرتبات غير موزعة.') },
      { title: t('Project profitability', 'ربحية المشاريع'), nameLabel: t('Project', 'المشروع'), rows: projectProfitability(s), showBudget: true, service: false, empty: t('No project revenue or costs yet.', 'لا توجد إيرادات أو تكاليف مشاريع بعد.'), note: t('Revenue = invoices linked to the project (net of tax); costs = expenses linked to it.', 'الإيراد = فواتير مرتبطة بالمشروع (بدون ضريبة)؛ التكاليف = مصروفات مرتبطة به.') },
      { title: t('Service profitability', 'ربحية الخدمات'), nameLabel: t('Service', 'الخدمة'), rows: svc, showBudget: false, service: true, empty: t('Insufficient data: tag invoice items and expenses with a service.', 'بيانات غير كافية: حدّد الخدمة في بنود الفواتير والمصروفات.'), note: t('Only expenses tagged with a service are counted as its costs, so margins may be overstated.', 'فقط المصروفات الموسومة بخدمة تُحتسب تكلفة لها، لذا قد تكون الهوامش مبالغًا فيها.') },
    ];
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const s = await this.data.snapshot();
    this.snap.set(s);
    this.target.set(await this.settings.get<number>('profitTarget', 0));
    this.refreshInsights(s);
    this.loading.set(false);
  }

  private refreshInsights(s: Snapshot): void {
    this.insights.set(analyze(s, this.target()));
  }

  protected async saveTarget(v: string): Promise<void> {
    const n = Math.max(0, Number(v) || 0);
    this.target.set(n);
    await this.settings.set('profitTarget', n);
    const s = this.snap();
    if (s) this.refreshInsights(s);
  }

  protected sevColor(s: string): string {
    return s === 'high' ? 'red' : s === 'medium' ? 'amber' : s === 'good' ? 'green' : s === 'low' ? 'blue' : 'gray';
  }
  protected sevHex(s: string): string {
    return s === 'high' ? '#ef4444' : s === 'medium' ? '#f59e0b' : s === 'good' ? '#22c55e' : '#3b82f6';
  }
  protected sevLabel(s: string): string {
    const m: Record<string, [string, string]> = { high: ['High', 'عالية'], medium: ['Medium', 'متوسطة'], low: ['Low', 'منخفضة'], info: ['Info', 'معلومة'], good: ['Positive', 'إيجابي'] };
    return this.lang.t(m[s][0], m[s][1]);
  }
  protected svcName(id: string): string {
    return optionLabel(SERVICE_TYPES, id, this.lang.lang());
  }

  protected ask(q: string): void {
    const text = q.trim();
    const s = this.snap();
    if (!text || !s) return;
    this.chat.update((c) => [{ q: text, a: answerQuestion(text, s, this.target()) }, ...c]);
    this.question.set('');
  }

  protected setScenario(id: string): void {
    this.scenario.set(id as ScenarioType);
    const defaults: Record<string, number> = { hire: 8000, lose_client: 10000, new_client: 10000, buy_equipment: 30000, marketing: 5000 };
    if (defaults[id]) this.amount.set(defaults[id]);
    if (id === 'prices') this.percent.set(10);
    if (id === 'operating_costs') this.percent.set(10);
    if (id === 'raise_salaries') this.percent.set(15);
  }

  protected amountLabel(): string {
    const m: Record<string, [string, string]> = {
      hire: ['New monthly salary (EGP)', 'المرتب الشهري الجديد (ج.م)'],
      lose_client: ['Monthly revenue lost (EGP)', 'الإيراد الشهري المفقود (ج.م)'],
      new_client: ['Monthly revenue gained (EGP)', 'الإيراد الشهري الإضافي (ج.م)'],
      buy_equipment: ['Purchase amount (EGP)', 'قيمة الشراء (ج.م)'],
      marketing: ['Extra monthly spend (EGP)', 'زيادة شهرية (ج.م)'],
    };
    const x = m[this.scenario()] || ['Amount (EGP)', 'المبلغ (ج.م)'];
    return this.lang.t(x[0], x[1]);
  }
}
