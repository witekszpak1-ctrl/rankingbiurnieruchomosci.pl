import Link from "next/link";
import type { ReactNode } from "react";

import { auditFormAction, logoutAction } from "@/app/actions";
import { Icon, LogoMark, type IconName } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/ui";
import type { User } from "@/lib/auth";
import { listPortalNav } from "@/lib/master-repo";
import { loadPanelContext, type PanelContext } from "@/lib/panel-repo";

import { MobileNav } from "./MobileNav";
import { SlashFocus } from "./SlashFocus";

/**
 * Powłoka zalogowanych stron: pasek boczny (przełącznik firmy, grupy nawigacji, karta pakietu), górny pasek
 * (wyszukiwanie domeny ze skrótem "/") i treść. Strony przekazują `current` (adres pozycji menu do podświetlenia).
 */

type Item = { href: string; label: string; icon: IconName; badge?: string };
type Group = { title: string; items: Item[] };

/** Grupy nawigacji administratora (Master Dashboard). Pozycje portali pojawiają się tylko w sekcji "Portale". */
function adminGroups(portalNav: { slug: string; name: string }[]): Group[] {
  return [
    { title: "Pulpit", items: [{ href: "/admin", label: "Przegląd całości", icon: "home" }] },
    {
      title: "Portale",
      items: [
        { href: "/admin/portale", label: "Wszystkie portale", icon: "globe" },
        ...portalNav.map((p): Item => ({ href: `/admin/portale/${p.slug}`, label: p.name, icon: "building" })),
      ],
    },
    {
      title: "Dane",
      items: [
        { href: "/admin/robot", label: "Robot i kolejki", icon: "bolt" },
        { href: "/admin/koszty", label: "Koszty API", icon: "wallet" },
      ],
    },
    {
      title: "Widoczność AI",
      items: [
        { href: "/admin/ai", label: "Przegląd AI", icon: "sparkle" },
        { href: "/admin/pomiary", label: "Pomiary", icon: "pulse" },
        { href: "/admin/zrodla", label: "Źródła", icon: "link" },
        { href: "/admin/firmy", label: "Firmy w odpowiedziach", icon: "building" },
      ],
    },
    { title: "Ruch", items: [{ href: "/admin/ruch", label: "Ruch i boty", icon: "eye" }] },
    {
      title: "Biznes",
      items: [
        { href: "/admin/uzytkownicy", label: "Użytkownicy", icon: "users" },
        { href: "/admin/partnerzy", label: "Partnerzy", icon: "gift" },
        { href: "/admin/lista", label: "Lista oczekujących", icon: "list" },
      ],
    },
  ];
}

function groups(user: User, ctx: PanelContext | null, current: string, portalNav: { slug: string; name: string }[]): Group[] {
  // W administracji menu pokazuje tylko grupy administratora i dojście do panelu klienta.
  if (user.isAdmin && current.startsWith("/admin")) {
    return [
      ...adminGroups(current.startsWith("/admin/portale") ? portalNav : []),
      { title: "Konto", items: [{ href: "/panel", label: "Panel klienta", icon: "chart" }, { href: "/panel/ustawienia", label: "Ustawienia", icon: "settings" }] },
    ];
  }
  const d = ctx?.domain ? `/audyt/${encodeURIComponent(ctx.domain)}` : "/audyt";
  const done = ctx ? ctx.steps.filter((s) => s.done).length : 0;
  const total = ctx ? ctx.steps.length : 0;
  const g: Group[] = [
    {
      title: "Widoczność",
      items: [
        { href: "/panel", label: "Pulpit", icon: "home", badge: ctx && done < total ? `${done}/${total}` : undefined },
        { href: d, label: "Audyt", icon: "chart" },
        { href: `${d}${ctx?.domain ? "#konkurencja" : ""}`, label: "Konkurencja", icon: "users" },
        { href: `${d}${ctx?.domain ? "#zrodla" : ""}`, label: "Źródła", icon: "link" },
      ],
    },
    { title: "Rozwój", items: [{ href: "/partner/panel", label: "Program partnerski", icon: "gift" }] },
    { title: "Konto", items: [{ href: "/panel/ustawienia", label: "Ustawienia", icon: "settings" }] },
  ];
  if (user.isAdmin) g.push({ title: "Administracja", items: [{ href: "/admin", label: "Master Dashboard", icon: "shield" }] });
  return g;
}

