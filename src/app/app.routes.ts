import { Routes } from '@angular/router';
import { setupGuard, setupPageGuard } from './core/services/setup.guard';

const t = (en: string, ar: string) => ({ crumb: { en, ar } });

export const routes: Routes = [
  {
    path: 'setup',
    canActivate: [setupPageGuard],
    loadComponent: () => import('./features/setup/setup').then((m) => m.Setup),
  },
  {
    path: '',
    canActivate: [setupGuard],
    loadComponent: () => import('./layouts/app-layout/app-layout').then((m) => m.AppLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', data: t('Dashboard', 'لوحة التحكم'), loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'clients', data: t('Clients', 'العملاء'), loadComponent: () => import('./features/clients/clients-page').then((m) => m.ClientsPage) },
      { path: 'clients/:id', data: t('Client details', 'تفاصيل العميل'), loadComponent: () => import('./features/clients/client-details').then((m) => m.ClientDetails) },
      { path: 'team', data: t('Team', 'الفريق'), loadComponent: () => import('./features/team/team-page').then((m) => m.TeamPage) },
      { path: 'team/:id', data: t('Employee details', 'تفاصيل الموظف'), loadComponent: () => import('./features/team/employee-details').then((m) => m.EmployeeDetails) },
      { path: 'projects', data: t('Projects', 'المشاريع'), loadComponent: () => import('./features/projects/projects-page').then((m) => m.ProjectsPage) },
      { path: 'projects/:id', data: t('Project details', 'تفاصيل المشروع'), loadComponent: () => import('./features/projects/project-details').then((m) => m.ProjectDetails) },
      { path: 'tasks', data: t('Tasks', 'المهام'), loadComponent: () => import('./features/tasks/tasks-page').then((m) => m.TasksPage) },
      { path: 'tasks/:id', data: t('Task details', 'تفاصيل المهمة'), loadComponent: () => import('./features/tasks/task-details').then((m) => m.TaskDetails) },
      { path: 'packages', data: t('Monthly packages', 'الباقات الشهرية'), loadComponent: () => import('./features/packages/packages-page').then((m) => m.PackagesPage) },
      { path: 'content', data: t('Content calendar', 'تقويم المحتوى'), loadComponent: () => import('./features/content/content-page').then((m) => m.ContentPage) },
      { path: 'social', data: t('Social accounts', 'حسابات السوشيال'), loadComponent: () => import('./features/social/social-page').then((m) => m.SocialPage) },
      { path: 'campaigns', data: t('Campaigns', 'الحملات'), loadComponent: () => import('./features/campaigns/campaigns-page').then((m) => m.CampaignsPage) },
      { path: 'accounting', data: t('Accounting', 'المحاسبة'), loadComponent: () => import('./features/accounting/accounting-dashboard').then((m) => m.AccountingDashboard) },
      { path: 'accounting/capital', data: t('Capital', 'رأس المال'), loadComponent: () => import('./features/accounting/capital-page').then((m) => m.CapitalPage) },
      { path: 'accounting/invoices', data: t('Invoices', 'الفواتير'), loadComponent: () => import('./features/accounting/invoices-page').then((m) => m.InvoicesPage) },
      { path: 'accounting/payments', data: t('Payments', 'المدفوعات'), loadComponent: () => import('./features/accounting/payments-page').then((m) => m.PaymentsPage) },
      { path: 'accounting/transactions', data: t('Income & expenses', 'الإيرادات والمصروفات'), loadComponent: () => import('./features/accounting/transactions-page').then((m) => m.TransactionsPage) },
      { path: 'accounting/assets', data: t('Assets', 'الأصول'), loadComponent: () => import('./features/accounting/assets-page').then((m) => m.AssetsPage) },
      { path: 'accounting/journal', data: t('Journal', 'دفتر اليومية'), loadComponent: () => import('./features/accounting/journal-page').then((m) => m.JournalPage) },
      { path: 'accounting/chart', data: t('Chart of accounts', 'دليل الحسابات'), loadComponent: () => import('./features/accounting/chart-page').then((m) => m.ChartPage) },
      { path: 'accounting/reports', data: t('Financial reports', 'التقارير المالية'), loadComponent: () => import('./features/accounting/financial-reports').then((m) => m.FinancialReports) },
      { path: 'intelligence', data: t('Financial intelligence', 'الذكاء المالي'), loadComponent: () => import('./features/intelligence/intelligence-page').then((m) => m.IntelligencePage) },
      { path: 'reports', data: t('Reports center', 'مركز التقارير'), loadComponent: () => import('./features/reports/reports-center').then((m) => m.ReportsCenter) },
      { path: 'backup', data: t('Backup & restore', 'النسخ الاحتياطي'), loadComponent: () => import('./features/backup/backup-page').then((m) => m.BackupPage) },
      { path: 'notifications', data: t('Notifications', 'الإشعارات'), loadComponent: () => import('./features/notifications/notifications-page').then((m) => m.NotificationsPage) },
      { path: 'activity', data: t('Activity history', 'سجل النشاط'), loadComponent: () => import('./features/notifications/activity-page').then((m) => m.ActivityPage) },
      { path: 'settings', data: t('Settings', 'الإعدادات'), loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
