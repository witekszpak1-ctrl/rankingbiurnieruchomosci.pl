import Link from "next/link";
import type { ReactNode } from "react";

import { auditFormAction, logoutAction } from "@/app/actions";
import { Icon, LogoMark, type IconName } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/ui";
import type { User } from "@/lib/auth";
import { loadPanelContext, type PanelContext } from "@/lib/panel-repo";

import { MobileNav } from "./MobileNav";
import { SlashFocus } from "./SlashFocus";

/**
 * Powłoka zalogowanych stron: pasek boczny (przełącznik firmy, grupy nawigacji, karta pakietu), górny pasek
 * (wyszukiwanie domeny ze skrótem "/") i treść. Strony przekazują `current` (adres pozycji menu do podświetlenia).
 */

type Item = { href: string; label: string; icon: IconName; badge?: string };
type Group = { title: string; items: Item[] };

function groups(user: User, ctx: PanelContext | null): Group[] {
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
  if (user.isAdmin) {
    g.push({
      title: "Administracja",
      items: [
        { href: "/admin", label: "Przegląd", icon: "shield" },
        { href: "/admin/pomiary", label: "Pomiary", icon: "pulse" },
        { href: "/admin/zrodla", label: "Źródła", icon: "link" },
        { href: "/admin/firmy", label: "Firmy", icon: "building" },
        { href: "/admin/lista", label: "Lista oczekujących", icon: "list" },
        { href: "/admin/uzytkownicy", label: "Użytkownicy", icon: "users" },
        { href: "/admin/partnerzy", label: "Partnerzy", icon: "wallet" },
      ],
    });
  }
  return g;
}

function Nav({ user, ctx, current }: { user: User; ctx: PanelContext | null; current: string }) {
  const gs = groups(user, ctx);
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

function SidebarBody({ user, ctx, current }: { user: User; ctx: PanelContext | null; current: string }) {
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
      <Nav user={user} ctx={ctx} current={current} />
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
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Menu główne">
        <SidebarBody user={user} ctx={ctx} current={current} />
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <MobileNav>
            <SidebarBody user={user} ctx={ctx} current={current} />
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
