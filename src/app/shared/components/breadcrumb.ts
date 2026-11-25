import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LanguageService, LocalizedText } from '../../core/services/LanguageService/language-service';
import { Icon } from './icon';

interface Crumb {
  label: LocalizedText;
  url: string;
}

@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink, Icon],
  template: `
    <nav class="flex items-center gap-1.5 text-[12.5px] text-muted" aria-label="breadcrumb">
      <a routerLink="/dashboard" class="text-muted no-underline hover:text-fg">{{ lang.t('Home', 'الرئيسية') }}</a>
      @for (c of crumbs(); track c.url; let last = $last) {
        <span class="rtl-flip opacity-60"><app-icon name="chevron" [size]="13" /></span>
        @if (last) {
          <span class="text-fg font-medium">{{ lang.l(c.label) }}</span>
        } @else {
          <a [routerLink]="c.url" class="text-muted no-underline hover:text-fg">{{ lang.l(c.label) }}</a>
        }
      }
    </nav>
  `,
})
export class Breadcrumb {
  protected readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  protected readonly crumbs = signal<Crumb[]>([]);

  constructor() {
    this.build();
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.build();
    });
  }

  private build(): void {
    const out: Crumb[] = [];
    let node = this.router.routerState.snapshot.root;
    let url = '';
    while (node) {
      const seg = node.url.map((u) => u.path).join('/');
      if (seg) url += '/' + seg;
      const c = node.data?.['crumb'];
      if (c) out.push({ label: c, url });
      node = node.firstChild as any;
    }
    // نخلي "تفاصيل" مسبوقة بالقسم الأب (clients/:id -> Clients > Details)
    const last = out[out.length - 1];
    if (last && /\/[^/]+\/[^/]+$/.test(last.url) && !last.url.startsWith('/accounting')) {
      const parentUrl = last.url.replace(/\/[^/]+$/, '');
      const names: Record<string, LocalizedText> = {
        '/clients': { en: 'Clients', ar: 'العملاء' },
        '/team': { en: 'Team', ar: 'الفريق' },
        '/projects': { en: 'Projects', ar: 'المشاريع' },
        '/tasks': { en: 'Tasks', ar: 'المهام' },
      };
      if (names[parentUrl]) out.splice(out.length - 1, 0, { label: names[parentUrl], url: parentUrl });
    }
    this.crumbs.set(out);
  }
}