function Nav({ user, ctx, current, portalNav }: { user: User; ctx: PanelContext | null; current: string; portalNav: { slug: string; name: string }[] }) {
  const gs = groups(user, ctx, current, portalNav);
  return (
    <>
      {gs.map((g) => (
        <div className="nav-group" key={g.title}>
          <div className="nav-title">{g.title}</div>
          {g.items.map((i) => (
            <Link key={i.label + i.href} href={i.href} className="nav-a" aria-current={i.href === current ? "page" : undefined}>
              <Icon name={i.icon} size={18} />
              {i.label}
              {i.badge ? <span className="badge">{i.badge}</span> : null}
            </Link>
          ))}
          {g.title === "Konto" ? (
            <form action={logoutAction}>
              <button type="submit" className="nav-btn">
                <Icon name="logout" size={18} />
                Wyloguj
              </button>
            </form>
          ) : null}
        </div>
      ))}
    </>
  );
}

function SidebarBody({ user, ctx, current, portalNav }: { user: User; ctx: PanelContext | null; current: string; portalNav: { slug: string; name: string }[] }) {
  const orgName = ctx?.primary?.name ?? user.name ?? user.email;
  const plan = ctx?.primary?.planName ?? "Free";
  const initial = (orgName.trim()[0] ?? "G").toUpperCase();
  return (
    <>
      <Link href="/" className="logo">
        <LogoMark />
        GeoTrace
      </Link>
      <div className="org">
        <span className="avatar">{initial}</span>
        <div className="org-t">
          <b>{orgName}</b>
          <span>Pakiet {plan}</span>
        </div>
      </div>
      <Nav user={user} ctx={ctx} current={current} portalNav={portalNav} />
      <div className="sidebar-foot">
        <div className="upgrade">
          <b>Pakiety płatne wkrótce</b>
          <p>Monitoring co tydzień, historia i raporty. Płatności jeszcze nie działają.</p>
          <Link className="btn sm soft" href="/#cennik">
            Zobacz pakiety
          </Link>
        </div>
      </div>
    </>
  );
}

export async function AppShell({
  user,
  current,
  children,
}: {
  user: User;
  /** Adres pozycji menu do podświetlenia, np. "/admin/pomiary". */
  current: string;
  children: ReactNode;
}) {
  let ctx: PanelContext | null = null;
  try {
    ctx = await loadPanelContext(user.id);
  } catch {
    ctx = null; // powłoka nie może wywrócić strony, gdy pulpit nie da się policzyć
  }
  let portalNav: { slug: string; name: string }[] = [];
  if (user.isAdmin && current.startsWith("/admin/portale")) {
    try {
      portalNav = await listPortalNav();
    } catch {
      portalNav = []; // brak migracji 0005 nie może wywrócić strony
    }
  }
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Menu główne">
        <SidebarBody user={user} ctx={ctx} current={current} portalNav={portalNav} />
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <MobileNav>
            <SidebarBody user={user} ctx={ctx} current={current} portalNav={portalNav} />
          </MobileNav>
          <form action={auditFormAction} className="search" role="search">
            <span className="s-ic">
              <Icon name="search" size={16} />
            </span>
            <input id="topsearch" name="domain" type="text" maxLength={300} placeholder="Sprawdź domenę, np. mojafirma.pl" autoComplete="off" aria-label="Sprawdź audyt domeny" />
            <kbd aria-hidden="true">/</kbd>
          </form>
          <div className="top-right">
            {user.isAdmin ? <Pill tone="brand">Administrator</Pill> : null}
            <div className="user-chip">
              <span className="avatar">{(user.email[0] ?? "G").toUpperCase()}</span>
              <span className="em">{user.email}</span>
            </div>
          </div>
        </header>
        <SlashFocus targetId="topsearch" />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
