import type { ReactNode } from "react";

/** Zestaw ikon jako inline SVG (kreska 1,75, siatka 24x24). Bez zewnętrznych bibliotek. */
const P = {
  home: (<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>),
  chart: (<><path d="M4 20V11" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>),
  pulse: (<path d="M3 12h4l3-8 4 16 3-8h4" />),
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5" /><path d="M16 4.7a3.5 3.5 0 010 6.6" /><path d="M18 14.8c2 .6 3.3 2.4 3.6 5.2" /></>),
  link: (<><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></>),
  list: (<><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>),
  settings: (<><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>),
  gift: (<><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M5 12v8a1 1 0 001 1h12a1 1 0 001-1v-8" /><path d="M12 8c-1.5-3.2-5-4-5-1.6C7 7.7 9 8 12 8zM12 8c1.5-3.2 5-4 5-1.6C17 7.7 15 8 12 8z" /></>),
  shield: (<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>),
  logout: (<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>),
  check: (<path d="M5 12.5l4.5 4.5L19 7.5" />),
  alert: (<><path d="M12 3.5l9.5 16.5h-19L12 3.5z" /><path d="M12 10v4.5M12 17.4v.1" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.9v.1" /></>),
  arrow: (<path d="M5 12h14M13 6l6 6-6 6" />),
  chevron: (<path d="M9 6l6 6-6 6" />),
  chevdown: (<path d="M6 9l6 6 6-6" />),
  sparkle: (<><path d="M11 3l2 5.5L18.5 10.5 13 12.5 11 18l-2-5.5L3.5 10.5 9 8.5 11 3z" /><path d="M19 16v4M17 18h4" /></>),
  building: (<><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>),
  bolt: (<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />),
  circle: (<circle cx="12" cy="12" r="9" />),
  menu: (<path d="M4 6h16M4 12h16M4 18h16" />),
  x: (<path d="M6 6l12 12M18 6L6 18" />),
  target: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
  database: (<><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>),
  file: (<><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>),
  trophy: (<><path d="M8 4h8v5a4 4 0 01-8 0V4z" /><path d="M8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 21h8M10 17h4" /></>),
  quote: (<><path d="M5 17v-5a5 5 0 015-5" /><path d="M13 17v-5a5 5 0 015-5" /><path d="M5 17h4v-4H5zM13 17h4v-4h-4z" /></>),
  plus: (<path d="M12 5v14M5 12h14" />),
  eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  external: (<><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  wallet: (<><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /><path d="M5 6l11-3v3" /></>),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, className, strokeWidth = 1.75 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {P[name]}
    </svg>
  );
}

/** Znak firmowy GeoTrace: ślad sygnału (trzy rosnące łuki wokół punktu). */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="6" cy="18" r="1.6" fill="currentColor" stroke="none" />
        <path d="M6 11a7 7 0 017 7" />
        <path d="M6 5a13 13 0 0113 13" />
      </svg>
    </span>
  );
}
