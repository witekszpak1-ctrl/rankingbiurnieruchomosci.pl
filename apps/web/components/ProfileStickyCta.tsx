"use client";

import { useEffect, useState } from "react";

/**
 * Przycisk "Zapytaj o ofertę" przyklejony do dołu ekranu w profilu firmy, gdy formularz nie stoi obok treści
 * (telefon, tablet; CSS pokazuje go tylko w jednej kolumnie). Chowa się, gdy na ekranie widać przycisk u góry profilu
 * albo sam formularz, żeby nie dublować przycisku. Bez JavaScriptu zostaje schowany.
 */
export function ProfileStickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const form = document.getElementById("zapytanie");
    if (!form || typeof IntersectionObserver === "undefined") return;
    const watched = [form, document.querySelector(".profile-actions")].filter((el): el is Element => el !== null);
    const visible = new Map<Element, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
      setShow(watched.every((el) => !visible.get(el)));
    });
    for (const el of watched) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sticky-cta" data-hidden={show ? "false" : "true"} aria-hidden={!show}>
      <a className="btn-green" href="#zapytanie" tabIndex={show ? undefined : -1}>
        Zapytaj o ofertę
      </a>
    </div>
  );
}
