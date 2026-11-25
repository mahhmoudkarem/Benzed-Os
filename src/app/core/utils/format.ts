import { APP_CONFIG } from '../config/app-config';

export type Lang = 'en' | 'ar';
const LOCALE: Record<Lang, string> = { en: 'en-US', ar: 'ar-EG' };

/** دوال تنسيق نقية (من غير حقن) عشان نستخدمها في الحسابات والتقارير */
export const fmt = {
  money(n: number, lang: Lang = 'en'): string {
    return new Intl.NumberFormat(LOCALE[lang], {
      style: 'currency',
      currency: APP_CONFIG.currency,
      maximumFractionDigits: 2,
    }).format(n || 0);
  },
  num(n: number, lang: Lang = 'en', digits = 0): string {
    return new Intl.NumberFormat(LOCALE[lang], {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(n || 0);
  },
  pct(n: number, lang: Lang = 'en', digits = 1): string {
    return new Intl.NumberFormat(LOCALE[lang], {
      style: 'percent',
      maximumFractionDigits: digits,
    }).format((n || 0) / 100);
  },
  date(s: string | undefined, lang: Lang = 'en'): string {
    if (!s) return '—';
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return new Intl.DateTimeFormat(LOCALE[lang], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)));
  },
  month(s: string, lang: Lang = 'en'): string {
    const [y, m] = s.split('-').map(Number);
    return new Intl.DateTimeFormat(LOCALE[lang], {
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, 1)));
  },
  monthShort(s: string, lang: Lang = 'en'): string {
    const [y, m] = s.split('-').map(Number);
    return new Intl.DateTimeFormat(LOCALE[lang], {
      year: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, 1)));
  },
  dateTime(iso: string | undefined, lang: Lang = 'en'): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat(LOCALE[lang], {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: APP_CONFIG.timezone,
    }).format(new Date(iso));
  },
};

/** يحوّل الأرقام العربية/الهندية لأرقام لاتينية (لتحليل مدخلات المساعد) */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',');
}
