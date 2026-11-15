import type { DayMark } from '@/domain/adherence';
import { formatDate } from '@/domain/time';
import { CheckCircleIcon, CircleHalfIcon, MinusIcon, WarningCircleIcon } from './icons';

const MARKS: Record<DayMark['state'], { words: string; className: string; Icon: typeof MinusIcon }> = {
  all: { words: 'all taken', className: 'text-taken', Icon: CheckCircleIcon },
  some: { words: 'some missed', className: 'text-accent', Icon: CircleHalfIcon },
  none: { words: 'none taken', className: 'text-missed', Icon: WarningCircleIcon },
  empty: { words: 'no doses', className: 'text-muted', Icon: MinusIcon },
};

/** The last seven days as a row of marks, each with its day, an icon and the count in words. */
export function DayStrip({ days }: { days: DayMark[] }) {
  return (
    <ol className="grid grid-cols-7 gap-1 text-center sm:gap-2">
      {days.map((day) => {
        const { words, className, Icon } = MARKS[day.state];
        const [weekday] = formatDate(day.date).split(' ');
        return (
          <li
            key={day.date}
            className="grid justify-items-center gap-1 rounded-inner border border-line bg-surface px-1 py-2"
          >
            <span className="text-[0.8rem] font-bold" aria-hidden>
              {weekday}
            </span>
            <Icon aria-hidden weight="bold" size={26} className={className} />
            <span className="text-[0.8rem]" aria-hidden>
              {day.total === 0 ? 'none' : `${day.taken}/${day.total}`}
            </span>
            <span className="sr-only">
              {formatDate(day.date)}: {day.total === 0 ? words : `${day.taken} of ${day.total} taken, ${words}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
