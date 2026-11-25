import { inject } from '@angular/core';
import { EntityConfig } from '../../shared/entity/entity.types';
import { PRIORITY, TASK_STATUS } from '../../core/constants/options';
import { L_CLIENT, L_EMPLOYEE, L_PROJECT } from '../../core/constants/lookups';
import { TaskService } from './task.service';
import { cairoDate } from '../../core/utils/date';

export function taskConfig(): EntityConfig {
  const svc = inject(TaskService);
  return {
    table: 'tasks',
    title: { en: 'Tasks', ar: 'المهام' },
    singular: { en: 'Task', ar: 'مهمة' },
    icon: 'tasks',
    titleOf: (r) => r.title,
    detailRoute: (r) => ['/tasks', r.id],
    defaultSort: { key: 'dueDate', dir: 'asc' },
    searchKeys: ['title', 'description', 'notes'],
    filters: [
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, options: TASK_STATUS },
      { key: 'priority', label: { en: 'Priority', ar: 'الأولوية' }, options: PRIORITY },
      { key: 'assigneeId', label: { en: 'Assignee', ar: 'المسؤول' }, lookup: L_EMPLOYEE },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, lookup: L_CLIENT },
    ],
    columns: [
      { key: 'title', label: { en: 'Task', ar: 'المهمة' }, link: true },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'lookup', lookup: L_CLIENT },
      { key: 'assigneeId', label: { en: 'Assignee', ar: 'المسؤول' }, type: 'lookup', lookup: L_EMPLOYEE },
      { key: 'priority', label: { en: 'Priority', ar: 'الأولوية' }, type: 'badge', options: PRIORITY },
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, type: 'badge', options: TASK_STATUS },
      {
        key: 'dueDate',
        label: { en: 'Due', ar: 'الاستحقاق' },
        type: 'custom',
        render: (r, ctx) => (r.dueDate ? ctx.date(r.dueDate) + (r.status !== 'completed' && r.dueDate < cairoDate() ? (ctx.lang === 'ar' ? ' ⚠ متأخرة' : ' ⚠ overdue') : '') : '—'),
      },
    ],
    fields: [
      { key: 'title', label: { en: 'Title', ar: 'العنوان' }, type: 'text', required: true, maxLength: 160, colSpan: 2 },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'select', lookup: L_CLIENT },
      { key: 'projectId', label: { en: 'Project', ar: 'المشروع' }, type: 'select', lookup: L_PROJECT },
      { key: 'assigneeId', label: { en: 'Assigned employee', ar: 'الموظف المسؤول' }, type: 'select', lookup: L_EMPLOYEE },
      { key: 'priority', label: { en: 'Priority', ar: 'الأولوية' }, type: 'select', options: PRIORITY, required: true, default: 'medium' },
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, type: 'select', options: TASK_STATUS, required: true, default: 'new' },
      { key: 'startDate', label: { en: 'Start date', ar: 'تاريخ البدء' }, type: 'date', default: '$today' },
      { key: 'dueDate', label: { en: 'Due date', ar: 'تاريخ الاستحقاق' }, type: 'date', required: true },
      { key: 'estimatedHours', label: { en: 'Estimated duration (hours)', ar: 'المدة المقدرة (ساعات)' }, type: 'number', min: 0, default: 0 },
      { key: 'actualHours', label: { en: 'Actual duration (hours)', ar: 'المدة الفعلية (ساعات)' }, type: 'number', min: 0, default: 0 },
      { key: 'description', label: { en: 'Description', ar: 'الوصف' }, type: 'textarea' },
      { key: 'notes', label: { en: 'Notes', ar: 'ملاحظات' }, type: 'textarea' },
    ],
    validate: (v) => (v['dueDate'] && v['startDate'] && v['dueDate'] < v['startDate'] ? { dueDate: { en: 'Due date cannot be before the start date', ar: 'تاريخ الاستحقاق لا يمكن أن يسبق البداية' } } : null),
    persist: (value, existing) => svc.save(value, existing),
    remove: (row) => svc.deleteTask(row.id),
  };
}
