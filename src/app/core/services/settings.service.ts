import { Injectable, inject, signal } from '@angular/core';
import { DbService } from './db.service';

export interface SetupInfo {
  done: boolean;
  companyName: string;
  completedAt: string; // YYYY-MM-DD (Cairo)
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly db = inject(DbService).db;
  readonly setup = signal<SetupInfo>({ done: false, companyName: '', completedAt: '' });

  async load(): Promise<void> {
    const s = await this.get<SetupInfo>('setup', { done: false, companyName: '', completedAt: '' });
    this.setup.set(s);
  }

  async get<T>(key: string, fallback: T): Promise<T> {
    const r = await this.db.settings.get(key);
    return r ? (r.value as T) : fallback;
  }

  async set(key: string, value: any): Promise<void> {
    await this.db.settings.put({ key, value });
  }

  async saveSetup(info: SetupInfo): Promise<void> {
    await this.set('setup', info);
    this.setup.set(info);
  }

  /** عدّاد تسلسلي (لأرقام القيود والفواتير). لازم يُستدعى داخل transaction. */
  async nextCounter(name: string): Promise<number> {
    const key = 'counter:' + name;
    const cur = await this.get<number>(key, 0);
    const next = cur + 1;
    await this.set(key, next);
    return next;
  }
}
