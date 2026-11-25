import { Table } from 'dexie';
import { BaseEntity } from '../models/common';
import { uid } from '../utils/id';
import { isoNow } from '../utils/date';

/** Repository Pattern: لو اتضاف Backend بعدين، بنبدّل التنفيذ هنا بس. */
export class Repo<T extends BaseEntity> {
  constructor(readonly table: Table<T, string>) {}

  list(): Promise<T[]> {
    return this.table.toArray();
  }

  get(id: string): Promise<T | undefined> {
    return this.table.get(id);
  }

  count(): Promise<number> {
    return this.table.count();
  }

  async create(data: Partial<T>): Promise<T> {
    const now = isoNow();
    const rec = { ...data, id: (data as any).id || uid(), createdAt: now, updatedAt: now } as T;
    await this.table.add(rec);
    return rec;
  }

  async update(id: string, changes: Partial<T>): Promise<T> {
    const n = await this.table.update(id as any, { ...(changes as any), updatedAt: isoNow() });
    if (!n) throw new Error('Record not found: ' + id);
    return (await this.table.get(id)) as T;
  }

  remove(id: string): Promise<void> {
    return this.table.delete(id);
  }

  where(field: string, value: any): Promise<T[]> {
    return this.table.where(field).equals(value).toArray();
  }
}
