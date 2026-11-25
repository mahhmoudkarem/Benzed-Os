import { inject } from '@angular/core';
import { EntityConfig } from '../../shared/entity/entity.types';
import { DEPARTMENTS, EMPLOYMENT_STATUS } from '../../core/constants/options';
import { L_EMPLOYEE, L_TASK } from '../../core/constants/lookups';
import { DbService } from '../../core/services/db.service';

export function employeeConfig(): EntityConfig {
  const db = inject(DbService).db;
  return {
    table: 'employees',
    title: { en: 'Team', ar: 'الفريق' },
    singular: { en: 'Employee', ar: 'موظف' },
    icon: 'user',
    archive: true,
    titleOf: (r) => r.fullName,
    detailRoute: (r) => ['/team', r.id],
    defaultSort: { key: 'fullName', dir: 'asc' },
    searchKeys: ['fullName', 'jobTitle', 'specialization', 'email', 'phone'],
    filters: [
      { key: 'department', label: { en: 'Department', ar: 'القسم' }, options: DEPARTMENTS },
      { key: 'employmentStatus', label: { en: 'Status', ar: 'الحالة' }, options: EMPLOYMENT_STATUS },
    ],
    columns: [
      { key: 'fullName', label: { en: 'Name', ar: 'الاسم' }, link: true },
      { key: 'jobTitle', label: { en: 'Job title', ar: 'المسمى الوظيفي' } },
      { key: 'department', label: { en: 'Department', ar: 'القسم' }, type: 'badge', options: DEPARTMENTS },
      { key: 'specialization', label: { en: 'Specialization', ar: 'التخصص' } },
      { key: 'employmentStatus', label: { en: 'Status', ar: 'الحالة' }, type: 'badge', options: EMPLOYMENT_STATUS },
      { key: 'monthlySalary', label: { en: 'Monthly salary', ar: 'المرتب الشهري' }, type: 'money' },
      { key: 'joiningDate', label: { en: 'Joined', ar: 'تاريخ الانضمام' }, type: 'date' },
    ],
    fields: [
      { key: 'fullName', label: { en: 'Full name', ar: 'الاسم بالكامل' }, type: 'text', required: true, maxLength: 120 },
      { key: 'imageUrl', label: { en: 'Profile image link', ar: 'رابط الصورة الشخصية' }, type: 'url' },
      { key: 'jobTitle', label: { en: 'Job title', ar: 'المسمى الوظيفي' }, type: 'text', required: true },
      { key: 'department', label: { en: 'Department', ar: 'القسم' }, type: 'select', options: DEPARTMENTS, required: true },
      { key: 'specialization', label: { en: 'Specialization', ar: 'التخصص' }, type: 'text' },
      { key: 'email', label: { en: 'Email', ar: 'البريد الإلكتروني' }, type: 'email' },
      { key: 'phone', label: { en: 'Phone', ar: 'الهاتف' }, type: 'tel' },
      { key: 'joiningDate', label: { en: 'Joining date', ar: 'تاريخ الانضمام' }, type: 'date', required: true, default: '$today' },
      { key: 'employmentStatus', label: { en: 'Employment status', ar: 'حالة التوظيف' }, type: 'select', options: EMPLOYMENT_STATUS, required: true, default: 'active' },
      { key: 'monthlySalary', label: { en: 'Monthly salary (EGP)', ar: 'المرتب الشهري (ج.م)' }, type: 'money', min: 0, default: 0, required: true },
      { key: 'notes', label: { en: 'Notes', ar: 'ملاحظات' }, type: 'textarea' },
    ],
    defaults: () => ({ archived: false }),
    deleteGuard: async (row) => {
      const n = (await db.tasks.where('assigneeId').equals(row.id).count()) + (await db.workSessions.where('employeeId').equals(row.id).count()) + (await db.transactions.where('employeeId').equals(row.id).count());
      return n > 0 ? { en: 'This employee has tasks, work sessions or salary records. Archive instead of deleting.', ar: 'لهذا الموظف مهام أو جلسات عمل أو مرتبات مسجلة. قم بالأرشفة بدلًا من الحذف.' } : null;
    },
  };
}

export function workSessionConfig(): EntityConfig {
  return {
    table: 'workSessions',
    title: { en: 'Work sessions', ar: 'جلسات العمل' },
    singular: { en: 'Work session', ar: 'جلسة عمل' },
    icon: 'clock',
    titleOf: (r) => r.date + ' · ' + r.hours + 'h',
    defaultSort: { key: 'date', dir: 'desc' },
    searchKeys: ['notes'],
    columns: [
      { key: 'date', label: { en: 'Date', ar: 'التاريخ' }, type: 'date' },
      { key: 'taskId', label: { en: 'Task', ar: 'المهمة' }, type: 'lookup', lookup: L_TASK },
      { key: 'hours', label: { en: 'Hours', ar: 'الساعات' }, type: 'number' },
      { key: 'notes', label: { en: 'Notes', ar: 'ملاحظات' } },
    ],
    fields: [
      { key: 'employeeId', label: { en: 'Employee', ar: 'الموظف' }, type: 'select', lookup: L_EMPLOYEE, required: true },
      { key: 'taskId', label: { en: 'Task', ar: 'المهمة' }, type: 'select', lookup: { table: 'tasks', label: 'title', filter: () => true } },
      { key: 'date', label: { en: 'Date', ar: 'التاريخ' }, type: 'date', required: true, default: '$today' },
      { key: 'hours', label: { en: 'Hours', ar: 'الساعات' }, type: 'number', required: true, min: 0.1, max: 24 },
      { key: 'notes', label: { en: 'Notes', ar: 'ملاحظات' }, type: 'textarea' },
    ],
  };
}
