import { Component, inject } from '@angular/core';
import { EntityPage } from '../../shared/entity/entity-page';
import { PageHeader } from '../../shared/components/page-header';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { employeeConfig } from './team.config';

@Component({
  selector: 'app-team-page',
  imports: [EntityPage, PageHeader],
  template: `
    <app-page-header [title]="lang.t('Team', 'الفريق')" [subtitle]="lang.t('Employees are records only — there are no employee logins.', 'الموظفون سجلات فقط — لا توجد حسابات دخول للموظفين.')" />
    <app-entity-page [config]="config" [embedded]="true" />
  `,
})
export class TeamPage {
  protected readonly lang = inject(LanguageService);
  protected readonly config = employeeConfig();
}
