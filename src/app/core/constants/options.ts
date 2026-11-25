import { Option } from '../models/common';

const o = (value: string, en: string, ar: string, color?: Option['color']): Option => ({
  value,
  label: { en, ar },
  color,
});

export const CLIENT_STATUS: Option[] = [
  o('lead', 'Lead', 'عميل محتمل', 'blue'),
  o('active', 'Active', 'نشط', 'green'),
  o('paused', 'Paused', 'متوقف مؤقتًا', 'amber'),
  o('inactive', 'Inactive', 'غير نشط', 'gray'),
];

export const EMPLOYMENT_STATUS: Option[] = [
  o('active', 'Active', 'على رأس العمل', 'green'),
  o('probation', 'Probation', 'تحت التجربة', 'blue'),
  o('on_leave', 'On leave', 'في إجازة', 'amber'),
  o('terminated', 'Terminated', 'منتهي الخدمة', 'gray'),
];

export const DEPARTMENTS: Option[] = [
  o('design', 'Design', 'التصميم'),
  o('content', 'Content', 'المحتوى'),
  o('video', 'Video & Motion', 'الفيديو والموشن'),
  o('media_buying', 'Media Buying', 'الإعلانات الممولة'),
  o('social', 'Social Media', 'السوشيال ميديا'),
  o('accounts', 'Account Management', 'إدارة الحسابات'),
  o('admin', 'Administration', 'الإدارة'),
];

export const PROJECT_STATUS: Option[] = [
  o('planning', 'Planning', 'تخطيط', 'blue'),
  o('active', 'Active', 'جاري', 'green'),
  o('on_hold', 'On hold', 'معلّق', 'amber'),
  o('completed', 'Completed', 'مكتمل', 'teal'),
  o('cancelled', 'Cancelled', 'ملغي', 'gray'),
];

export const PRIORITY: Option[] = [
  o('low', 'Low', 'منخفضة', 'gray'),
  o('medium', 'Medium', 'متوسطة', 'blue'),
  o('high', 'High', 'عالية', 'amber'),
  o('urgent', 'Urgent', 'عاجلة', 'red'),
];

export const TASK_STATUS: Option[] = [
  o('new', 'New', 'جديدة', 'gray'),
  o('assigned', 'Assigned', 'مُسندة', 'blue'),
  o('in_progress', 'In Progress', 'قيد التنفيذ', 'purple'),
  o('under_review', 'Under Review', 'قيد المراجعة', 'amber'),
  o('revision_required', 'Revision Required', 'تحتاج تعديل', 'red'),
  o('approved', 'Approved', 'معتمدة', 'teal'),
  o('delivered', 'Delivered', 'تم التسليم', 'green'),
  o('completed', 'Completed', 'مكتملة', 'green'),
];

export const PLATFORMS: Option[] = [
  o('facebook', 'Facebook', 'فيسبوك', 'blue'),
  o('instagram', 'Instagram', 'إنستجرام', 'purple'),
  o('tiktok', 'TikTok', 'تيك توك', 'gray'),
  o('snapchat', 'Snapchat', 'سناب شات', 'amber'),
  o('youtube', 'YouTube', 'يوتيوب', 'red'),
  o('linkedin', 'LinkedIn', 'لينكدإن', 'blue'),
  o('website', 'Website', 'الموقع', 'teal'),
];

export const CONTENT_TYPES: Option[] = [
  o('post', 'Post / Design', 'بوست / تصميم'),
  o('carousel', 'Carousel', 'كاروسيل'),
  o('reel', 'Reel', 'ريلز'),
  o('story', 'Story', 'ستوري'),
  o('video', 'Video', 'فيديو'),
  o('article', 'Article', 'مقال'),
  o('other', 'Other', 'أخرى'),
];

export const CONTENT_STATUS: Option[] = [
  o('idea', 'Idea', 'فكرة', 'gray'),
  o('planned', 'Planned', 'مخطط', 'blue'),
  o('in_production', 'In Production', 'قيد الإنتاج', 'purple'),
  o('under_review', 'Under Review', 'قيد المراجعة', 'amber'),
  o('approved', 'Approved', 'معتمد', 'teal'),
  o('scheduled', 'Scheduled', 'مجدول', 'blue'),
  o('published', 'Published', 'منشور', 'green'),
  o('cancelled', 'Cancelled', 'ملغي', 'red'),
];

