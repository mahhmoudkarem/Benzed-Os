import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './core/services/LanguageService/language-service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // نحقن الخدمتين هنا عشان يطبّقوا اللغة والثيم فورًا
  protected readonly lang = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
}
