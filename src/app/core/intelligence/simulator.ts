import { LocalizedText } from '../models/common';
import { Baseline } from './analyzer';
import { round2 } from '../utils/money';

export type ScenarioType =
  | 'hire'
  | 'raise_salaries'
  | 'lose_client'
  | 'new_client'
  | 'buy_equipment'
  | 'marketing'
  | 'prices'
  | 'operating_costs';

export interface ScenarioInput {
  type: ScenarioType;
  /** المبلغ: راتب شهري / مبلغ شراء / إيراد العميل / زيادة تكاليف */
  amount: number;
  /** نسبة مئوية (زيادة مرتبات / تغيير أسعار / زيادة تكاليف) */
  percent: number;
  /** الأفق الزمني بالأشهر */
  horizon: number;
}

export interface Risk {
  level: 'high' | 'medium' | 'ok';
  text: LocalizedText;
}

export interface SimulationResult {
  currentProfit: number;
  projectedProfit: number;
  currentCash: number;
  projectedCash: number;
  monthlyRevenueDelta: number;
  monthlyExpenseDelta: number;
  oneOffCost: number;
  profitImpact: number;
  cashImpact: number;
  steps: { label: LocalizedText; value: number }[];
  risks: Risk[];
  insufficientData: boolean;
}

/** محاكاة بسيطة وشفافة: لا تعدّل أي سجلات محاسبية فعلية. */
export function simulate(b: Baseline, s: ScenarioInput): SimulationResult {
  const H = Math.max(1, Math.floor(s.horizon || 6));
  let dRev = 0;
  let dExp = 0;
  let oneOff = 0;
  const steps: SimulationResult['steps'] = [];
  const pct = (s.percent || 0) / 100;

  switch (s.type) {
    case 'hire':
      dExp = s.amount;
      steps.push({ label: { en: 'New monthly salary', ar: 'مرتب شهري جديد' }, value: s.amount });
      break;
    case 'raise_salaries':
      dExp = b.payroll * pct;
      steps.push({ label: { en: 'Current monthly payroll', ar: 'إجمالي المرتبات الحالية' }, value: b.payroll });
      steps.push({ label: { en: 'Increase (payroll × %)', ar: 'الزيادة (المرتبات × النسبة)' }, value: dExp });
      break;
    case 'lose_client':
      dRev = -s.amount;
      steps.push({ label: { en: 'Monthly revenue lost', ar: 'إيراد شهري مفقود' }, value: -s.amount });
      break;
    case 'new_client':
      dRev = s.amount;
      steps.push({ label: { en: 'Monthly revenue gained', ar: 'إيراد شهري إضافي' }, value: s.amount });
      break;
    case 'buy_equipment':
      oneOff = s.amount;
      steps.push({ label: { en: 'One-off cash purchase (capitalised, not an expense)', ar: 'شراء نقدي لمرة واحدة (أصل وليس مصروفًا)' }, value: s.amount });
      break;
    case 'marketing':
      dExp = s.amount;
      steps.push({ label: { en: 'Extra monthly marketing spend', ar: 'زيادة شهرية في التسويق' }, value: s.amount });
      break;
    case 'prices':
      dRev = b.monthlyRevenue * pct;
      steps.push({ label: { en: 'Average monthly revenue', ar: 'متوسط الإيراد الشهري' }, value: b.monthlyRevenue });
      steps.push({ label: { en: 'Change (revenue × %)', ar: 'التغيّر (الإيراد × النسبة)' }, value: dRev });
      break;
    case 'operating_costs':
      dExp = b.monthlyExpenses * pct;
      steps.push({ label: { en: 'Average monthly expenses', ar: 'متوسط المصروفات الشهرية' }, value: b.monthlyExpenses });
      steps.push({ label: { en: 'Increase (expenses × %)', ar: 'الزيادة (المصروفات × النسبة)' }, value: dExp });
      break;
  }

  const currentProfit = b.monthlyProfit;
  const projectedProfit = round2(currentProfit + dRev - dExp);
  const currentCash = b.cash;
  // النقدية بعد H شهر = الحالية + (الربح الشهري المتوقع × H) − الشراء لمرة واحدة. (الربح بديل تقريبي للتدفق النقدي)
  const projectedCash = round2(currentCash + projectedProfit * H - oneOff);
  const baselineCashAtH = round2(currentCash + currentProfit * H);
  const projRevenue = b.monthlyRevenue + dRev;
  const margin = projRevenue > 0 ? (projectedProfit / projRevenue) * 100 : 0;
  const projBurn = b.monthlyExpenses + dExp;
  const runway = projBurn > 0 ? (currentCash - oneOff) / projBurn : null;

  const risks: Risk[] = [];
  if (b.hasData === false) {
    risks.push({ level: 'medium', text: { en: 'Insufficient history: results rely on little or no recorded data.', ar: 'بيانات تاريخية غير كافية: النتائج تعتمد على بيانات قليلة أو معدومة.' } });
  }
  if (projectedProfit < 0) risks.push({ level: 'high', text: { en: 'Projected monthly result is a loss.', ar: 'النتيجة الشهرية المتوقعة خسارة.' } });
  if (projectedCash < 0) risks.push({ level: 'high', text: { en: `Cash may turn negative within ${H} months.`, ar: `قد تصبح النقدية سالبة خلال ${H} شهر.` } });
  if (oneOff > currentCash) risks.push({ level: 'high', text: { en: 'The purchase exceeds current cash.', ar: 'قيمة الشراء أكبر من النقدية الحالية.' } });
  if (runway !== null && runway < 3) risks.push({ level: 'medium', text: { en: 'Cash runway would drop below 3 months.', ar: 'مدة كفاية السيولة ستقل عن 3 أشهر.' } });
  if (projRevenue > 0 && margin < 10 && projectedProfit >= 0) risks.push({ level: 'medium', text: { en: 'Projected margin is under 10%.', ar: 'الهامش المتوقع أقل من 10%.' } });
  if (!risks.length) risks.push({ level: 'ok', text: { en: 'No major risk indicators under these assumptions.', ar: 'لا توجد مؤشرات خطر كبيرة وفق هذه الافتراضات.' } });

  return {
    currentProfit,
    projectedProfit,
    currentCash,
    projectedCash,
    monthlyRevenueDelta: round2(dRev),
    monthlyExpenseDelta: round2(dExp),
    oneOffCost: oneOff,
    profitImpact: round2(projectedProfit - currentProfit),
    cashImpact: round2(projectedCash - baselineCashAtH),
    steps,
    risks,
    insufficientData: !b.hasData,
  };
}