export const CAMPAIGN_STATUS: Option[] = [
  o('draft', 'Draft', 'مسودة', 'gray'),
  o('active', 'Active', 'نشطة', 'green'),
  o('paused', 'Paused', 'متوقفة', 'amber'),
  o('completed', 'Completed', 'منتهية', 'teal'),
  o('cancelled', 'Cancelled', 'ملغاة', 'red'),
];

export const CAMPAIGN_OBJECTIVES: Option[] = [
  o('awareness', 'Awareness', 'وعي بالعلامة'),
  o('traffic', 'Traffic', 'زيارات'),
  o('engagement', 'Engagement', 'تفاعل'),
  o('leads', 'Leads', 'عملاء محتملون'),
  o('sales', 'Sales', 'مبيعات'),
  o('messages', 'Messages', 'رسائل'),
];

/** أنواع الخدمات في الباقات + تُستخدم كـ "خدمة" في الفواتير والمصروفات لتحليل الربحية */
export const SERVICE_TYPES: Option[] = [
  o('design', 'Designs', 'تصميمات'),
  o('reel', 'Reels', 'ريلز'),
  o('story', 'Stories', 'ستوري'),
  o('video', 'Videos', 'فيديوهات'),
  o('content_plan', 'Content Plan', 'خطة محتوى'),
  o('page_management', 'Page Management', 'إدارة صفحات'),
  o('media_buying', 'Media Buying', 'ميديا بايينج'),
  o('other', 'Other', 'أخرى'),
];

export const PAYMENT_METHODS: Option[] = [
  o('cash', 'Cash', 'نقدي'),
  o('bank', 'Bank transfer', 'تحويل بنكي'),
  o('instapay', 'InstaPay', 'إنستاباي'),
  o('wallet', 'Mobile wallet', 'محفظة إلكترونية'),
  o('card', 'Card', 'بطاقة'),
  o('cheque', 'Cheque', 'شيك'),
];

export const EXPENSE_CATEGORIES: Option[] = [
  o('salaries', 'Salaries', 'المرتبات', 'blue'),
  o('software', 'Software Subscriptions', 'اشتراكات البرامج', 'purple'),
  o('marketing', 'Marketing', 'التسويق', 'amber'),
  o('rent_utilities', 'Rent and Utilities', 'الإيجار والمرافق', 'teal'),
  o('freelancers', 'Freelancers', 'فريلانسرز', 'green'),
  o('equipment', 'Equipment (small items)', 'معدات (بنود صغيرة)', 'gray'),
  o('other', 'Other Expenses', 'مصروفات أخرى', 'gray'),
];

export const INCOME_CATEGORIES: Option[] = [
  o('service_revenue', 'Service revenue (no invoice)', 'إيراد خدمات (بدون فاتورة)', 'green'),
  o('other_income', 'Other income', 'إيرادات أخرى', 'teal'),
];

/** ربط تصنيف المصروف بكود الحساب في دليل الحسابات */
export const CATEGORY_ACCOUNT: Record<string, string> = {
  salaries: '5100',
  software: '5200',
  marketing: '5300',
  rent_utilities: '5400',
  freelancers: '5500',
  equipment: '5600',
  other: '5700',
  service_revenue: '4000',
  other_income: '4900',
};

export const CAPITAL_TYPES: Option[] = [
  o('initial', 'Initial capital', 'رأس المال الابتدائي', 'blue'),
  o('additional', 'Additional capital / owner contribution', 'رأس مال إضافي / مساهمة المالك', 'green'),
  o('withdrawal', 'Owner withdrawal', 'سحب المالك', 'red'),
];

export function optionLabel(list: Option[], value: string | undefined, lang: 'en' | 'ar'): string {
  const f = list.find((x) => x.value === value);
  return f ? f.label[lang] : value || '—';
}

export function optionColor(list: Option[], value: string | undefined): string {
  return list.find((x) => x.value === value)?.color || 'gray';
}
