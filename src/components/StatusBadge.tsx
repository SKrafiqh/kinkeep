import type { DoseView } from '@/domain/escalation';
import { CheckCircleIcon, ClockIcon, MinusCircleIcon, WarningCircleIcon } from './icons';

const STYLES: Record<DoseView, { label: string; className: string; Icon: typeof ClockIcon }> = {
  upcoming: { label: 'Due', className: 'text-due', Icon: ClockIcon },
  due: { label: 'Due now', className: 'text-due', Icon: ClockIcon },
  late: { label: 'Late', className: 'text-missed', Icon: ClockIcon },
  missed: { label: 'Missed', className: 'text-missed', Icon: WarningCircleIcon },
  taken: { label: 'Taken', className: 'text-taken', Icon: CheckCircleIcon },
  'taken-late': { label: 'Taken late', className: 'text-taken', Icon: CheckCircleIcon },
  skipped: { label: 'Skipped', className: 'text-muted', Icon: MinusCircleIcon },
};

/** Dose status as icon, word and colour together, never colour alone. */
export function StatusBadge({ view, time }: { view: DoseView; time?: string }) {
  const { label, className, Icon } = STYLES[view];
  return (
    <span className={`stamp ${className}`}>
      <Icon aria-hidden weight="bold" size={22} />
      {view === 'upcoming' && time ? `Due ${time}` : label}
    </span>
  );
}
