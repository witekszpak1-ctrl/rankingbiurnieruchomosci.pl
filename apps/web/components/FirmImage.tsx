"use client";

import { useState } from "react";

/** Obrazek firmy ze strony (podgląd strony albo logo). Gdy go nie ma albo się nie wczyta, pokazujemy inicjały. */
export function FirmImage({
  src,
  name,
  size = "md",
  kind = null,
  alt,
}: {
  src: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  kind?: string | null;
  /** Opis obrazka, gdy jest treścią (np. logo na profilu). Bez niego obrazek jest ozdobny (obok jest nazwa firmy). */
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .replace(/["„”]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className={`firm-img ${size}${kind && kind !== "og" ? " logo" : ""}`} aria-hidden={alt && src && !failed ? undefined : true}>
      <span className="firm-img-fallback">{initials || "?"}</span>
      {src && !failed && kind === "og" && (
        // Rozmyta kopia wypełnia tło, a obrazek na wierzchu jest widoczny w całości (bez ucinania logo i napisów).
        // eslint-disable-next-line @next/next/no-img-element
        <img className="firm-img-backdrop" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" decoding="async" />
      )}
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="firm-img-front"
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
