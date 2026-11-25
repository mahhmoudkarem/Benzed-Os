import { Component, inject, output, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DateRange, RangePreset, cairoDate, rangeFor } from '../../core/utils/date';

@Component({
  selector: 'app-date-range-filter',
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <select class="select" style="width: auto" [value]="preset()" (change)="setPreset($any($event.target).value)">
        <option value="today">{{ lang.t('Today', 'اليوم') }}</option>
        <option value="week">{{ lang.t('This week', 'هذا الأسبوع') }}</option>
        <option value="month">{{ lang.t('This month', 'هذا الشهر') }}</option>
        <option value="year">{{ lang.t('This year', 'هذه السنة') }}</option>
        <option value="custom">{{ lang.t('Custom range', 'نطاق مخصص') }}</option>
      </select>
      @if (preset() === 'custom') {
        <input class="input" style="width: auto" type="date" [value]="from()" (change)="from.set($any($event.target).value); emitCustom()" />
        <span class="text-muted">→</span>
        <input class="input" style="width: auto" type="date" [value]="to()" (change)="to.set($any($event.target).value); emitCustom()" />
      }
    </div>
  `,
})
export class DateRangeFilter {
  protected readonly lang = inject(LanguageService);
  readonly changed = output<DateRange>();
  protected readonly preset = signal<RangePreset>('month');
  protected readonly from = signal(cairoDate());
  protected readonly to = signal(cairoDate());

  protected setPreset(p: RangePreset): void {
    this.preset.set(p);
    if (p === 'custom') {
      this.emitCustom();
      return;
    }
    this.changed.emit(rangeFor(p, cairoDate()));
  }

  protected emitCustom(): void {
    if (this.from() && this.to() && this.from() <= this.to()) this.changed.emit(rangeFor('custom', cairoDate(), { from: this.from(), to: this.to() }));
  }
}
