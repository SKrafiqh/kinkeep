import type { AdherenceStat } from '@/domain/adherence';

/** Adherence as a sentence first and a bar second. The bar is drawn with SVG attributes, not inline styles. */
export function AdherenceBar({ label, stat }: { label: string; stat: AdherenceStat }) {
  return (
    <div className="grid gap-1">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-bold">{label}</span>
        <span>
          {stat.percent === null ? 'No doses yet' : `${stat.percent}%, ${stat.taken} of ${stat.total} doses taken`}
        </span>
      </p>
      {stat.percent === null ? null : (
        <svg
          viewBox="0 0 100 4"
          preserveAspectRatio="none"
          className="h-3 w-full rounded-full"
          aria-hidden
          focusable="false"
        >
          <rect width="100" height="4" className="fill-wash" />
          <rect width={stat.percent} height="4" className="fill-primary" />
        </svg>
      )}
    </div>
  );
}
