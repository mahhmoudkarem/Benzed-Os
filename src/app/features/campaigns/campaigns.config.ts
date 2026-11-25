import { EntityConfig } from '../../shared/entity/entity.types';
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_STATUS, PLATFORMS } from '../../core/constants/options';
import { L_CLIENT } from '../../core/constants/lookups';
import { Campaign } from '../../core/models/business';

export interface CampaignMetrics {
  frequency: number;
  cpm: number;
  cpc: number;
  ctr: number;
  cpl: number;
  cpa: number;
  roas: number;
}

const div = (a: number, b: number) => (b > 0 ? a / b : 0);

export function campaignMetrics(c: Campaign): CampaignMetrics {
  return {
    frequency: div(c.impressions, c.reach),
    cpm: div(c.actualSpend, c.impressions) * 1000,
    cpc: div(c.actualSpend, c.clicks),
    ctr: div(c.clicks, c.impressions) * 100,
    cpl: div(c.actualSpend, c.leads),
    cpa: div(c.actualSpend, c.purchases),
    roas: div(c.revenue, c.actualSpend),
  };
}

const num = (n: number, d = 2) => (n ? n.toFixed(d) : '—');

export function campaignConfig(): EntityConfig {
  return {
    table: 'campaigns',
    title: { en: 'Campaigns', ar: 'الحملات' },
    singular: { en: 'Campaign', ar: 'حملة' },
    icon: 'target',
    titleOf: (r) => r.name,
    defaultSort: { key: 'startDate', dir: 'desc' },
    searchKeys: ['name', 'audience'],
    filters: [
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, options: CAMPAIGN_STATUS },
      { key: 'platform', label: { en: 'Platform', ar: 'المنصة' }, options: PLATFORMS },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, lookup: L_CLIENT },
    ],
    columns: [
      { key: 'name', label: { en: 'Campaign', ar: 'الحملة' } },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'lookup', lookup: L_CLIENT },
      { key: 'platform', label: { en: 'Platform', ar: 'المنصة' }, type: 'badge', options: PLATFORMS },
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, type: 'badge', options: CAMPAIGN_STATUS },
      { key: 'budget', label: { en: 'Budget', ar: 'الميزانية' }, type: 'money' },
      { key: 'actualSpend', label: { en: 'Spend', ar: 'الإنفاق' }, type: 'money' },
      { key: 'ctr', label: { en: 'CTR', ar: 'CTR' }, type: 'custom', noSort: true, render: (r) => num(campaignMetrics(r).ctr) + (r.impressions ? '%' : '') },
      { key: 'cpc', label: { en: 'CPC', ar: 'CPC' }, type: 'custom', noSort: true, render: (r) => num(campaignMetrics(r).cpc) },
      { key: 'cpl', label: { en: 'CPL', ar: 'CPL' }, type: 'custom', noSort: true, render: (r) => num(campaignMetrics(r).cpl) },
      { key: 'roas', label: { en: 'ROAS', ar: 'ROAS' }, type: 'custom', noSort: true, render: (r) => num(campaignMetrics(r).roas) + (r.actualSpend && r.revenue ? 'x' : '') },
    ],
    fields: [
      { key: 'name', label: { en: 'Campaign name', ar: 'اسم الحملة' }, type: 'text', required: true, maxLength: 140, colSpan: 2 },
      { key: 'clientId', label: { en: 'Client', ar: 'العميل' }, type: 'select', lookup: L_CLIENT, required: true },
      { key: 'platform', label: { en: 'Platform', ar: 'المنصة' }, type: 'select', options: PLATFORMS, required: true },
      { key: 'objective', label: { en: 'Objective', ar: 'الهدف' }, type: 'select', options: CAMPAIGN_OBJECTIVES, required: true },
      { key: 'status', label: { en: 'Status', ar: 'الحالة' }, type: 'select', options: CAMPAIGN_STATUS, required: true, default: 'draft' },
      { key: 'startDate', label: { en: 'Start date', ar: 'تاريخ البدء' }, type: 'date', required: true, default: '$today' },
      { key: 'endDate', label: { en: 'End date', ar: 'تاريخ الانتهاء' }, type: 'date', required: true },
      { key: 'budget', label: { en: 'Budget (EGP)', ar: 'الميزانية (ج.م)' }, type: 'money', min: 0, default: 0 },
      { key: 'actualSpend', label: { en: 'Actual spend (EGP)', ar: 'الإنفاق الفعلي (ج.م)' }, type: 'money', min: 0, default: 0 },
      { key: 'audience', label: { en: 'Audience', ar: 'الجمهور' }, type: 'text', colSpan: 2 },
      { key: 'reach', label: { en: 'Reach', ar: 'الوصول' }, type: 'number', min: 0, default: 0 },
      { key: 'impressions', label: { en: 'Impressions', ar: 'مرات الظهور' }, type: 'number', min: 0, default: 0 },
      { key: 'clicks', label: { en: 'Clicks', ar: 'النقرات' }, type: 'number', min: 0, default: 0 },
      { key: 'leads', label: { en: 'Leads', ar: 'العملاء المحتملون' }, type: 'number', min: 0, default: 0 },
      { key: 'purchases', label: { en: 'Purchases', ar: 'المشتريات' }, type: 'number', min: 0, default: 0 },
      { key: 'revenue', label: { en: 'Revenue generated (EGP)', ar: 'الإيراد الناتج (ج.م)' }, type: 'money', min: 0, default: 0 },
    ],
    validate: (v) => (v['endDate'] && v['startDate'] && v['endDate'] < v['startDate'] ? { endDate: { en: 'End date cannot be before the start date', ar: 'تاريخ الانتهاء لا يسبق البداية' } } : null),
  };
}
