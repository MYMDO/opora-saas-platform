export interface ComplianceDeadline {
  readonly id: string;
  readonly title: string;
  readonly dueDateIso: string;
}

const MS_PER_DAY = 86_400_000;

export function daysUntil(dueDateIso: string, now: Date = new Date()): number {
  const due = new Date(`${dueDateIso}T00:00:00`);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - startOfToday.getTime()) / MS_PER_DAY);
}

export type DeadlineTone = 'danger' | 'neutral';

export function deadlineTone(daysLeft: number): DeadlineTone {
  return daysLeft <= 5 ? 'danger' : 'neutral';
}
