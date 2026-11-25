import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { Repositories } from '../../core/repositories/repositories';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { Task, TaskComment, TaskHistory, WorkSession } from '../../core/models/business';
import { PRIORITY, TASK_STATUS, optionColor, optionLabel } from '../../core/constants/options';
import { cairoDate } from '../../core/utils/date';
import { TaskService } from './task.service';
import { taskConfig } from './tasks.config';
import { EntityForm } from '../../shared/entity/entity-form';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Loading } from '../../shared/components/state-views';
import { PageHeader } from '../../shared/components/page-header';

@Component({
  selector: 'app-task-details',
  imports: [RouterLink, Badge, Icon, EntityForm, EmptyState, Loading, PageHeader],
  template: `
    @if (loading()) {
      <div class="card"><app-loading /></div>
    } @else if (!task()) {
      <div class="card"><app-empty-state icon="tasks" [title]="lang.t('Task not found', 'المهمة غير موجودة')"><a routerLink="/tasks" class="btn">{{ lang.t('Back to tasks', 'العودة للمهام') }}</a></app-empty-state></div>
    } @else if (task(); as t) {
      <app-page-header [title]="t.title" [subtitle]="(clientName() || '') + (projectName() ? ' · ' + projectName() : '')">
        <button class="btn" type="button" (click)="editing.set(true)"><app-icon name="edit" [size]="15" /> {{ lang.t('Edit', 'تعديل') }}</button>
        <button class="btn btn-danger" type="button" (click)="remove()"><app-icon name="trash" [size]="15" /> {{ lang.t('Delete', 'حذف') }}</button>
      </app-page-header>

      <div class="grid gap-3 grid-cols-1 lg:grid-cols-3">
        <div class="card card-pad lg:col-span-1">
          <div class="flex flex-col gap-3 text-[13px]">
            <div>
              <div class="label">{{ lang.t('Status', 'الحالة') }}</div>
              <select class="select" (change)="setStatus($any($event.target).value)">
                @for (s of statuses; track s.value) {
                  <option [value]="s.value" [selected]="t.status === s.value">{{ lang.l(s.label) }}</option>
                }
              </select>
            </div>
            <div>
              <div class="label">{{ lang.t('Assigned employee', 'الموظف المسؤول') }}</div>
              <select class="select" (change)="setAssignee($any($event.target).value)">
                <option value="" [selected]="!t.assigneeId">—</option>
                @for (e of employees(); track e.id) {
                  <option [value]="e.id" [selected]="t.assigneeId === e.id">{{ e.name }}</option>
                }
              </select>
            </div>
            <div class="flex justify-between"><span class="text-muted">{{ lang.t('Priority', 'الأولوية') }}</span><app-badge [color]="prioColor(t.priority)">{{ prioLabel(t.priority) }}</app-badge></div>
            <div class="flex justify-between"><span class="text-muted">{{ lang.t('Created', 'تاريخ الإنشاء') }}</span><b>{{ lang.date(t.createdDate) }}</b></div>
            <div class="flex justify-between"><span class="text-muted">{{ lang.t('Start', 'البداية') }}</span><b>{{ lang.date(t.startDate) }}</b></div>
            <div class="flex justify-between"><span class="text-muted">{{ lang.t('Due', 'الاستحقاق') }}</span><b [style.color]="late() ? 'var(--danger)' : ''">{{ lang.date(t.dueDate) }}</b></div>
            <div class="flex justify-between"><span class="text-muted">{{ lang.t('Estimated', 'المقدّر') }}</span><b>{{ lang.num(t.estimatedHours, 1) }} {{ lang.t('h', 'س') }}</b></div>
            <div class="flex justify-between"><span class="text-muted">{{ lang.t('Actual (entered)', 'الفعلي (المُدخل)') }}</span><b>{{ lang.num(t.actualHours, 1) }} {{ lang.t('h', 'س') }}</b></div>
            <div class="flex justify-between"><span class="text-muted">{{ lang.t('Logged work sessions', 'جلسات العمل المسجلة') }}</span><b>{{ lang.num(sessionHours(), 1) }} {{ lang.t('h', 'س') }}</b></div>
            @if (t.description) {<div><div class="label">{{ lang.t('Description', 'الوصف') }}</div><div style="white-space: pre-line">{{ t.description }}</div></div>}
            @if (t.notes) {<div><div class="label">{{ lang.t('Notes', 'ملاحظات') }}</div><div style="white-space: pre-line">{{ t.notes }}</div></div>}
          </div>
        </div>

        <div class="lg:col-span-2 flex flex-col gap-3">
          <div class="card card-pad">
            <div class="card-title mb-2">{{ lang.t('Comments', 'التعليقات') }}</div>
            <div class="flex gap-2 mb-3">
              <input class="input" [placeholder]="lang.t('Write a comment…', 'اكتب تعليقًا…')" [value]="comment()" (input)="comment.set($any($event.target).value)" (keydown.enter)="addComment()" />
              <button class="btn btn-primary" type="button" (click)="addComment()">{{ lang.t('Add', 'إضافة') }}</button>
            </div>
            @for (c of comments(); track c.id) {
              <div class="py-2 border-b border-line last:border-0">
                <div class="text-[13px]" style="white-space: pre-line">{{ c.text }}</div>
                <div class="text-[11.5px] text-muted mt-0.5">{{ lang.dateTime(c.createdAt) }}</div>
              </div>
            } @empty {
              <app-empty-state icon="info" [title]="lang.t('No comments yet', 'لا توجد تعليقات بعد')" />
            }
          </div>
          <div class="card card-pad">
            <div class="card-title mb-2">{{ lang.t('History', 'السجل') }}</div>
            @for (h of history(); track h.id) {
              <div class="py-2 border-b border-line last:border-0 flex justify-between gap-3 text-[13px]">
                <span>{{ describe(h) }}</span>
                <span class="text-muted text-[12px] whitespace-nowrap">{{ lang.dateTime(h.createdAt) }}</span>
              </div>
            } @empty {
              <app-empty-state icon="clock" [title]="lang.t('No history', 'لا يوجد سجل')" />
            }
          </div>
        </div>
      </div>
    }
    @if (editing() && task()) {
      <app-entity-form [config]="config" [record]="task()" (saved)="onEdited()" (closed)="editing.set(false)" />
    }
  `,
})
export class TaskDetails implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repos = inject(Repositories);
  private readonly svc = inject(TaskService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly config = taskConfig();
  protected readonly statuses = TASK_STATUS;
  protected readonly loading = signal(true);
  protected readonly task = signal<Task | null>(null);
  protected readonly comments = signal<TaskComment[]>([]);
  protected readonly history = signal<TaskHistory[]>([]);
  protected readonly sessions = signal<WorkSession[]>([]);
  protected readonly emp = signal<Record<string, string>>({});
  protected readonly clientName = signal('');
  protected readonly projectName = signal('');
  protected readonly comment = signal('');
  protected readonly editing = signal(false);
  protected readonly employees = computed(() => Object.entries(this.emp()).map(([id, name]) => ({ id, name })));
  protected readonly sessionHours = computed(() => this.sessions().reduce((a, s) => a + (Number(s.hours) || 0), 0));
  protected readonly late = computed(() => {
    const t = this.task();
    return !!t && t.status !== 'completed' && !!t.dueDate && t.dueDate < cairoDate();
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') || '';
    const t = (await this.repos.tasks.get(id)) || null;
    this.task.set(t);
    if (t) {
      const [c, h, s, emps] = await Promise.all([
        this.repos.taskComments.where('taskId', id),
        this.repos.taskHistory.where('taskId', id),
        this.repos.workSessions.where('taskId', id),
        this.repos.employees.list(),
      ]);
      this.comments.set(c.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      this.history.set(h.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      this.sessions.set(s);
      this.emp.set(Object.fromEntries(emps.filter((e) => !e.archived).map((e) => [e.id, e.fullName])));
      this.clientName.set(t.clientId ? (await this.repos.clients.get(t.clientId))?.name || '' : '');
      this.projectName.set(t.projectId ? (await this.repos.projects.get(t.projectId))?.name || '' : '');
    }
    this.loading.set(false);
  }

  protected prioColor(p: string): string {
    return optionColor(PRIORITY, p);
  }
  protected prioLabel(p: string): string {
    return optionLabel(PRIORITY, p, this.lang.lang());
  }

  protected describe(h: TaskHistory): string {
    const L = this.lang.lang();
    const st = (v?: string) => optionLabel(TASK_STATUS, v, L);
    const who = (v?: string) => (v ? this.emp()[v] || '—' : '—');
    switch (h.type) {
      case 'created':
        return this.lang.t('Task created', 'تم إنشاء المهمة') + ' (' + st(h.toValue) + ')';
      case 'status':
        return this.lang.t('Status: ', 'الحالة: ') + st(h.fromValue) + ' → ' + st(h.toValue);
      case 'assignee':
        return this.lang.t('Assignee: ', 'المسؤول: ') + who(h.fromValue) + ' → ' + who(h.toValue);
      case 'priority':
        return this.lang.t('Priority: ', 'الأولوية: ') + optionLabel(PRIORITY, h.fromValue, L) + ' → ' + optionLabel(PRIORITY, h.toValue, L);
      case 'due':
        return this.lang.t('Due date: ', 'الاستحقاق: ') + this.lang.date(h.fromValue) + ' → ' + this.lang.date(h.toValue);
      default:
        return h.type;
    }
  }

  protected async setStatus(status: string): Promise<void> {
    const t = this.task();
    if (!t) return;
    try {
      await this.svc.changeStatus(t, status);
      await this.load();
      this.toast.success(this.lang.t('Status updated', 'تم تحديث الحالة'));
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
      await this.load();
    }
  }

  protected async setAssignee(id: string): Promise<void> {
    const t = this.task();
    if (!t) return;
    try {
      await this.svc.assign(t, id);
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }

  protected async addComment(): Promise<void> {
    const t = this.task();
    if (!t) return;
    try {
      await this.svc.addComment(t.id, this.comment());
      this.comment.set('');
      await this.load();
    } catch (e: any) {
      this.toast.warning(String(e?.message || e));
    }
  }

  protected async onEdited(): Promise<void> {
    this.editing.set(false);
    await this.load();
  }

  protected async remove(): Promise<void> {
    const t = this.task();
    if (!t) return;
    const ok = await this.confirm.confirm({ titleEn: 'Delete task', titleAr: 'حذف المهمة', messageEn: 'Delete "' + t.title + '" with its comments and history?', messageAr: 'حذف "' + t.title + '" مع تعليقاتها وسجلها؟', danger: true, confirmEn: 'Delete', confirmAr: 'حذف' });
    if (!ok) return;
    await this.svc.deleteTask(t.id);
    this.toast.success(this.lang.t('Deleted', 'تم الحذف'));
    await this.router.navigateByUrl('/tasks');
  }
}
