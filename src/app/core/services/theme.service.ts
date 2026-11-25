import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const KEY = 'benzed-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly theme = signal<Theme>(this.read());

  constructor() {
    effect(() => {
      const t = this.theme();
      this.document.documentElement.classList.toggle('dark', t === 'dark');
    });
  }

  private read(): Theme {
    try {
      return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; // الافتراضي Light
    } catch {
      return 'light';
    }
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }
}
