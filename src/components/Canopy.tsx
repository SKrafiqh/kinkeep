const LEAVES = [
  { d: 'M0 0C40 -6 92 14 118 62C86 70 36 54 0 0Z', fill: 'url(#leaf-a)' },
  { d: 'M0 0C30 -22 84 -22 128 8C98 38 44 36 0 0Z', fill: 'url(#leaf-b)' },
  { d: 'M0 0C18 34 14 90 -10 132C-38 98 -30 40 0 0Z', fill: 'url(#leaf-a)' },
];

/** Decorative leaves leaning in from the top corner, as if the page sits under a tree. Hidden from assistive tech. */
export function Canopy({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 420" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="leaf-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f5c5c" stopOpacity="0.9" />
          <stop offset="1" stopColor="#7fb8a4" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="leaf-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b45309" stopOpacity="0.75" />
          <stop offset="1" stopColor="#f6d9a4" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <g className="sway">
        <g transform="translate(500 -10) rotate(128) scale(2.1)">
          {LEAVES.map((leaf) => (
            <path key={leaf.d} d={leaf.d} fill={leaf.fill} />
          ))}
        </g>
        <g transform="translate(540 120) rotate(150) scale(1.5)" opacity="0.8">
          {LEAVES.map((leaf) => (
            <path key={leaf.d} d={leaf.d} fill={leaf.fill} />
          ))}
        </g>
        <g transform="translate(390 -30) rotate(104) scale(1.2)" opacity="0.65">
          {LEAVES.map((leaf) => (
            <path key={leaf.d} d={leaf.d} fill={leaf.fill} />
          ))}
        </g>
      </g>
    </svg>
  );
}
