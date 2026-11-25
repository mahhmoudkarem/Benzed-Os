import { Component, inject } from '@angular/core';
import { EntityPage } from '../../shared/entity/entity-page';
import { PageHeader } from '../../shared/components/page-header';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { socialConfig } from './social.config';

@Component({
  selector: 'app-social-page',
  imports: [EntityPage, PageHeader],
  template: `
    <app-page-header [title]="lang.t('Social media accounts', 'حسابات السوشيال ميديا')" [subtitle]="lang.t('Reference list of client accounts. There is no automatic publishing or platform integration.', 'قائمة مرجعية لحسابات العملاء. لا يوجد نشر تلقائي أو ربط مع المنصات.')" />
    <app-entity-page [config]="config" [embedded]="true" />
  `,
})
export class SocialPage {
  protected readonly lang = inject(LanguageService);
  protected readonly config = socialConfig();
}
