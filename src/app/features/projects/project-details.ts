import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { Repositories } from '../../core/repositories/repositories';
import { DataService } from '../../core/services/data.service';
import { Project } from '../../core/models/business';
import { PRIORITY, PROJECT_STATUS, TASK_STATUS, optionColor, optionLabel } from '../../core/constants/options';
import { Snapshot } from '../../core/accounting/snapshot';
import { projectProgress } from '../../core/utils/progress';
import { fromCents, toCents } from '../../core/utils/money';
import { EntityPage } from '../../shared/entity/entity-page';
import { EntityForm } from '../../shared/entity/entity-form';
import { PageHeader } from '../../shared/components/page-header';
import { StatCard } from '../../shared/components/stat-card';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Loading } from '../../shared/components/state-views';
import { TransactionsPage } from '../accounting/transactions-page';
import { InvoicesPage } from '../accounting/invoices-page';
import { projectConfig } from './projects.config';
import { taskConfig } from '../tasks/tasks.config';

type Tab = 'overview' | 'tasks' | 'team' | 'budget' | 'timeline';

@Component({
  selector: 'app-project-details',
  imports: [RouterLink, EntityPage, EntityForm, PageHeader, StatCard, Badge, Icon, EmptyState, Loading, TransactionsPage, InvoicesPage],
  template: `
    @if (loading()) {
      <div class="card"><app-loading /></div>
    } @else if (!project()) {
      <div class="card"><app-empty-state icon="briefcase" [title]="lang.t('Project not found', 'المشروع غير موجود')"><a routerLink="/projects" class="btn">{{ lang.t('Back to projects', 'العودة للمشاريع') }}</a></app-empty-state></div>
    } @else if (project(); as p) {
      <app-page-header [title]="p.name" [subtitle]="clientName()">
        <app-badge [color]="statusColor(p.status)">{{ statusLabel(p.status) }}</app-badge>
        <app-badge [color]="prioColor(p.priority)">{{ prioLabel(p.priority) }}</app-badge>
        <button class="btn" type="button" (click)="editing.set(true)"><app-icon name="edit" [size]="15" /> {{ lang.t('Edit', 'تعديل') }}</button>
      </app-page-header>

      <div class="tabs mb-3">
        <button class="tab" [class.active]="tab() === 'overview'" type="button" (click)="tab.set('overview')">{{ lang.t('Overview', 'نظرة عامة') }}</button>
        <button class="tab" [class.active]="tab() === 'tasks'" type="button" (click)="tab.set('tasks')">{{ lang.t('Tasks', 'المهام') }}</button>
        <button class="tab" [class.active]="tab() === 'team'" type="button" (click)="tab.set('team')">{{ lang.t('Team', 'الفريق') }}</button>
        <button class="tab" [class.active]="tab() === 'budget'" type="button" (click)="tab.set('budget')">{{ lang.t('Budget & expenses', 'الميزانية والمصروفات') }}</button>
        <button class="tab" [class.active]="tab() === 'timeline'" type="button" (click)="tab.set('timeline')">{{ lang.t('Timeline', 'الجدول الزمني') }}</button>
      </div>

      @switch (tab()) {
        @case ('tasks') { <app-entity-page [config]="tasks" [fixed]="fixed()" [embedded]="true" /> }
        @case ('team') {
          <div class="card">
            @for (e of team(); track e.id) {
              <a [routerLink]="['/team', e.id]" class="flex justify-between p-3 border-b border-line last:border-0 no-underline text-fg text-[13px]"><b>{{ e.fullName }}</b><span class="text-muted">{{ e.jobTitle }}</span></a>
            } @empty {
              <app-empty-state icon="users" [title]="lang.t('No employees assigned', 'لا يوجد موظفون مسندون')" [text]="lang.t('Edit the project to assign employees.', 'عدّل المشروع لإسناد موظفين.')" />
            }
          </div>
        }
        @case ('budget') {
          <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 mb-3">
            <app-stat-card icon="wallet" [label]="lang.t('Budget', 'الميزانية')" [value]="lang.money(p.budget)" />
            <app-stat-card icon="trend" tone="good" [label]="lang.t('Revenue (invoiced, net)', 'الإيراد (مفوتر، صافي)')" [value]="lang.money(fin().revenue)" />
            <app-stat-card icon="file" [tone]="p.budget > 0 && fin().expenses > p.budget ? 'bad' : 'warn'" [label]="lang.t('Expenses', 'المصروفات')" [value]="lang.money(fin().expenses)" [hint]="p.budget > 0 ? lang.pct((fin().expenses / p.budget) * 100, 0) + ' ' + lang.t('of budget', 'من الميزانية') : ''" />
            <app-stat-card icon="dollar" [tone]="fin().revenue - fin().expenses < 0 ? 'bad' : 'good'" [label]="lang.t('Profit', 'الربح')" [value]="lang.money(fin().revenue - fin().expenses)" />
          </div>
          <div class="card-title mb-2">{{ lang.t('Expenses', 'المصروفات') }}</div>
          <app-transactions-page [projectId]="p.id" [clientId]="''" [embedded]="true" />
          <div class="card-title mt-4 mb-2">{{ lang.t('Invoices', 'الفواتير') }}</div>
          <app-invoices-page [projectId]="p.id" [clientId]="''" [embedded]="true" />
        }
        @case ('timeline') {
          <div class="card card-pad">
            <div class="flex flex-col gap-3 text-[13px]">
              <div class="flex gap-3"><b style="min-width: 110px">{{ lang.date(p.startDate) }}</b><span>{{ lang.t('Project start', 'بداية المشروع') }}</span></div>
              @for (t of timeline(); track t.id) {
                <div class="flex gap-3"><b style="min-width: 110px">{{ t.dueDate ? lang.date(t.dueDate) : '—' }}</b>
                  <a [routerLink]="['/tasks', t.id]">{{ t.title }}</a> <app-badge [color]="taskColor(t.status)">{{ taskLabel(t.status) }}</app-badge></div>
              }
              <div class="flex gap-3"><b style="min-width: 110px">{{ lang.date(p.deadline) }}</b><span>{{ lang.t('Project deadline', 'الموعد النهائي للمشروع') }}</span></div>
            </div>
          </div>
        }
        @default {
          <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 mb-3">
            <app-stat-card icon="check" [label]="lang.t('Progress', 'التقدم')" [value]="lang.pct(progress(), 0)" [hint]="taskCount() ? lang.t('From tasks', 'من المهام') : lang.t('Manual value', 'قيمة يدوية')" />
            <app-stat-card icon="wallet" [label]="lang.t('Budget', 'الميزانية')" [value]="lang.money(p.budget)" />
            <app-stat-card icon="calendar" [label]="lang.t('Deadline', 'الموعد النهائي')" [value]="lang.date(p.deadline)" />
            <app-stat-card icon="tasks" [label]="lang.t('Tasks', 'المهام')" [value]="lang.num(taskCount())" />
          </div>
          <div class="card card-pad text-[13px]">
            <div class="progress mb-3"><div [style.width.%]="progress()"></div></div>
            <div class="flex flex-col gap-2">
              <div class="flex justify-between"><span class="text-muted">{{ lang.t('Start date', 'تاريخ البدء') }}</span><b>{{ lang.date(p.startDate) }}</b></div>
              @if (p.description) {<div><div class="label">{{ lang.t('Description', 'الوصف') }}</div><div style="white-space: pre-line">{{ p.description }}</div></div>}
              @if (p.notes) {<div><div class="label">{{ lang.t('Notes', 'ملاحظات') }}</div><div style="white-space: pre-line">{{ p.notes }}</div></div>}
            </div>
          </div>
        }
      }

      @if (editing()) {
        <app-entity-form [config]="config" [record]="p" (saved)="onEdited()" (closed)="editing.set(false)" />
      }
    }
  `,
})
export class ProjectDetails implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly repos = inject(Repositories);
  private readonly data = inject(DataService);

  protected readonly config = projectConfig();
  protected readonly tasks = taskConfig();
  protected readonly loading = signal(true);
  protected readonly editing = signal(false);
  protected readonly tab = signal<Tab>('overview');
  protected readonly project = signal<Project | null>(null);
  protected readonly snap = signal<Snapshot | null>(null);
  protected readonly clientName = signal('');

  protected readonly fixed = computed(() => ({ projectId: this.project()?.id || '' }));
  protected readonly progress = computed(() => {
    const p = this.project();
    const s = this.snap();
    return p && s ? projectProgress(p, s.tasks) : 0;
  });
  protected readonly taskCount = computed(() => this.snap()?.tasks.filter((t) => t.projectId === this.project()?.id).length || 0);
  protected readonly timeline = computed(() => (this.snap()?.tasks || []).filter((t) => t.projectId === this.project()?.id).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')));
  protected readonly team = computed(() => {
    const p = this.project();
    return (this.snap()?.employees || []).filter((e) => p?.assignedEmployeeIds?.includes(e.id));
  });
  protected readonly fin = computed(() => {
    const p = this.project();
    const s = this.snap();
    if (!p || !s) return { revenue: 0, expenses: 0 };
    const rev = s.invoices.filter((i) => i.projectId === p.id && i.status !== 'draft' && i.status !== 'cancelled').reduce((a, i) => a + toCents(i.netAmount), 0);
    const exp = s.transactions.filter((t) => t.projectId === p.id && t.type === 'expense' && !t.voided).reduce((a, t) => a + toCents(t.amount), 0);
    return { revenue: fromCents(rev), expenses: fromCents(exp) };
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') || '';
    const p = (await this.repos.projects.get(id)) || null;
    this.project.set(p);
    if (p) {
      this.snap.set(await this.data.snapshot());
      this.clientName.set((await this.repos.clients.get(p.clientId))?.name || '');
    }
    this.loading.set(false);
  }

  protected statusLabel(v: string): string {
    return optionLabel(PROJECT_STATUS, v, this.lang.lang());
  }
  protected statusColor(v: string): string {
    return optionColor(PROJECT_STATUS, v);
  }
  protected prioLabel(v: string): string {
    return optionLabel(PRIORITY, v, this.lang.lang());
  }
  protected prioColor(v: string): string {
    return optionColor(PRIORITY, v);
  }
  protected taskLabel(v: string): string {
    return optionLabel(TASK_STATUS, v, this.lang.lang());
  }
  protected taskColor(v: string): string {
    return optionColor(TASK_STATUS, v);
  }
  protected async onEdited(): Promise<void> {
    this.editing.set(false);
    await this.load();
  }
}
