import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { Repositories } from '../../core/repositories/repositories';
import { ToastService } from '../../core/services/toast.service';
import { Task } from '../../core/models/business';
import { PRIORITY, TASK_STATUS, optionColor, optionLabel } from '../../core/constants/options';
import { cairoDate } from '../../core/utils/date';
import { TaskService } from './task.service';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { Loading } from '../../shared/components/state-views';

@Component({
  selector: 'app-task-kanban',
  imports: [RouterLink, Badge, Icon, Loading],
  template: `
    <div class="flex flex-wrap gap-2 mb-3">
      <div class="relative" style="min-width: 200px; max-width: 300px; flex: 1">
        <span class="absolute top-1/2 -translate-y-1/2 start-2.5 text-muted pointer-events-none"><app-icon name="search" [size]="15" /></span>
        <input class="input" style="padding-inline-start: 32px" [placeholder]="lang.t('Search tasks…', 'بحث في المهام…')" [value]="search()" (input)="search.set($any($event.target).value)" />
      </div>
      <select class="select" style="width: auto" (change)="assignee.set($any($event.target).value)">
        <option value="">{{ lang.t('All assignees', 'كل المسؤولين') }}</option>
        @for (e of employees(); track e.id) {
          <option [value]="e.id">{{ e.name }}</option>
        }
      </select>
      <select class="select" style="width: auto" (change)="priority.set($any($event.target).value)">
        <option value="">{{ lang.t('All priorities', 'كل الأولويات') }}</option>
        @for (p of priorities; track p.value) {
          <option [value]="p.value">{{ lang.l(p.label) }}</option>
        }
      </select>
    </div>
    @if (loading()) {
      <div class="card"><app-loading /></div>
    } @else {
      <div class="flex gap-3 overflow-x-auto pb-3">
        @for (col of columns; track col.value) {
          <div class="kanban-col" (dragover)="$event.preventDefault()" (drop)="onDrop($event, col.value)">
            <div class="flex items-center justify-between p-3 border-b border-line">
              <app-badge [color]="col.color || 'gray'">{{ lang.l(col.label) }}</app-badge>
              <span class="text-muted text-[12px]">{{ lang.num(byStatus()[col.value]?.length || 0) }}</span>
            </div>
            <div class="p-2 flex flex-col gap-2 overflow-y-auto" style="min-height: 80px">
              @for (t of byStatus()[col.value] || []; track t.id) {
                <div class="kanban-card" draggable="true" (dragstart)="onDrag($event, t)">
                  <a [routerLink]="['/tasks', t.id]" class="font-semibold text-fg no-underline text-[13px]">{{ t.title }}</a>
                  <div class="text-[12px] text-muted mt-1">{{ names()[t.clientId || ''] || '' }}</div>
                  <div class="flex items-center justify-between mt-2 gap-2">
                    <app-badge [color]="prioColor(t.priority)">{{ prioLabel(t.priority) }}</app-badge>
                    <span class="text-[11.5px]" [style.color]="isLate(t) ? 'var(--danger)' : 'var(--muted)'">{{ t.dueDate ? lang.date(t.dueDate) : '' }}</span>
                  </div>
                  @if (t.assigneeId) {
                    <div class="text-[12px] mt-1.5 flex items-center gap-1 text-muted"><app-icon name="user" [size]="12" /> {{ emp()[t.assigneeId] || '—' }}</div>
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class TaskKanban implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly repos = inject(Repositories);
  private readonly svc = inject(TaskService);
  private readonly toast = inject(ToastService);

  protected readonly columns = TASK_STATUS;
  protected readonly priorities = PRIORITY;
  protected readonly loading = signal(true);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly search = signal('');
  protected readonly assignee = signal('');
  protected readonly priority = signal('');
  protected readonly emp = signal<Record<string, string>>({});
  protected readonly names = signal<Record<string, string>>({});
  protected readonly employees = computed(() => Object.entries(this.emp()).map(([id, name]) => ({ id, name })));

  protected readonly byStatus = computed(() => {
    const q = this.search().trim().toLowerCase();
    const out: Record<string, Task[]> = {};
    for (const t of this.tasks()) {
      if (this.assignee() && t.assigneeId !== this.assignee()) continue;
      if (this.priority() && t.priority !== this.priority()) continue;
      if (q && !(t.title + ' ' + (t.description || '')).toLowerCase().includes(q)) continue;
      (out[t.status] = out[t.status] || []).push(t);
    }
    return out;
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const [tasks, emps, clients] = await Promise.all([this.repos.tasks.list(), this.repos.employees.list(), this.repos.clients.list()]);
    this.tasks.set(tasks);
    this.emp.set(Object.fromEntries(emps.filter((e) => !e.archived).map((e) => [e.id, e.fullName])));
    this.names.set(Object.fromEntries(clients.map((c) => [c.id, c.name])));
    this.loading.set(false);
  }

  protected prioColor(p: string): string {
    return optionColor(PRIORITY, p);
  }
  protected prioLabel(p: string): string {
    return optionLabel(PRIORITY, p, this.lang.lang());
  }
  protected isLate(t: Task): boolean {
    return t.status !== 'completed' && !!t.dueDate && t.dueDate < cairoDate();
  }

  protected onDrag(e: DragEvent, t: Task): void {
    e.dataTransfer?.setData('text/plain', t.id);
  }

  protected async onDrop(e: DragEvent, status: string): Promise<void> {
    e.preventDefault();
    const id = e.dataTransfer?.getData('text/plain');
    const t = this.tasks().find((x) => x.id === id);
    if (!t || t.status === status) return;
    try {
      await this.svc.changeStatus(t, status);
      await this.load();
    } catch (err: any) {
      this.toast.error(String(err?.message || err));
    }
  }
}
