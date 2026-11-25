import { Component, inject } from '@angular/core';
import { EntityPage } from '../../shared/entity/entity-page';
import { PageHeader } from '../../shared/components/page-header';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { projectConfig } from './projects.config';

@Component({
  selector: 'app-projects-page',
  imports: [EntityPage, PageHeader],
  template: `
    <app-page-header [title]="lang.t('Projects', 'المشاريع')" [subtitle]="lang.t('Track budgets, deadlines, teams and progress.', 'تابع الميزانيات والمواعيد والفرق والتقدم.')" />
    <app-entity-page [config]="config" [embedded]="true" />
  `,
})
export class ProjectsPage {
  protected readonly lang = inject(LanguageService);
  protected readonly config = projectConfig();
}
