import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { DbService } from './core/services/db.service';
import { SettingsService } from './core/services/settings.service';
import { SeedService } from './core/services/seed.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    // تهيئة قاعدة البيانات قبل ظهور أي شاشة
    // ملاحظة: لازم كل inject() تتعمل قبل أول await، لأن بعد الـ await بنخرج من الـ injection context
    provideAppInitializer(() => {
      const db = inject(DbService).db;
      const seed = inject(SeedService);
      const settings = inject(SettingsService);
      return (async () => {
        await db.open();
        await seed.ensureAccounts();
        await settings.load();
      })();
    }),
  ],
};
