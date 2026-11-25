import { Injectable } from '@angular/core';
import { BenzedDb } from '../db/benzed-db';

/** نقطة الوصول الوحيدة لقاعدة البيانات */
@Injectable({ providedIn: 'root' })
export class DbService {
  readonly db = new BenzedDb();
}
