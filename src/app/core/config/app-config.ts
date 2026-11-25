/** إعدادات التطبيق الثابتة (موافق عليها في المتطلبات) */
export const APP_CONFIG = {
  name: 'BENZED OS',
  company: 'BENZED X Marketing',
  currency: 'EGP',
  timezone: 'Africa/Cairo',
  dbName: 'benzed-os',
  /** لازم يتطابق مع رقم النسخة في db/benzed-db.ts */
  dbVersion: 1,
  appVersion: '1.0.0',
} as const;
