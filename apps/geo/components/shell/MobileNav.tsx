"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";

/** Wysuwane menu na telefonie (pasek boczny jest wtedy ukryty). Zamyka się klawiszem Esc, przyciskiem i kliknięciem w tło. */
export function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="mnav">
      <button type="button" className="mnav-btn" aria-label="Otwórz menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" size={20} />
      </button>
      {open ? (
        <>
          <div className="mnav-bg" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="mnav-panel" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
            <button type="button" className="mnav-close btn ghost sm" aria-label="Zamknij menu" onClick={() => setOpen(false)}>
              <Icon name="x" size={16} />
            </button>
            {children}
          </div>
        </>
      ) : null}
    </div>
  );
}
