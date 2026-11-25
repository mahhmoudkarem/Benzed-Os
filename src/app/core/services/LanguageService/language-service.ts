import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { LocalizedText } from '../../models/common';
import { fmt } from '../../utils/format';

export type Lang = 'en' | 'ar';
export type { LocalizedText };

const STORAGE_KEY = 'benzed-lang';

const TITLES: Record<Lang, string> = {
  en: 'BENZED OS | BENZED X Marketing',
  ar: 'بنزد أو إس | بنزد إكس للتسويق',
};

/**
 * مصدر واحد للغة في كل التطبيق (نفس واجهة المشروع الأصلي: t / l / isArabic / dir)
 * + دوال تنسيق الأرقام والتواريخ والعملة حسب اللغة.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);

  private readonly _lang = signal<Lang>(this.readSaved());

  readonly lang = this._lang.asReadonly();
  readonly isArabic = computed(() => this._lang() === 'ar');
  readonly dir = computed(() => (this._lang() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    effect(() => {
      const lang = this._lang();
      const root = this.document.documentElement;
      root.lang = lang;
      root.dir = lang === 'ar' ? 'rtl' : 'ltr';
      this.title.setTitle(TITLES[lang]);
    });
  }

  private readSaved(): Lang {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') return saved;
    } catch {
      /* التخزين غير متاح */
    }
    return 'en';
  }

  /** اختصار للترجمة داخل التمبلت: lang.t('Hello', 'مرحبا') */
  t(en: string, ar: string): string {
    return this._lang() === 'ar' ? ar : en;
  }

  l(text: LocalizedText | undefined): string {
    return text ? text[this._lang()] : '';
  }

  set(lang: Lang): void {
    this._lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }

  toggle(): void {
    this.set(this._lang() === 'ar' ? 'en' : 'ar');
  }

  // ---- تنسيق ----
  money(n: number): string {
    return fmt.money(n, this._lang());
  }
  num(n: number, digits = 0): string {
    return fmt.num(n, this._lang(), digits);
  }
  pct(n: number, digits = 1): string {
    return fmt.pct(n, this._lang(), digits);
  }
  date(s: string | undefined): string {
    return fmt.date(s, this._lang());
  }
  month(s: string): string {
    return fmt.month(s, this._lang());
  }
  dateTime(s: string | undefined): string {
    return fmt.dateTime(s, this._lang());
  }
}
