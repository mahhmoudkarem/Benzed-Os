import { EntityConfig } from '../../shared/entity/entity.types';
import { CLIENT_STATUS } from '../../core/constants/options';
import { L_EMPLOYEE } from '../../core/constants/lookups';
import { DbService } from '../../core/services/db.service';
import { inject } from '@angular/core';

export function clientConfig(): EntityConfig {
  const db = inject(DbService).db;
  return {
    table: 'clients',
    title: { en: 'Clients', ar: 'العملاء' },
    singular: { en: 'Client', ar: 'عميل' },
    icon: 'users',
    archive: true,
    titleOf: (r) => r.name,
    detailRoute: (r) => ['/clients', r.id],
    defaultSort: { key: 'name', dir: 'asc' },
    searchKeys: ['name', 'companyName', 'brandName', 'email', 'phone', 'city'],
    filters: [
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, options: CLIENT_STATUS },
      { key: 'accountManagerId', label: { en: 'Account manager', ar: 'مدير الحساب' }, lookup: L_EMPLOYEE },
    ],
    columns: [
      { key: 'name', label: { en: 'Client', ar: 'العميل' }, link: true },
      { key: 'companyName', label: { en: 'Company', ar: 'الشركة' } },
      { key: 'brandName', label: { en: 'Brand', ar: 'العلامة' } },
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, type: 'badge', options: CLIENT_STATUS },
      { key: 'accountManagerId', label: { en: 'Account manager', ar: 'مدير الحساب' }, type: 'lookup', lookup: L_EMPLOYEE },
      { key: 'phone', label: { en: 'Phone', ar: 'الهاتف' } },
      { key: 'startDate', label: { en: 'Start date', ar: 'تاريخ البدء' }, type: 'date' },
    ],
    fields: [
      { key: 'name', label: { en: 'Client name', ar: 'اسم العميل' }, type: 'text', required: true, maxLength: 120 },
      { key: 'companyName', label: { en: 'Company name', ar: 'اسم الشركة' }, type: 'text', maxLength: 120 },
      { key: 'brandName', label: { en: 'Brand name', ar: 'اسم العلامة التجارية' }, type: 'text', maxLength: 120 },
      { key: 'businessType', label: { en: 'Business type', ar: 'نوع النشاط' }, type: 'text', maxLength: 80 },
      { key: 'email', label: { en: 'Email', ar: 'البريد الإلكتروني' }, type: 'email' },
      { key: 'phone', label: { en: 'Phone', ar: 'الهاتف' }, type: 'tel' },
      { key: 'whatsapp', label: { en: 'WhatsApp', ar: 'واتساب' }, type: 'tel' },
      { key: 'country', label: { en: 'Country', ar: 'الدولة' }, type: 'text', default: 'Egypt' },
      { key: 'city', label: { en: 'City', ar: 'المدينة' }, type: 'text' },
      { key: 'startDate', label: { en: 'Start date', ar: 'تاريخ البدء' }, type: 'date', default: '$today', required: true },
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, type: 'select', options: CLIENT_STATUS, required: true, default: 'active' },
      { key: 'accountManagerId', label: { en: 'Account manager', ar: 'مدير الحساب' }, type: 'select', lookup: L_EMPLOYEE },
      { key: 'address', label: { en: 'Address', ar: 'العنوان' }, type: 'text', colSpan: 2 },
      { key: 'brandVoice', label: { en: 'Brand voice / tone', ar: 'نبرة العلامة' }, type: 'text', colSpan: 2 },
      { key: 'targetAudience', label: { en: 'Target audience', ar: 'الجمهور المستهدف' }, type: 'text', colSpan: 2 },
      { key: 'brandColors', label: { en: 'Brand colors', ar: 'ألوان العلامة' }, type: 'text' },
      { key: 'brandNotes', label: { en: 'Brand notes', ar: 'ملاحظات العلامة' }, type: 'textarea' },
      { key: 'notes', label: { en: 'Notes', ar: 'ملاحظات' }, type: 'textarea' },
    ],
    defaults: () => ({ archived: false }),
    deleteGuard: async (row) => {
      const checks = await Promise.all([
        db.projects.where('clientId').equals(row.id).count(),
        db.tasks.where('clientId').equals(row.id).count(),
        db.invoices.where('clientId').equals(row.id).count(),
        db.payments.where('clientId').equals(row.id).count(),
        db.contentItems.where('clientId').equals(row.id).count(),
        db.campaigns.where('clientId').equals(row.id).count(),
        db.socialAccounts.where('clientId').equals(row.id).count(),
        db.clientPackages.where('clientId').equals(row.id).count(),
      ]);
      return checks.some((n) => n > 0)
        ? { en: 'This client has related records (projects, tasks, invoices…). Archive it instead of deleting.', ar: 'لهذا العميل سجلات مرتبطة (مشاريع، مهام، فواتير…). قم بأرشفته بدلًا من الحذف.' }
        : null;
    },
  };
}
