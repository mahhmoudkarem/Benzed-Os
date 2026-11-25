import { Component, inject, signal } from '@angular/core';
import { EntityPage } from '../../shared/entity/entity-page';
import { PageHeader } from '../../shared/components/page-header';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { clientPackageConfig, packageConfig } from './packages.config';
import { PackageTracking } from './package-tracking';

@Component({
  selector: 'app-packages-page',
  imports: [EntityPage, PageHeader, PackageTracking],
  template: `
    <app-page-header [title]="lang.t('Monthly packages', 'الباقات الشهرية')" [subtitle]="lang.t('Define packages, assign them to clients and track monthly delivery.', 'عرّف الباقات وعيّنها للعملاء وتابع التسليم الشهري.')" />
    <div class="tabs mb-3">
      <button class="tab" [class.active]="tab() === 'tracking'" type="button" (click)="tab.set('tracking')">{{ lang.t('Monthly tracking', 'المتابعة الشهرية') }}</button>
      <button class="tab" [class.active]="tab() === 'assign'" type="button" (click)="tab.set('assign')">{{ lang.t('Assignments', 'التعيينات') }}</button>
      <button class="tab" [class.active]="tab() === 'plans'" type="button" (click)="tab.set('plans')">{{ lang.t('Package plans', 'خطط الباقات') }}</button>
    </div>
    @switch (tab()) {
      @case ('plans') {
        <app-entity-page [config]="plans" [embedded]="true" />
      }
      @case ('assign') {
        <app-entity-page [config]="assigns" [embedded]="true" />
      }
      @default {
        <app-package-tracking />
      }
    }
  `,
})
export class PackagesPage {
  protected readonly lang = inject(LanguageService);
  protected readonly plans = packageConfig();
  protected readonly assigns = clientPackageConfig();
  protected readonly tab = signal<'tracking' | 'assign' | 'plans'>('tracking');
}
