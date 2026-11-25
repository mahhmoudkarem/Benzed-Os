import { Injectable, inject } from '@angular/core';
import { DbService } from '../../core/services/db.service';
import { ActivityService } from '../../core/services/activity.service';
import { Task } from '../../core/models/business';
import { TASK_STATUS, optionLabel } from '../../core/constants/options';
import { cairoDate, isoNow } from '../../core/utils/date';
import { uid } from '../../core/utils/id';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly db = inject(DbService).db;
  private readonly activity = inject(ActivityService);

  private async addHistory(taskId: string, type: string, from: string | undefined, to: string | undefined): Promise<void> {
    const now = isoNow();
    await this.db.taskHistory.add({ id: uid(), taskId, type, fromValue: from, toValue: to, text: '', createdAt: now, updatedAt: now });
  }

  /** إنشاء/تعديل مهمة مع تسجيل التاريخ والتحقق من العلاقات */
  save(value: Record<string, any>, existing: Task | null): Promise<Task> {
    return this.db.transaction('rw', this.db.tables, async () => {
      const v: Record<string, any> = { ...value };
      if (v['projectId']) {
        const p = await this.db.projects.get(v['projectId']);
        if (!p) throw new Error('Project not found.');
        if (v['clientId'] && v['clientId'] !== p.clientId) throw new Error('The selected project belongs to a different client.');
        v['clientId'] = p.clientId;
      }
      if (v['startDate'] && v['dueDate'] && v['dueDate'] < v['startDate']) throw new Error('Due date cannot be before the start date.');
      // الحالة التلقائية: مهمة جديدة بموظف = مُسندة
      if (v['assigneeId'] && v['status'] === 'new') v['status'] = 'assigned';
      if (!v['assigneeId'] && v['status'] === 'assigned') v['status'] = 'new';
      const now = isoNow();
      if (!existing) {
        const t: Task = { ...(v as Task), id: uid(), createdDate: cairoDate(), completedAt: v['status'] === 'completed' ? now : undefined, createdAt: now, updatedAt: now };
        await this.db.tasks.add(t);
        await this.addHistory(t.id, 'created', undefined, t.status);
        await this.activity.log('task_created', 'task', t.id, 'Task created: ' + t.title, 'تم إنشاء مهمة: ' + t.title);
        return t;
      }
      const changes: Record<string, any> = { ...v, updatedAt: now };
      delete changes['id'];
      delete changes['createdAt'];
      delete changes['createdDate'];
      if (v['status'] !== existing.status) changes['completedAt'] = v['status'] === 'completed' ? now : undefined;
      await this.db.tasks.update(existing.id, changes as any);
      if (v['status'] !== existing.status) {
        await this.addHistory(existing.id, 'status', existing.status, v['status']);
        await this.activity.log('task_status', 'task', existing.id, 'Task status changed: ' + existing.title + ' → ' + optionLabel(TASK_STATUS, v['status'], 'en'), 'تغيرت حالة المهمة: ' + existing.title + ' ← ' + optionLabel(TASK_STATUS, v['status'], 'ar'));
      }
      if ((v['assigneeId'] || '') !== (existing.assigneeId || '')) await this.addHistory(existing.id, 'assignee', existing.assigneeId, v['assigneeId']);
      if (v['priority'] !== existing.priority) await this.addHistory(existing.id, 'priority', existing.priority, v['priority']);
      if ((v['dueDate'] || '') !== (existing.dueDate || '')) await this.addHistory(existing.id, 'due', existing.dueDate, v['dueDate']);
      return (await this.db.tasks.get(existing.id)) as Task;
    }) as Promise<Task>;
  }

  /** تغيير سريع للحالة (كانبان / صفحة التفاصيل) */
  async changeStatus(task: Task, status: string): Promise<void> {
    if (task.status === status) return;
    await this.save({ ...task, status }, task);
  }

  async assign(task: Task, assigneeId: string): Promise<void> {
    await this.save({ ...task, assigneeId: assigneeId || undefined, status: task.status === 'assigned' && !assigneeId ? 'new' : task.status }, task);
  }

  async addComment(taskId: string, text: string): Promise<void> {
    const t = text.trim();
    if (!t) throw new Error('Comment cannot be empty.');
    const now = isoNow();
    await this.db.taskComments.add({ id: uid(), taskId, text: t, createdAt: now, updatedAt: now });
  }

  /** حذف مهمة مع سجلها وتعليقاتها وجلسات العمل المرتبطة */
  async deleteTask(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.db.taskComments.where('taskId').equals(id).delete();
      await this.db.taskHistory.where('taskId').equals(id).delete();
      await this.db.workSessions.where('taskId').equals(id).modify({ taskId: undefined });
      await this.db.tasks.delete(id);
    });
  }
}
