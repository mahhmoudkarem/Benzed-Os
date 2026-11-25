import { EntityConfig } from '../../shared/entity/entity.types';
import { PLATFORMS } from '../../core/constants/options';
import { L_CLIENT } from '../../core/constants/lookups';

export function socialConfig(): EntityConfig {
  return {
    table: 'socialAccounts',
    title: { en: 'Social accounts', ar: 'حسابات السوشيال' },
    singular: { en: 'Account', ar: 'حساب' },
    icon: 'globe',
    titleOf: (r) => r.accountName,
    defaultSort: { key: 'accountName', dir: 'asc' },
    searchKeys: ['accountName', 'url', 'notes'],
    filters: [
      { key: 'platform', label: { en: 'Platform', ar: 'المنصة' }, options: PLATFORMS },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, lookup: L_CLIENT },
    ],
    columns: [
      { key: 'accountName', label: { en: 'Account', ar: 'الحساب' } },
      { key: 'platform', label: { en: 'Platform', ar: 'المنصة' }, type: 'badge', options: PLATFORMS },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'lookup', lookup: L_CLIENT },
      { key: 'url', label: { en: 'Link', ar: 'الرابط' }, type: 'custom', render: (r) => r.url || '—' },
      { key: 'notes', label: { en: 'Notes', ar: 'ملاحظات' } },
    ],
    fields: [
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'select', lookup: L_CLIENT, required: true },
      { key: 'platform', label: { en: 'Platform', ar: 'المنصة' }, type: 'select', options: PLATFORMS, required: true },
      { key: 'accountName', label: { en: 'Account name', ar: 'اسم الحساب' }, type: 'text', required: true, maxLength: 120 },
      { key: 'url', label: { en: 'Link', ar: 'الرابط' }, type: 'url', required: true },
      { key: 'notes', label: { en: 'Notes', ar: 'ملاحظات' }, type: 'textarea' },
    ],
  };
}
