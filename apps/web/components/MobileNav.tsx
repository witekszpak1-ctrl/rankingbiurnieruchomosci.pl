"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Menu na telefonie: przycisk w nagłówku otwiera panel z linkami. Zamyka się po wyborze strony, klawiszem Esc i przyciskiem. */
export function MobileNav({ links, cta }: { links: { href: string; label: string }[]; cta: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("mnav-lock");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("mnav-lock");
    };
  }, [open]);

  return (
    <div className="mnav">
      <button
        type="button"
        className={`mnav-btn${open ? " open" : ""}`}
        aria-expanded={open}
        aria-controls="mnav-panel"
        aria-label={open ? "Zamknij menu" : "Otwórz menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      <nav id="mnav-panel" className="mnav-panel" aria-label="Menu" hidden={!open}>
        <ul>
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setOpen(false)}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <Link className="mnav-cta" href="/#szukaj" onClick={() => setOpen(false)}>
          {cta} <span aria-hidden="true">→</span>
        </Link>
      </nav>
    </div>
  );
}
