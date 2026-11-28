"use client";

import { useEffect } from "react";

/** Skrót "/" ustawia fokus w polu wyszukiwania (poza polami formularzy). */
export function SlashFocus({ targetId }: { targetId: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const el = document.getElementById(targetId) as HTMLInputElement | null;
      if (el) {
        e.preventDefault();
        el.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [targetId]);
  return null;
}
