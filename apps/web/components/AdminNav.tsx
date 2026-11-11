"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  firms: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
    </>
  ),
  review: (
    <>
      <path d="M9 11l2 2 4-4" />
      <rect x="4" y="3" width="16" height="18" rx="2" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13h5l1.5 3h5L16 13h5" />
      <path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" />
    </>
  ),
  offers: (
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  runs: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
  audit: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  site: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

type Item = { href: string; label: string; icon: string; count?: number };

export function AdminNavLink({ href, label, icon, count }: Item) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className={`side-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
      {count ? <span className="side-count">{count}</span> : null}
    </Link>
  );
}
