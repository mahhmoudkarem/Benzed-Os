import { Component, ElementRef, OnDestroy, effect, inject, input, viewChild } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { LanguageService } from '../../core/services/LanguageService/language-service';

/** غلاف خفيف حول Chart.js (بيتحمّل ديناميكيًا عند الحاجة) */
@Component({
  selector: 'app-chart',
  template: `<div [style.height.px]="height()" style="position: relative"><canvas #cv></canvas></div>`,
})
export class ChartView implements OnDestroy {
  readonly type = input.required<'bar' | 'line' | 'doughnut'>();
  readonly labels = input.required<string[]>();
  readonly datasets = input.required<{ label: string; data: number[]; color?: string; colors?: string[] }[]>();
  readonly height = input(260);
  readonly stacked = input(false);

  private readonly cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private readonly theme = inject(ThemeService);
  private readonly lang = inject(LanguageService);
  private chart: any = null;
  private seq = 0;

  constructor() {
    effect(() => {
      // أي تغيير في المدخلات أو الثيم أو اللغة يعيد الرسم
      const type = this.type();
      const labels = this.labels();
      const sets = this.datasets();
      const dark = this.theme.theme() === 'dark';
      const rtl = this.lang.isArabic();
      const stacked = this.stacked();
      void this.render(type, labels, sets, dark, rtl, stacked);
    });
  }

  private async render(type: string, labels: string[], sets: { label: string; data: number[]; color?: string; colors?: string[] }[], dark: boolean, rtl: boolean, stacked: boolean): Promise<void> {
    const my = ++this.seq;
    const mod: any = await import('chart.js/auto');
    if (my !== this.seq) return;
    const Chart = mod.Chart ?? mod.default;
    const text = dark ? '#98a2c3' : '#667085';
    const grid = dark ? '#2a3150' : '#e4e7f0';
    this.chart?.destroy();
    const palette = ['#14919e', '#16a34a', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#14b8a6', '#64748b'];
    const isDonut = type === 'doughnut';
    this.chart = new Chart(this.cv().nativeElement, {
      type,
      data: {
        labels,
        datasets: sets.map((d, i) => ({
          label: d.label,
          data: d.data,
          backgroundColor: isDonut ? d.colors || palette : d.color || palette[i % palette.length],
          borderColor: isDonut ? (dark ? '#151a2e' : '#ffffff') : d.color || palette[i % palette.length],
          borderWidth: isDonut ? 2 : 2,
          tension: 0.3,
          borderRadius: type === 'bar' ? 5 : 0,
          fill: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        plugins: { legend: { rtl, labels: { color: text, boxWidth: 12, font: { family: 'inherit' } } } },
        scales: isDonut
          ? {}
          : {
              x: { stacked, ticks: { color: text }, grid: { color: grid }, reverse: rtl },
              y: { stacked, ticks: { color: text }, grid: { color: grid }, position: rtl ? 'right' : 'left' },
            },
      },
    });
  }

  ngOnDestroy(): void {
    this.seq++;
    this.chart?.destroy();
  }
}
