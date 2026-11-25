import { EntityConfig } from '../../shared/entity/entity.types';
import { CONTENT_STATUS, CONTENT_TYPES, PLATFORMS } from '../../core/constants/options';
import { L_CLIENT, L_EMPLOYEE } from '../../core/constants/lookups';

export function contentConfig(): EntityConfig {
  return {
    table: 'contentItems',
    title: { en: 'Content', ar: 'المحتوى' },
    singular: { en: 'Content item', ar: 'عنصر محتوى' },
    icon: 'calendar',
    titleOf: (r) => r.title,
    defaultSort: { key: 'publishDate', dir: 'asc' },
    searchKeys: ['title', 'caption', 'designBrief', 'creativeDirection', 'notes'],
    filters: [
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, options: CONTENT_STATUS },
      { key: 'platform', label: { en: 'Platform', ar: 'المنصة' }, options: PLATFORMS },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, lookup: L_CLIENT },
    ],
    columns: [
      { key: 'publishDate', label: { en: 'Publish date', ar: 'تاريخ النشر' }, type: 'date' },
      { key: 'title', label: { en: 'Title', ar: 'العنوان' } },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'lookup', lookup: L_CLIENT },
      { key: 'platform', label: { en: 'Platform', ar: 'المنصة' }, type: 'badge', options: PLATFORMS },
      { key: 'contentType', label: { en: 'Type', ar: 'النوع' }, type: 'badge', options: CONTENT_TYPES },
      { key: 'assigneeId', label: { en: 'Assigned to', ar: 'المسؤول' }, type: 'lookup', lookup: L_EMPLOYEE },
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, type: 'badge', options: CONTENT_STATUS },
    ],
    fields: [
      { key: 'title', label: { en: 'Title', ar: 'العنوان' }, type: 'text', required: true, maxLength: 160, colSpan: 2 },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'select', lookup: L_CLIENT, required: true },
      { key: 'platform', label: { en: 'Platform', ar: 'المنصة' }, type: 'select', options: PLATFORMS, required: true },
      { key: 'contentType', label: { en: 'Content type', ar: 'نوع المحتوى' }, type: 'select', options: CONTENT_TYPES, required: true, default: 'post' },
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, type: 'select', options: CONTENT_STATUS, required: true, default: 'idea' },
      { key: 'publishDate', label: { en: 'Publishing date', ar: 'تاريخ النشر' }, type: 'date', required: true, default: '$today' },
      { key: 'assigneeId', label: { en: 'Assigned employee', ar: 'الموظف المسؤول' }, type: 'select', lookup: L_EMPLOYEE },
      { key: 'caption', label: { en: 'Caption', ar: 'الكابشن' }, type: 'textarea' },
      { key: 'designBrief', label: { en: 'Design brief', ar: 'بريف التصميم' }, type: 'textarea' },
      { key: 'creativeDirection', label: { en: 'Creative direction', ar: 'التوجه الإبداعي' }, type: 'textarea' },
      { key: 'notes', label: { en: 'Notes', ar: 'ملاحظات' }, type: 'textarea' },
    ],
  };
}
