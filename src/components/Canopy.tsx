const LEAVES = [
  'M0 0C40 -6 92 14 118 62C86 70 36 54 0 0Z',
  'M0 0C30 -22 84 -22 128 8C98 38 44 36 0 0Z',
  'M0 0C18 34 14 90 -10 132C-38 98 -30 40 0 0Z',
];

// Clusters around the rim of the window, each turned to reach in towards the sky: x, y, angle, size, depth.
const RIM: Array<[number, number, number, number, number]> = [
  [-20, -10, 40, 2.1, 1],
  [260, -40, 95, 1.8, 0.8],
  [620, -60, 80, 2.0, 0.9],
  [960, -30, 110, 1.8, 0.75],
  [1230, 0, 140, 2.2, 1],
  [1250, 360, 175, 1.8, 0.85],
  [1220, 730, 220, 2.1, 1],
  [860, 760, 265, 1.8, 0.8],
  [420, 770, 280, 1.9, 0.9],
  [-20, 720, 320, 2.2, 1],
  [-50, 360, 5, 1.8, 0.85],
];

/**
 * A ring of leaves seen from below, framing a patch of sky, after the template's canopy. Drawn,
 * not photographed, and still: nothing moves. Decorative, so hidden from assistive tech.
 * `id` keeps the gradient ids unique when the window appears twice on a page.
 */
export function Canopy({ id }: { id: string }) {
  const near = `${id}-near`;
  const far = `${id}-far`;
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <linearGradient id={near} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a4444" />
          <stop offset="1" stopColor="#3f8f7c" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={far} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b45309" stopOpacity="0.8" />
          <stop offset="1" stopColor="#f6d9a4" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {RIM.map(([x, y, angle, size, depth], index) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`} opacity={depth}>
          {LEAVES.map((d, leaf) => (
            <path key={d} d={d} fill={`url(#${(index + leaf) % 3 === 0 ? far : near})`} />
          ))}
        </g>
      ))}
    </svg>
  );
}
