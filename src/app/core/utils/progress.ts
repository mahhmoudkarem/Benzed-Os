import { Project, Task } from '../models/business';

/** نسبة تقدم المشروع: من المهام لو موجودة، وإلا من القيمة اليدوية */
export function projectProgress(p: Project, tasks: Task[]): number {
  const t = tasks.filter((x) => x.projectId === p.id);
  if (t.length) return Math.round((t.filter((x) => x.status === 'completed').length / t.length) * 100);
  return Math.min(100, Math.max(0, Number(p.progress) || 0));
}
