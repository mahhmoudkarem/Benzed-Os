import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DbService } from '../../core/services/db.service';
import { ActivityRecord } from '../../core/models/business';
import { PageHeader } from '../../shared/components/page-header';
import { EmptyState, Loading } from '../../shared/components/state-views';

@Component({
  selector: 'app-activity-page',
  imports: [PageHeader, EmptyState, Loading],
  template: `
    <app-page-header [title]="lang.t('Activity history', 'سجل النشاط')" [subtitle]="lang.t('Local record of important operations on this device.', 'سجل محلي للعمليات المهمة على هذا الجهاز.')" />
    <div class="card">
      <div class="p-3 border-b border-line"><input class="input" style="max-width: 320px" [placeholder]="lang.t('Search…', 'بحث…')" [value]="search()" (input)="search.set($any($event.target).value); limit.set(50)" /></div>
      @if (loading()) { <app-loading /> }
      @else if (!view().length) { <app-empty-state icon="clock" [title]="lang.t('No activity', 'لا يوجد نشاط')" /> }
      @else {
        @for (a of view(); track a.id) {
          <div class="flex items-center justify-between gap-3 p-3 border-b border-line last:border-0 text-[13px]">
            <span>{{ lang.isArabic() ? a.messageAr : a.messageEn }}</span>
            <span class="text-muted text-[12px] whitespace-nowrap">{{ lang.dateTime(a.at) }}</span>
          </div>
        }
        @if (hasMore()) {
          <div class="p-3 text-center"><button class="btn" type="button" (click)="limit.set(limit() + 50)">{{ lang.t('Load more', 'عرض المزيد') }}</button></div>
        }
      }
    </div>
  `,
})
export class ActivityPage implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly db = inject(DbService).db;
  protected readonly loading = signal(true);
  private readonly all = signal<ActivityRecord[]>([]);
  protected readonly search = signal('');
  protected readonly limit = signal(50);
  private readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.all().filter((a) => !q || (a.messageEn + ' ' + a.messageAr).toLowerCase().includes(q));
  });
  protected readonly view = computed(() => this.filtered().slice(0, this.limit()));
  protected readonly hasMore = computed(() => this.filtered().length > this.limit());

  ngOnInit(): void {
    void this.db.activities.orderBy('at').reverse().toArray().then((l) => {
      this.all.set(l);
      this.loading.set(false);
    });
  }
}
