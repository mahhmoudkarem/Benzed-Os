import { Component, inject } from '@angular/core';
import { EntityPage } from '../../shared/entity/entity-page';
import { PageHeader } from '../../shared/components/page-header';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { clientConfig } from './clients.config';

@Component({
  selector: 'app-clients-page',
  imports: [EntityPage, PageHeader],
  template: `
    <app-page-header [title]="lang.t('Clients', 'العملاء')" [subtitle]="lang.t('Manage client accounts and their brands.', 'إدارة حسابات العملاء وعلاماتهم التجارية.')" />
    <app-entity-page [config]="config" [embedded]="true" />
  `,
})
export class ClientsPage {
  protected readonly lang = inject(LanguageService);
  protected readonly config = clientConfig();
}
