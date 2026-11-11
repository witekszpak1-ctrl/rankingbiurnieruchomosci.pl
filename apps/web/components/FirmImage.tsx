"use client";

import { useState } from "react";

import { imageSrcSet, optimizedImage } from "@/lib/images";

/** Szerokość wyświetlania w CSS (px) dla rozmiarów miniatur; 2x dochodzi przez srcSet. */
const WIDTH: Record<"sm" | "md" | "lg", number> = { sm: 64, md: 128, lg: 640 };

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
  // Pierwszy błąd: próbujemy oryginału (gdyby serwis zmniejszający był niedostępny); drugi: inicjały.
  const [useOriginal, setUseOriginal] = useState(false);
  const width = WIDTH[size];
  const front = src ? (useOriginal ? src : optimizedImage(src, width)) : null;
  const frontSet = src && !useOriginal ? imageSrcSet(src, width) : undefined;
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
        <img className="firm-img-backdrop" src={useOriginal ? src : optimizedImage(src, 96, 50)} alt="" loading="lazy" referrerPolicy="no-referrer" decoding="async" />
      )}
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="firm-img-front"
          src={front ?? src}
          srcSet={frontSet}
          alt={alt ?? ""}
          loading="lazy"
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => (useOriginal ? setFailed(true) : setUseOriginal(true))}
        />
      )}
    </span>
  );
}
