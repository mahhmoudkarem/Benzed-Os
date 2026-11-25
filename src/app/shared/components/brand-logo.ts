import { Component, computed, inject, input } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

/**
 * لوجو BENZED — بيتبدل تلقائيًا حسب الثيم:
 * Light → الأيقونة التيل | Dark → الأيقونة الصفرا
 */
@Component({
  selector: 'app-brand-logo',
  template: `<img [src]="src()" [width]="size()" [height]="size()" alt="BENZED" class="block flex-shrink-0 select-none" draggable="false" />`,
})
export class BrandLogo {
  private readonly theme = inject(ThemeService);
  readonly size = input(40);
  protected readonly src = computed(() =>
    this.theme.theme() === 'dark' ? 'brand/benzed-icon-yellow.png' : 'brand/benzed-icon-teal.png',
  );
}
