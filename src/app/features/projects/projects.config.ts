import { inject } from '@angular/core';
import { EntityConfig } from '../../shared/entity/entity.types';
import { PRIORITY, PROJECT_STATUS } from '../../core/constants/options';
import { L_CLIENT, L_EMPLOYEE } from '../../core/constants/lookups';
import { DbService } from '../../core/services/db.service';
import { cairoDate } from '../../core/utils/date';

export function projectConfig(): EntityConfig {
  const db = inject(DbService).db;
  return {
    table: 'projects',
    title: { en: 'Projects', ar: 'المشاريع' },
    singular: { en: 'Project', ar: 'مشروع' },
    icon: 'briefcase',
    archive: true,
    titleOf: (r) => r.name,
    detailRoute: (r) => ['/projects', r.id],
    defaultSort: { key: 'deadline', dir: 'asc' },
    searchKeys: ['name', 'description'],
    filters: [
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, options: PROJECT_STATUS },
      { key: 'priority', label: { en: 'Priority', ar: 'الأولوية' }, options: PRIORITY },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, lookup: L_CLIENT },
    ],
    columns: [
      { key: 'name', label: { en: 'Project', ar: 'المشروع' }, link: true },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'lookup', lookup: L_CLIENT },
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, type: 'badge', options: PROJECT_STATUS },
      { key: 'priority', label: { en: 'Priority', ar: 'الأولوية' }, type: 'badge', options: PRIORITY },
      { key: 'startDate', label: { en: 'Start', ar: 'البداية' }, type: 'date' },
      { key: 'deadline', label: { en: 'Deadline', ar: 'الموعد النهائي' }, type: 'date' },
      { key: 'budget', label: { en: 'Budget', ar: 'الميزانية' }, type: 'money' },
    ],
    fields: [
      { key: 'name', label: { en: 'Project name', ar: 'اسم المشروع' }, type: 'text', required: true, maxLength: 140, colSpan: 2 },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'select', lookup: L_CLIENT, required: true },
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, type: 'select', options: PROJECT_STATUS, required: true, default: 'planning' },
      { key: 'priority', label: { en: 'Priority', ar: 'الأولوية' }, type: 'select', options: PRIORITY, required: true, default: 'medium' },
      { key: 'budget', label: { en: 'Budget (EGP)', ar: 'الميزانية (ج.م)' }, type: 'money', min: 0, default: 0 },
      { key: 'startDate', label: { en: 'Start date', ar: 'تاريخ البدء' }, type: 'date', required: true, default: '$today' },
      { key: 'deadline', label: { en: 'Deadline', ar: 'الموعد النهائي' }, type: 'date', required: true },
      { key: 'progress', label: { en: 'Manual progress % (used when no tasks)', ar: 'التقدم اليدوي % (يُستخدم عند عدم وجود مهام)' }, type: 'number', min: 0, max: 100, default: 0 },
      { key: 'assignedEmployeeIds', label: { en: 'Assigned employees', ar: 'الموظفون المسندون' }, type: 'multiselect', lookup: L_EMPLOYEE },
      { key: 'description', label: { en: 'Description', ar: 'الوصف' }, type: 'textarea' },
      { key: 'notes', label: { en: 'Notes', ar: 'ملاحظات' }, type: 'textarea' },
    ],
    defaults: () => ({ archived: false, assignedEmployeeIds: [] }),
    validate: (v) => (v['deadline'] && v['startDate'] && v['deadline'] < v['startDate'] ? { deadline: { en: 'Deadline cannot be before the start date', ar: 'الموعد النهائي لا يمكن أن يسبق تاريخ البدء' } } : null),
    beforeSave: (v, existing) => {
      const out = { ...v };
      if (out['status'] === 'completed') out['completedDate'] = existing?.completedDate || cairoDate();
      else out['completedDate'] = undefined;
      return out;
    },
    deleteGuard: async (row) => {
      const n = (await db.tasks.where('projectId').equals(row.id).count()) + (await db.invoices.where('projectId').equals(row.id).count()) + (await db.transactions.where('projectId').equals(row.id).count());
      return n > 0 ? { en: 'This project has tasks, invoices or expenses. Archive it instead of deleting.', ar: 'لهذا المشروع مهام أو فواتير أو مصروفات. قم بأرشفته بدلًا من الحذف.' } : null;
    },
  };
}
