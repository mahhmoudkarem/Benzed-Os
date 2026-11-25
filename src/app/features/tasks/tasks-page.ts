import { Component, inject, signal } from '@angular/core';
import { EntityPage } from '../../shared/entity/entity-page';
import { PageHeader } from '../../shared/components/page-header';
import { Icon } from '../../shared/components/icon';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { taskConfig } from './tasks.config';
import { TaskKanban } from './task-kanban';

@Component({
  selector: 'app-tasks-page',
  imports: [EntityPage, PageHeader, Icon, TaskKanban],
  template: `
    <app-page-header [title]="lang.t('Tasks', 'المهام')" [subtitle]="lang.t('Drag cards between columns to change status.', 'اسحب البطاقات بين الأعمدة لتغيير الحالة.')">
      <div class="flex gap-1">
        <button class="btn btn-sm" [class.btn-primary]="view() === 'list'" type="button" (click)="view.set('list')"><app-icon name="list" [size]="15" /> {{ lang.t('List', 'قائمة') }}</button>
        <button class="btn btn-sm" [class.btn-primary]="view() === 'kanban'" type="button" (click)="view.set('kanban')"><app-icon name="grid" [size]="15" /> {{ lang.t('Kanban', 'كانبان') }}</button>
      </div>
    </app-page-header>
    @if (view() === 'list') {
      <app-entity-page [config]="config" [embedded]="true" />
    } @else {
      <app-task-kanban />
    }
  `,
})
export class TasksPage {
  protected readonly lang = inject(LanguageService);
  protected readonly config = taskConfig();
  protected readonly view = signal<'list' | 'kanban'>('list');
}
