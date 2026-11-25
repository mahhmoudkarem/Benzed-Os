import { Injectable, inject } from '@angular/core';
import { Repositories } from '../repositories/repositories';
import { isoNow } from '../utils/date';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly repos = inject(Repositories);

  /** تسجيل عملية مهمة في سجل النشاط (محلي) */
  async log(
    type: string,
    entityType: string,
    entityId: string | undefined,
    messageEn: string,
    messageAr: string,
  ): Promise<void> {
    try {
      await this.repos.activities.create({
        at: isoNow(),
        type,
        entityType,
        entityId,
        messageEn,
        messageAr,
      });
    } catch (e) {
      console.error('Activity log failed', e);
    }
  }
}
