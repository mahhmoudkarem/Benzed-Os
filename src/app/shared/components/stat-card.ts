import { Component, input } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-stat-card',
  imports: [Icon],
  template: `
    <div class="card card-pad flex items-start gap-3">
      <div class="kpi-icon" [style.background]="bg()" [style.color]="fg()"><app-icon [name]="icon()" /></div>
      <div class="min-w-0">
        <div class="kpi-label">{{ label() }}</div>
        <div class="kpi-value" [style.color]="valueColor()">{{ value() }}</div>
        @if (hint()) {
          <div class="text-[11.5px] text-muted mt-0.5">{{ hint() }}</div>
        }
      </div>
    </div>
  `,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly icon = input('bar');
  readonly hint = input('');
  readonly tone = input<'default' | 'good' | 'bad' | 'warn'>('default');

  protected bg(): string {
    return this.tone() === 'good' ? 'color-mix(in srgb, var(--success) 15%, transparent)' : this.tone() === 'bad' ? 'color-mix(in srgb, var(--danger) 15%, transparent)' : this.tone() === 'warn' ? 'color-mix(in srgb, var(--warning) 18%, transparent)' : 'var(--primary-soft)';
  }
  protected fg(): string {
    return this.tone() === 'good' ? 'var(--success)' : this.tone() === 'bad' ? 'var(--danger)' : this.tone() === 'warn' ? 'var(--warning)' : 'var(--primary)';
  }
  protected valueColor(): string {
    return this.tone() === 'bad' ? 'var(--danger)' : '';
  }
}
