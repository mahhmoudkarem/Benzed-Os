import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DbService } from '../../core/services/db.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppNotification } from '../../core/models/business';
import { PageHeader } from '../../shared/components/page-header';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Loading } from '../../shared/components/state-views';

@Component({
  selector: 'app-notifications-page',
  imports: [PageHeader, Badge, Icon, EmptyState, Loading],
  template: `
    <app-page-header [title]="lang.t('Notifications', 'الإشعارات')" [subtitle]="lang.t('Local alerts generated from your data while the app is open.', 'تنبيهات محلية تُولَّد من بياناتك أثناء فتح التطبيق.')">
      <button class="btn" type="button" (click)="refresh()"><app-icon name="refresh" [size]="15" /> {{ lang.t('Refresh', 'تحديث') }}</button>
      <button class="btn" type="button" (click)="markAll()">{{ lang.t('Mark all read', 'تعليم الكل كمقروء') }}</button>
      <button class="btn" type="button" (click)="clearRead()">{{ lang.t('Clear read', 'حذف المقروء') }}</button>
    </app-page-header>
    <div class="card">
      @if (loading()) { <app-loading /> }
      @else if (!items().length) { <app-empty-state icon="bell" [title]="lang.t('No notifications', 'لا توجد إشعارات')" /> }
      @else {
        @for (n of items(); track n.id) {
          <div class="flex items-start gap-3 p-3 border-b border-line last:border-0" [style.background]="n.read ? '' : 'var(--primary-soft)'" style="cursor: pointer" (click)="open(n)">
            <app-badge [color]="n.severity === 'high' ? 'red' : n.severity === 'medium' ? 'amber' : 'blue'">{{ lang.isArabic() ? n.titleAr : n.titleEn }}</app-badge>
            <div class="flex-1 text-[13px]">{{ lang.isArabic() ? n.bodyAr : n.bodyEn }}</div>
            <div class="text-[12px] text-muted whitespace-nowrap">{{ lang.dateTime(n.at) }}</div>
          </div>
        }
      }
    </div>
  `,
})
export class NotificationsPage implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly db = inject(DbService).db;
  private readonly svc = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  private readonly all = signal<AppNotification[]>([]);
  protected readonly items = computed(() => [...this.all()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200));

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.all.set(await this.db.notifications.toArray());
    this.loading.set(false);
  }
  protected async refresh(): Promise<void> {
    this.loading.set(true);
    await this.svc.generate();
    await this.load();
  }
  protected async markAll(): Promise<void> {
    await this.svc.markAllRead();
    await this.load();
  }
  protected async clearRead(): Promise<void> {
    await this.svc.clearRead();
    await this.load();
  }
  protected async open(n: AppNotification): Promise<void> {
    if (!n.read) await this.svc.markRead(n.id);
    await this.load();
    if (n.link) await this.router.navigateByUrl(n.link);
  }
}
