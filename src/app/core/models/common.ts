export interface LocalizedText {
  en: string;
  ar: string;
}

export type BadgeColor = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal';

export interface Option {
  value: string;
  label: LocalizedText;
  color?: BadgeColor;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
