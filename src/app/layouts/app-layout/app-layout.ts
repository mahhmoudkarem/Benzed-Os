import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { BackgroundService } from '../../core/services/background.service';
import { SettingsService } from '../../core/services/settings.service';
import { Icon } from '../../shared/components/icon';
import { Breadcrumb } from '../../shared/components/breadcrumb';
import { ToastHost } from '../../shared/components/toast-host';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { BrandLogo } from '../../shared/components/brand-logo';

interface NavItem {
  path: string;
  icon: string;
  en: string;
  ar: string;
  exact?: boolean;
}
interface NavGroup {
  en: string;
  ar: string;
  items: NavItem[];
}

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Breadcrumb, ToastHost, ConfirmDialog, BrandLogo],
  template: `
    <div class="flex h-screen overflow-hidden">
      @if (menuOpen()) {
        <div class="fixed inset-0 z-40 lg:hidden" style="background: rgba(10,13,30,.5)" (click)="menuOpen.set(false)"></div>
      }
      <aside
        class="fixed lg:static lg:translate-x-0 z-50 top-0 bottom-0 start-0 w-64 flex-shrink-0 flex flex-col bg-surface border-e border-line transition-transform duration-200"
        [class.-translate-x-full]="!menuOpen() && !lang.isArabic()"
        [class.translate-x-full]="!menuOpen() && lang.isArabic()"
      >
        <div class="flex items-center gap-2.5 px-4 h-16 border-b border-line">
          <app-brand-logo [size]="38" />
          <div class="leading-tight">
            <div class="font-bold text-[15px]">BENZED OS</div>
            <div class="text-[11px] text-muted">{{ settings.setup().companyName || 'BENZED X Marketing' }}</div>
          </div>
        </div>
        <nav class="flex-1 overflow-y-auto p-3">
          @for (g of groups; track g.en) {
            <div class="nav-group">{{ lang.t(g.en, g.ar) }}</div>
            @for (i of g.items; track i.path) {
              <a class="nav-link" [routerLink]="i.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!i.exact }">
                <app-icon [name]="i.icon" [size]="17" />
                <span class="flex-1">{{ lang.t(i.en, i.ar) }}</span>
                @if (i.path === '/notifications' && notify.unread() > 0) {
                  <span class="badge badge-red">{{ notify.unread() }}</span>
                }
              </a>
            }
          }
        </nav>
        <div class="p-3 border-t border-line text-[11px] text-muted">
          {{ lang.t('Local data · single device', 'بيانات محلية · جهاز واحد') }}
        </div>
      </aside>

      <div class="flex-1 flex flex-col min-w-0">
        <header class="h-16 flex items-center gap-3 px-4 bg-surface border-b border-line flex-shrink-0">
          <button class="icon-btn lg:hidden" type="button" (click)="menuOpen.set(true)" aria-label="Menu"><app-icon name="menu" /></button>
          <app-breadcrumb />
          <div class="flex-1"></div>
          <button class="btn btn-sm" type="button" (click)="lang.toggle()" [title]="lang.t('Switch language', 'تغيير اللغة')">
            <app-icon name="globe" [size]="15" /> {{ lang.isArabic() ? 'English' : 'العربية' }}
          </button>
          <button class="icon-btn" type="button" (click)="theme.toggle()" [title]="lang.t('Toggle theme', 'تغيير المظهر')">
            <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" />
          </button>
          <a class="icon-btn" routerLink="/notifications" [title]="lang.t('Notifications', 'الإشعارات')">
            <app-icon name="bell" />
            @if (notify.unread() > 0) {
              <span class="absolute -top-0.5 -end-0.5 badge badge-red" style="padding: 0 5px; font-size: 10px">{{ notify.unread() }}</span>
            }
          </a>
        </header>
        <main class="flex-1 overflow-y-auto p-4 md:p-6">
          <router-outlet />
        </main>
      </div>
    </div>
    <app-toast-host />
    <app-confirm-dialog />
  `,
})
export class AppLayout implements OnInit {
  protected readonly lang = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  protected readonly notify = inject(NotificationService);
  protected readonly settings = inject(SettingsService);
  private readonly background = inject(BackgroundService);
  private readonly router = inject(Router);
  protected readonly menuOpen = signal(false);

  protected readonly groups: NavGroup[] = [
    { en: 'Overview', ar: 'نظرة عامة', items: [{ path: '/dashboard', icon: 'home', en: 'Dashboard', ar: 'لوحة التحكم' }] },
    {
      en: 'Operations',
      ar: 'التشغيل',
      items: [
        { path: '/clients', icon: 'users', en: 'Clients', ar: 'العملاء' },
        { path: '/team', icon: 'user', en: 'Team', ar: 'الفريق' },
        { path: '/projects', icon: 'briefcase', en: 'Projects', ar: 'المشاريع' },
        { path: '/tasks', icon: 'tasks', en: 'Tasks', ar: 'المهام' },
      ],
    },
    {
      en: 'Marketing',
      ar: 'التسويق',
      items: [
        { path: '/packages', icon: 'package', en: 'Monthly Packages', ar: 'الباقات الشهرية' },
        { path: '/content', icon: 'calendar', en: 'Content Calendar', ar: 'تقويم المحتوى' },
        { path: '/social', icon: 'globe', en: 'Social Accounts', ar: 'حسابات السوشيال' },
        { path: '/campaigns', icon: 'target', en: 'Campaigns', ar: 'الحملات' },
      ],
    },
    {
      en: 'Finance',
      ar: 'المالية',
      items: [
        { path: '/accounting', icon: 'dollar', en: 'Accounting', ar: 'المحاسبة', exact: true },
        { path: '/accounting/invoices', icon: 'file', en: 'Invoices', ar: 'الفواتير' },
        { path: '/accounting/payments', icon: 'wallet', en: 'Payments', ar: 'المدفوعات' },
        { path: '/accounting/transactions', icon: 'trend', en: 'Income & Expenses', ar: 'الإيرادات والمصروفات' },
        { path: '/accounting/capital', icon: 'layers', en: 'Capital', ar: 'رأس المال' },
        { path: '/accounting/assets', icon: 'cpu', en: 'Assets', ar: 'الأصول' },
        { path: '/accounting/journal', icon: 'book', en: 'Journal', ar: 'دفتر اليومية' },
        { path: '/accounting/chart', icon: 'list', en: 'Chart of Accounts', ar: 'دليل الحسابات' },
        { path: '/accounting/reports', icon: 'bar', en: 'Financial Reports', ar: 'التقارير المالية' },
        { path: '/intelligence', icon: 'spark', en: 'Financial Intelligence', ar: 'الذكاء المالي' },
      ],
    },
    {
      en: 'System',
      ar: 'النظام',
      items: [
        { path: '/reports', icon: 'download', en: 'Daily Reports', ar: 'التقارير اليومية' },
        { path: '/notifications', icon: 'bell', en: 'Notifications', ar: 'الإشعارات' },
        { path: '/activity', icon: 'clock', en: 'Activity History', ar: 'سجل النشاط' },
        { path: '/backup', icon: 'database', en: 'Backup & Restore', ar: 'النسخ الاحتياطي' },
        { path: '/settings', icon: 'sliders', en: 'Settings', ar: 'الإعدادات' },
      ],
    },
  ];

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.menuOpen.set(false);
    });
  }

  ngOnInit(): void {
    void this.notify.refreshCount();
    this.background.start();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth >= 1024) this.menuOpen.set(false);
  }
}
