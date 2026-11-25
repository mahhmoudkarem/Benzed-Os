import { BaseEntity } from './common';

export interface Client extends BaseEntity {
  name: string;
  companyName: string;
  brandName: string;
  businessType: string;
  email: string;
  phone: string;
  whatsapp: string;
  country: string;
  city: string;
  address: string;
  startDate: string;
  status: string;
  accountManagerId?: string;
  notes: string;
  brandVoice: string;
  targetAudience: string;
  brandColors: string;
  brandNotes: string;
  archived: boolean;
}

export interface Employee extends BaseEntity {
  fullName: string;
  imageUrl: string;
  jobTitle: string;
  department: string;
  specialization: string;
  email: string;
  phone: string;
  joiningDate: string;
  employmentStatus: string;
  monthlySalary: number;
  notes: string;
  archived: boolean;
}

export interface Project extends BaseEntity {
  name: string;
  clientId: string;
  description: string;
  status: string;
  priority: string;
  startDate: string;
  deadline: string;
  budget: number;
  assignedEmployeeIds: string[];
  progress: number;
  completedDate?: string;
  notes: string;
  archived: boolean;
}

export interface Task extends BaseEntity {
  title: string;
  description: string;
  clientId?: string;
  projectId?: string;
  assigneeId?: string;
  priority: string;
  status: string;
  createdDate: string;
  startDate: string;
  dueDate: string;
  estimatedHours: number;
  actualHours: number;
  notes: string;
  completedAt?: string;
}

export interface TaskComment extends BaseEntity {
  taskId: string;
  text: string;
}

export interface TaskHistory extends BaseEntity {
  taskId: string;
  type: string;
  fromValue?: string;
  toValue?: string;
  text: string;
}

export interface WorkSession extends BaseEntity {
  employeeId: string;
  taskId?: string;
  date: string;
  hours: number;
  notes: string;
}

export interface ServiceLine {
  type: string;
  quantity: number;
}

export interface PackagePlan extends BaseEntity {
  name: string;
  description: string;
  price: number;
  services: ServiceLine[];
  active: boolean;
}

export interface ClientPackage extends BaseEntity {
  clientId: string;
  packageId: string;
  startDate: string;
  endDate?: string;
  customPrice?: number;
  status: string;
}

export interface UsageItem {
  type: string;
  required: number;
  completed: number;
  approved: number;
  delivered: number;
}

export interface ExtraService {
  description: string;
  quantity: number;
  price: number;
}

export interface PackageUsage extends BaseEntity {
  clientPackageId: string;
  clientId: string;
  month: string;
  items: UsageItem[];
  extras: ExtraService[];
}

export interface ContentItem extends BaseEntity {
  clientId: string;
  platform: string;
  contentType: string;
  title: string;
  caption: string;
  designBrief: string;
  creativeDirection: string;
  assigneeId?: string;
  publishDate: string;
  status: string;
  notes: string;
}

export interface SocialAccount extends BaseEntity {
  clientId: string;
  platform: string;
  accountName: string;
  url: string;
  notes: string;
}

export interface Campaign extends BaseEntity {
  clientId: string;
  platform: string;
  name: string;
  objective: string;
  startDate: string;
  endDate: string;
  budget: number;
  actualSpend: number;
  audience: string;
  status: string;
  reach: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  revenue: number;
}

export interface ActivityRecord extends BaseEntity {
  at: string;
  type: string;
  entityType: string;
  entityId?: string;
  messageEn: string;
  messageAr: string;
}

export interface AppNotification extends BaseEntity {
  key: string;
  kind: string;
  severity: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  link?: string;
  read: boolean;
  at: string;
}

export interface DailyReport extends BaseEntity {
  date: string;
  status: 'generated' | 'failed';
  trigger: 'auto' | 'catchup' | 'manual';
  lang: string;
  fileName: string;
  size: number;
  partial: boolean;
  error?: string;
  generatedAt: string;
  data?: ArrayBuffer;
}

export interface BackupRecord extends BaseEntity {
  kind: 'export' | 'import' | 'reset';
  fileName: string;
  size: number;
  at: string;
  note: string;
  records: number;
}

export interface SettingRecord {
  key: string;
  value: any;
}
