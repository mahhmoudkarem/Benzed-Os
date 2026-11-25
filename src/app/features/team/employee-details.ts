import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { Repositories } from '../../core/repositories/repositories';
import { Employee, Task, WorkSession } from '../../core/models/business';
import { DEPARTMENTS, EMPLOYMENT_STATUS, TASK_STATUS, optionColor, optionLabel } from '../../core/constants/options';
import { cairoDate } from '../../core/utils/date';
import { EntityPage } from '../../shared/entity/entity-page';
import { EntityForm } from '../../shared/entity/entity-form';
import { PageHeader } from '../../shared/components/page-header';
import { StatCard } from '../../shared/components/stat-card';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Loading } from '../../shared/components/state-views';
import { employeeConfig, workSessionConfig } from './team.config';
import { taskConfig } from '../tasks/tasks.config';

type Tab = 'info' | 'tasks' | 'completed' | 'sessions';

@Component({
  selector: 'app-employee-details',
  imports: [RouterLink, EntityPage, EntityForm, PageHeader, StatCard, Badge, Icon, EmptyState, Loading],
  template: `
    @if (loading()) {
      <div class="card"><app-loading /></div>
    } @else if (!emp()) {
      <div class="card"><app-empty-state icon="user" [title]="lang.t('Employee not found', 'الموظف غير موجود')"><a routerLink="/team" class="btn">{{ lang.t('Back to team', 'العودة للفريق') }}</a></app-empty-state></div>
    } @else if (emp(); as e) {
      <app-page-header [title]="e.fullName" [subtitle]="e.jobTitle + ' · ' + deptLabel(e.department)">
        <app-badge [color]="statusColor(e.employmentStatus)">{{ statusLabel(e.employmentStatus) }}</app-badge>
        @if (e.archived) {<app-badge color="gray">{{ lang.t('Archived', 'مؤرشف') }}</app-badge>}
        <button class="btn" type="button" (click)="editing.set(true)"><app-icon name="edit" [size]="15" /> {{ lang.t('Edit', 'تعديل') }}</button>
      </app-page-header>

      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 mb-3">
        <app-stat-card icon="tasks" [label]="lang.t('Open tasks', 'مهام مفتوحة')" [value]="lang.num(stats().open)" />
        <app-stat-card icon="alert" [tone]="stats().overdue ? 'bad' : 'default'" [label]="lang.t('Overdue', 'متأخرة')" [value]="lang.num(stats().overdue)" />
        <app-stat-card icon="check" tone="good" [label]="lang.t('Completed', 'مكتملة')" [value]="lang.num(stats().done)" />
        <app-stat-card icon="clock" [label]="lang.t('Logged hours', 'ساعات مسجلة')" [value]="lang.num(stats().hours, 1)" />
      </div>

      <div class="tabs mb-3">
        <button class="tab" [class.active]="tab() === 'info'" type="button" (click)="tab.set('info')">{{ lang.t('Details', 'التفاصيل') }}</button>
        <button class="tab" [class.active]="tab() === 'tasks'" type="button" (click)="tab.set('tasks')">{{ lang.t('Assigned tasks', 'المهام المسندة') }}</button>
        <button class="tab" [class.active]="tab() === 'completed'" type="button" (click)="tab.set('completed')">{{ lang.t('Completed tasks', 'المهام المكتملة') }}</button>
        <button class="tab" [class.active]="tab() === 'sessions'" type="button" (click)="tab.set('sessions')">{{ lang.t('Work sessions', 'جلسات العمل') }}</button>
      </div>

      @switch (tab()) {
        @case ('tasks') { <app-entity-page [config]="tasks" [fixed]="fixedTasks()" [embedded]="true" /> }
        @case ('sessions') { <app-entity-page [config]="sessions" [fixed]="fixedTasks2()" [embedded]="true" /> }
        @case ('completed') {
          <div class="card">
            @for (t of completed(); track t.id) {
              <a [routerLink]="['/tasks', t.id]" class="flex justify-between gap-3 p-3 border-b border-line last:border-0 no-underline text-fg text-[13px]"><span>{{ t.title }}</span><span class="text-muted text-[12px]">{{ lang.dateTime(t.completedAt) }}</span></a>
            } @empty {
              <app-empty-state icon="check" [title]="lang.t('No completed tasks yet', 'لا توجد مهام مكتملة بعد')" />
            }
          </div>
        }
        @default {
          <div class="card card-pad grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
            @for (r of rows(); track r[0]) {
              <div class="flex justify-between border-b border-line py-1.5"><span class="text-muted">{{ r[0] }}</span><b>{{ r[1] || '—' }}</b></div>
            }
            @if (e.notes) {<div class="sm:col-span-2"><div class="label">{{ lang.t('Notes', 'ملاحظات') }}</div><div style="white-space: pre-line">{{ e.notes }}</div></div>}
          </div>
        }
      }

      @if (editing()) {
        <app-entity-form [config]="config" [record]="e" (saved)="onEdited()" (closed)="editing.set(false)" />
      }
    }
  `,
})
export class EmployeeDetails implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly repos = inject(Repositories);

  protected readonly config = employeeConfig();
  protected readonly tasks = taskConfig();
  protected readonly sessions = workSessionConfig();
  protected readonly loading = signal(true);
  protected readonly editing = signal(false);
  protected readonly tab = signal<Tab>('info');
  protected readonly emp = signal<Employee | null>(null);
  protected readonly taskList = signal<Task[]>([]);
  protected readonly sessionList = signal<WorkSession[]>([]);

  protected readonly fixedTasks = computed(() => ({ assigneeId: this.emp()?.id || '' }));
  protected readonly fixedTasks2 = computed(() => ({ employeeId: this.emp()?.id || '' }));
  protected readonly completed = computed(() => this.taskList().filter((t) => t.status === 'completed').sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')));
  protected readonly stats = computed(() => {
    const today = cairoDate();
    const t = this.taskList();
    return {
      open: t.filter((x) => x.status !== 'completed').length,
      overdue: t.filter((x) => x.status !== 'completed' && x.dueDate && x.dueDate < today).length,
      done: t.filter((x) => x.status === 'completed').length,
      hours: this.sessionList().reduce((a, s) => a + (Number(s.hours) || 0), 0),
    };
  });
  protected readonly rows = computed<[string, string][]>(() => {
    const e = this.emp();
    if (!e) return [];
    const t = (en: string, ar: string) => this.lang.t(en, ar);
    return [
      [t('Email', 'البريد'), e.email],
      [t('Phone', 'الهاتف'), e.phone],
      [t('Specialization', 'التخصص'), e.specialization],
      [t('Joined', 'تاريخ الانضمام'), this.lang.date(e.joiningDate)],
      [t('Monthly salary', 'المرتب الشهري'), this.lang.money(e.monthlySalary)],
      [t('Profile image', 'الصورة الشخصية'), e.imageUrl],
    ];
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') || '';
    const e = (await this.repos.employees.get(id)) || null;
    this.emp.set(e);
    if (e) {
      this.taskList.set(await this.repos.tasks.where('assigneeId', id));
      this.sessionList.set(await this.repos.workSessions.where('employeeId', id));
    }
    this.loading.set(false);
  }

  protected deptLabel(v: string): string {
    return optionLabel(DEPARTMENTS, v, this.lang.lang());
  }
  protected statusLabel(v: string): string {
    return optionLabel(EMPLOYMENT_STATUS, v, this.lang.lang());
  }
  protected statusColor(v: string): string {
    return optionColor(EMPLOYMENT_STATUS, v);
  }
  protected async onEdited(): Promise<void> {
    this.editing.set(false);
    await this.load();
  }
}

export { TASK_STATUS };
