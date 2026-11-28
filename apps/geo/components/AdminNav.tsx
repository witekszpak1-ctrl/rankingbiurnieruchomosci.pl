import Link from "next/link";

const ITEMS = [
  { href: "/admin", label: "Przegląd" },
  { href: "/admin/pomiary", label: "Pomiary" },
  { href: "/admin/zrodla", label: "Źródła" },
  { href: "/admin/firmy", label: "Firmy" },
  { href: "/admin/lista", label: "Lista oczekujących" },
  { href: "/admin/uzytkownicy", label: "Użytkownicy" },
  { href: "/admin/partnerzy", label: "Partnerzy" },
] as const;

/** Nawigacja między stronami panelu administratora. Strony same wywołują requireAdmin, to tylko linki. */
export function AdminNav({ current }: { current: (typeof ITEMS)[number]["href"] }) {
  return (
    <nav className="admin" aria-label="Panel administratora">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.href === current ? "page" : undefined}>{i.label}</Link>
      ))}
    </nav>
  );
}
