import { LocalizedText, Option } from '../../core/models/common';

export interface LookupDef {
  table: string;
  label: string | ((r: any) => string);
  filter?: (r: any) => boolean;
}

export type FieldType = 'text' | 'email' | 'tel' | 'url' | 'number' | 'money' | 'date' | 'select' | 'textarea' | 'checkbox' | 'multiselect';

export interface FieldDef {
  key: string;
  label: LocalizedText;
  type: FieldType;
  required?: boolean;
  options?: Option[];
  lookup?: LookupDef;
  min?: number;
  max?: number;
  maxLength?: number;
  /** '$today' = تاريخ اليوم بتوقيت القاهرة */
  default?: any;
  colSpan?: 1 | 2;
  placeholder?: string;
}

export type ColumnType = 'text' | 'money' | 'date' | 'badge' | 'lookup' | 'number' | 'percent' | 'bool' | 'custom';

export interface ColumnDef {
  key: string;
  label: LocalizedText;
  type?: ColumnType;
  options?: Option[];
  lookup?: LookupDef;
  /** أول عمود عادةً: يعمل لينك لصفحة التفاصيل */
  link?: boolean;
  render?: (row: any, ctx: EntityCtx) => string;
  noSort?: boolean;
}

export interface FilterDef {
  key: string;
  label: LocalizedText;
  options?: Option[];
  lookup?: LookupDef;
}

export interface EntityCtx {
  maps: Record<string, Map<string, string>>;
  money: (n: number) => string;
  date: (s: string) => string;
  lang: 'en' | 'ar';
}

export interface RowAction {
  icon: string;
  label: LocalizedText;
  run: (row: any, page: EntityPageApi) => Promise<void> | void;
  show?: (row: any) => boolean;
}

export interface ToolbarAction {
  icon: string;
  label: LocalizedText;
  run: (page: EntityPageApi) => Promise<void> | void;
}

/** واجهة بسيطة بتتعرض للأكشنز المخصصة */
export interface EntityPageApi {
  reload: () => Promise<void>;
  fixed: Record<string, any>;
}

export interface EntityConfig {
  table: string;
  title: LocalizedText;
  singular: LocalizedText;
  icon?: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  searchKeys: string[];
  filters?: FilterDef[];
  archive?: boolean;
  allowDelete?: boolean;
  allowAdd?: boolean;
  allowEdit?: boolean;
  detailRoute?: (row: any) => any[];
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  titleOf: (row: any) => string;
  /** قيم افتراضية إضافية عند الإنشاء */
  defaults?: () => Record<string, any>;
  /** تعديل/إضافة قيم قبل الحفظ */
  beforeSave?: (value: Record<string, any>, existing: any | null) => Record<string, any> | Promise<Record<string, any>>;
  /** استبدال الحفظ الافتراضي (مثلاً لتسجيل تاريخ المهام) */
  persist?: (value: Record<string, any>, existing: any | null) => Promise<any>;
  validate?: (value: Record<string, any>) => Record<string, LocalizedText> | null;
  /** يرجّع رسالة لو الحذف ممنوع (سجلات مرتبطة) */
  deleteGuard?: (row: any) => Promise<LocalizedText | null>;
  /** تحويل السجل لقيم الفورم (لو الحقول مختلفة عن المخزّن) */
  toForm?: (record: any) => Record<string, any>;
  /** حذف مخصص (مثلاً حذف المهمة مع سجلها) */
  remove?: (row: any) => Promise<void>;
  rowActions?: RowAction[];
  toolbar?: ToolbarAction[];
  emptyText?: LocalizedText;
}
