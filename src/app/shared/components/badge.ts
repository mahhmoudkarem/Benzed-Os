import { Component, input } from '@angular/core';

@Component({
  selector: 'app-badge',
  template: `<span class="badge" [class]="'badge badge-' + color()"><ng-content /></span>`,
})
export class Badge {
  readonly color = input<string>('gray');
}
