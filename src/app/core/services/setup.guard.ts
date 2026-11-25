import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SettingsService } from './settings.service';

/** لو الإعداد الأولي (رأس المال) لم يكتمل نحوّل المستخدم لشاشة الإعداد */
export const setupGuard: CanActivateFn = () => {
  const settings = inject(SettingsService);
  return settings.setup().done ? true : inject(Router).createUrlTree(['/setup']);
};

export const setupPageGuard: CanActivateFn = () => {
  const settings = inject(SettingsService);
  return settings.setup().done ? inject(Router).createUrlTree(['/dashboard']) : true;
};
