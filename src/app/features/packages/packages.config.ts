import { EntityConfig, FieldDef } from '../../shared/entity/entity.types';
import { SERVICE_TYPES } from '../../core/constants/options';
import { L_CLIENT, L_PACKAGE } from '../../core/constants/lookups';
import { ServiceLine } from '../../core/models/business';

const qtyKey = (t: string) => 'qty_' + t;

export function packageConfig(): EntityConfig {
  const qtyFields: FieldDef[] = SERVICE_TYPES.map((s) => ({
    key: qtyKey(s.value),
    label: { en: s.label.en + ' / month', ar: s.label.ar + ' / شهر' },
    type: 'number' as const,
    min: 0,
    default: 0,
  }));
  return {
    table: 'packages',
    title: { en: 'Package plans', ar: 'خطط الباقات' },
    singular: { en: 'Package', ar: 'باقة' },
    icon: 'package',
    titleOf: (r) => r.name,
    defaultSort: { key: 'name', dir: 'asc' },
    searchKeys: ['name', 'description'],
    columns: [
      { key: 'name', label: { en: 'Package', ar: 'الباقة' } },
      { key: 'price', label: { en: 'Monthly price', ar: 'السعر الشهري' }, type: 'money' },
      {
        key: 'services',
        label: { en: 'Included monthly services', ar: 'الخدمات الشهرية المشمولة' },
        type: 'custom',
        noSort: true,
        render: (r, ctx) =>
          ((r.services || []) as ServiceLine[])
            .filter((s) => s.quantity > 0)
            .map((s) => {
              const o = SERVICE_TYPES.find((x) => x.value === s.type);
              return s.quantity + ' ' + (o ? o.label[ctx.lang] : s.type);
            })
            .join(' · ') || '—',
      },
      { key: 'active', label: { en: 'Active', ar: 'نشطة' }, type: 'bool' },
    ],
    fields: [
      { key: 'name', label: { en: 'Package name', ar: 'اسم الباقة' }, type: 'text', required: true, maxLength: 100 },
      { key: 'price', label: { en: 'Monthly price (EGP)', ar: 'السعر الشهري (ج.م)' }, type: 'money', min: 0, default: 0, required: true },
      ...qtyFields,
      { key: 'description', label: { en: 'Description', ar: 'الوصف' }, type: 'textarea' },
      { key: 'active', label: { en: 'Active package', ar: 'باقة نشطة' }, type: 'checkbox', default: true },
    ],
    toForm: (r) => {
      const m: Record<string, any> = { ...r };
      for (const s of (r.services || []) as ServiceLine[]) m[qtyKey(s.type)] = s.quantity;
      return m;
    },
    beforeSave: (value) => {
      const out: Record<string, any> = { ...value };
      const services: ServiceLine[] = [];
      for (const st of SERVICE_TYPES) {
        const q = Number(out[qtyKey(st.value)]) || 0;
        delete out[qtyKey(st.value)];
        if (q > 0) services.push({ type: st.value, quantity: q });
      }
      if (!services.length) throw new Error('Add at least one service quantity to the package.');
      out['services'] = services;
      return out;
    },
  };
}

export function clientPackageConfig(): EntityConfig {
  return {
    table: 'clientPackages',
    title: { en: 'Package assignments', ar: 'تعيين الباقات' },
    singular: { en: 'Assignment', ar: 'تعيين باقة' },
    icon: 'package',
    titleOf: (r) => r.id.slice(0, 8),
    defaultSort: { key: 'startDate', dir: 'desc' },
    searchKeys: [],
    columns: [
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'lookup', lookup: L_CLIENT },
      { key: 'packageId', label: { en: 'Package', ar: 'الباقة' }, type: 'lookup', lookup: L_PACKAGE },
      { key: 'startDate', label: { en: 'Start', ar: 'البداية' }, type: 'date' },
      { key: 'endDate', label: { en: 'End', ar: 'النهاية' }, type: 'date' },
      { key: 'customPrice', label: { en: 'Custom price', ar: 'سعر مخصص' }, type: 'money' },
      {
        key: 'status',
        label: { en: 'Status', ar: 'الحالة' },
        type: 'badge',
        options: [
          { value: 'active', label: { en: 'Active', ar: 'نشطة' }, color: 'green' },
          { value: 'ended', label: { en: 'Ended', ar: 'منتهية' }, color: 'gray' },
        ],
      },
    ],
    filters: [{ key: 'clientId', label: { en: 'Client', ar: 'العميل' }, lookup: L_CLIENT }],
    fields: [
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'select', lookup: L_CLIENT, required: true },
      { key: 'packageId', label: { en: 'Package', ar: 'الباقة' }, type: 'select', lookup: { table: 'packages', label: 'name', filter: (r) => r.active }, required: true },
      { key: 'startDate', label: { en: 'Start date', ar: 'تاريخ البدء' }, type: 'date', required: true, default: '$today' },
      { key: 'endDate', label: { en: 'End date (optional)', ar: 'تاريخ الانتهاء (اختياري)' }, type: 'date' },
      { key: 'customPrice', label: { en: 'Custom monthly price (optional)', ar: 'سعر شهري مخصص (اختياري)' }, type: 'money', min: 0 },
      {
        key: 'status',
        label: { en: 'Status', ar: 'الحالة' },
        type: 'select',
        required: true,
        default: 'active',
        options: [
          { value: 'active', label: { en: 'Active', ar: 'نشطة' } },
          { value: 'ended', label: { en: 'Ended', ar: 'منتهية' } },
        ],
      },
    ],
    validate: (v) => (v['endDate'] && v['startDate'] && v['endDate'] < v['startDate'] ? { endDate: { en: 'End date cannot be before the start date', ar: 'تاريخ الانتهاء لا يسبق البداية' } } : null),
    beforeSave: (v) => {
      const out = { ...v };
      if (!out['customPrice']) out['customPrice'] = undefined;
      return out;
    },
  };
}

export { qtyKey };
