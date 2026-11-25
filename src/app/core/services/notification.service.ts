import { Injectable, inject, signal } from '@angular/core';
import { DbService } from './db.service';
import { DataService } from './data.service';
import { SettingsService } from './settings.service';
import { AppNotification } from '../models/business';
import { analyze } from '../intelligence/analyzer';
import { remaining } from '../accounting/metrics';
import { addDays, isoNow } from '../utils/date';
import { fmt } from '../utils/format';
import { fromCents, toCents } from '../utils/money';
import { uid } from '../utils/id';

type Draft = Omit<AppNotification, 'id' | 'createdAt' | 'updatedAt' | 'read' | 'at'>;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly db = inject(DbService).db;
  private readonly data = inject(DataService);
  private readonly settings = inject(SettingsService);

  readonly unread = signal(0);

  async refreshCount(): Promise<void> {
    const all = await this.db.notifications.toArray();
    this.unread.set(all.filter((n) => !n.read).length);
  }

  /** إضافة إشعار لو مش موجود بنفس الـ key (منع التكرار) */
  async add(d: Draft): Promise<void> {
    const exists = await this.db.notifications.where('key').equals(d.key).first();
    if (exists) return;
    const now = isoNow();
    try {
      await this.db.notifications.add({ ...d, id: uid(), read: false, at: now, createdAt: now, updatedAt: now });
    } catch {
      /* مفتاح مكرر من تبويب آخر - تجاهل */
    }
  }

  /** توليد الإشعارات المحلية من البيانات الحالية */
  async generate(): Promise<void> {
    const s = await this.data.snapshot();
    const today = s.today;
    const soon = addDays(today, 2);
    const clientName = (id?: string) => s.clients.find((c) => c.id === id)?.name || '';

    for (const t of s.tasks) {
      if (t.status === 'completed' || !t.dueDate) continue;
      if (t.dueDate < today) {
        await this.add({
          key: 'task-overdue:' + t.id + ':' + today,
          kind: 'task_overdue',
          severity: 'high',
          titleEn: 'Overdue task',
          titleAr: 'مهمة متأخرة',
          bodyEn: t.title + ' — due ' + fmt.date(t.dueDate, 'en'),
          bodyAr: t.title + ' — موعدها ' + fmt.date(t.dueDate, 'ar'),
          link: '/tasks/' + t.id,
        });
      } else if (t.dueDate <= soon) {
        await this.add({
          key: 'task-due:' + t.id + ':' + t.dueDate,
          kind: 'task_due',
          severity: 'medium',
          titleEn: 'Task deadline approaching',
          titleAr: 'موعد مهمة يقترب',
          bodyEn: t.title + ' — due ' + fmt.date(t.dueDate, 'en'),
          bodyAr: t.title + ' — موعدها ' + fmt.date(t.dueDate, 'ar'),
          link: '/tasks/' + t.id,
        });
      }
    }

    const soonInv = addDays(today, 3);
    for (const i of s.invoices) {
      if ((i.status !== 'issued' && i.status !== 'partial') || remaining(i) <= 0.004) continue;
      const rem = remaining(i);
      if (i.dueDate < today) {
        await this.add({
          key: 'inv-overdue:' + i.id + ':' + today,
          kind: 'payment_overdue',
          severity: 'high',
          titleEn: 'Overdue payment',
          titleAr: 'دفعة متأخرة',
          bodyEn: i.number + ' · ' + clientName(i.clientId) + ' — ' + fmt.money(rem, 'en'),
          bodyAr: i.number + ' · ' + clientName(i.clientId) + ' — ' + fmt.money(rem, 'ar'),
          link: '/accounting/invoices',
        });
      } else if (i.dueDate <= soonInv) {
        await this.add({
          key: 'inv-due:' + i.id + ':' + i.dueDate,
          kind: 'invoice_due',
          severity: 'medium',
          titleEn: 'Invoice due soon',
          titleAr: 'فاتورة مستحقة قريبًا',
          bodyEn: i.number + ' · ' + clientName(i.clientId) + ' — ' + fmt.date(i.dueDate, 'en'),
          bodyAr: i.number + ' · ' + clientName(i.clientId) + ' — ' + fmt.date(i.dueDate, 'ar'),
          link: '/accounting/invoices',
        });
      }
    }

    for (const p of s.projects) {
      if (p.archived || !(p.budget > 0) || p.status === 'cancelled') continue;
      const spent = fromCents(s.transactions.filter((t) => t.type === 'expense' && !t.voided && t.projectId === p.id).reduce((a, t) => a + toCents(t.amount), 0));
      const ratio = (spent / p.budget) * 100;
      const level = ratio >= 100 ? 100 : ratio >= 80 ? 80 : 0;
      if (level) {
        await this.add({
          key: 'budget:' + p.id + ':' + level,
          kind: 'budget',
          severity: level === 100 ? 'high' : 'medium',
          titleEn: level === 100 ? 'Project budget exceeded' : 'Project budget warning (80%)',
          titleAr: level === 100 ? 'تجاوز ميزانية المشروع' : 'تحذير ميزانية المشروع (80%)',
          bodyEn: p.name + ' — ' + fmt.money(spent, 'en') + ' of ' + fmt.money(p.budget, 'en'),
          bodyAr: p.name + ' — ' + fmt.money(spent, 'ar') + ' من ' + fmt.money(p.budget, 'ar'),
          link: '/projects/' + p.id,
        });
      }
    }

    const target = await this.settings.get<number>('profitTarget', 0);
    for (const ins of analyze(s, target).filter((x) => x.severity === 'high')) {
      await this.add({
        key: 'fin:' + ins.id + ':' + today,
        kind: 'financial_alert',
        severity: 'high',
        titleEn: ins.title.en,
        titleAr: ins.title.ar,
        bodyEn: ins.message.en,
        bodyAr: ins.message.ar,
        link: '/intelligence',
      });
    }
    await this.refreshCount();
  }

  async markRead(id: string): Promise<void> {
    await this.db.notifications.update(id, { read: true });
    await this.refreshCount();
  }

  async markAllRead(): Promise<void> {
    await this.db.notifications.toCollection().modify({ read: true });
    await this.refreshCount();
  }

  async clearRead(): Promise<void> {
    const ids = (await this.db.notifications.toArray()).filter((n) => n.read).map((n) => n.id);
    await this.db.notifications.bulkDelete(ids);
    await this.refreshCount();
  }
}
