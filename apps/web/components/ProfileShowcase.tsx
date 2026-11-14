"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Stars } from "@/components/Stars";
import { optimizedImage } from "@/lib/images";
import { plural } from "@/lib/plural";

/** Biuro pokazywane w animowanym profilu na stronie głównej (prawdziwe dane z katalogu). */
export type ShowcaseFirm = {
  key: string;
  href: string;
  name: string;
  host: string | null;
  cityName: string;
  score: number;
  googleRating: number | null;
  googleCount: number | null;
  offersCount: number;
  sinceYear: number | null;
  registryConfirmed: boolean;
  hasPublicPrices: boolean;
  servicesCount: number;
  logoUrl: string | null;
  coverUrl: string | null;
};

const CYCLE_MS = 5600;

function initials(name: string): string {
  return name
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function opinie(n: number): string {
  if (n === 1) return "opinia";
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? "opinie" : "opinii";
}

/**
 * Animowany profil biura: karta z wynikiem w rankingu (licznik), oceną Google i kursorem, który "klika" przycisk.
 * Co kilka sekund kolejne biuro z czołówki. Zatrzymuje się po najechaniu, a przy ograniczeniu ruchu stoi w miejscu.
 */
export function ProfileShowcase({ firms }: { firms: ShowcaseFirm[] }) {
  const [idx, setIdx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [shown, setShown] = useState(firms[0]?.score ?? 0);
  const reduced = useRef(true);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Licznik wyniku od zera do wyniku biura.
  useEffect(() => {
    const target = firms[idx]?.score ?? 0;
    if (reduced.current) {
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1000);
      setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setShown(0);
    const start = setTimeout(() => (raf = requestAnimationFrame(step)), 350);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, [idx, firms]);

  // Kolejne biuro co kilka sekund.
  useEffect(() => {
    if (paused || firms.length < 2 || reduced.current) return;
    const leave = setTimeout(() => setLeaving(true), CYCLE_MS - 400);
    const next = setTimeout(() => {
      setIdx((i) => (i + 1) % firms.length);
      setLeaving(false);
    }, CYCLE_MS);
    return () => {
      clearTimeout(leave);
      clearTimeout(next);
    };
  }, [idx, paused, firms.length]);

  const f = firms[idx];
  if (!f) return null;
  const hue = [...f.name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

  return (
    <div
      className="showcase"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {firms.length > 1 && (
        <div className="showcase-dots">
          {firms.map((x, i) => (
            <button
              key={x.key}
              type="button"
              className={i === idx ? "on" : undefined}
              aria-label={`Pokaż profil: ${x.name}`}
              aria-pressed={i === idx}
              onClick={() => {
                setLeaving(false);
                setIdx(i);
              }}
            />
          ))}
        </div>
      )}
      <div className="showcase-ghost g2" aria-hidden="true" />
      <div className="showcase-ghost g1" aria-hidden="true" />
      <article key={f.key} className={`showcase-card${leaving ? " leave" : ""}`} aria-label={`Przykładowy profil: ${f.name}`}>
        <div className="sc-cover" style={{ ["--hue" as string]: hue }}>
          {f.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={optimizedImage(f.coverUrl, 420)} alt="" loading="lazy" referrerPolicy="no-referrer" decoding="async" />
          )}
          {f.registryConfirmed && <span className="sc-krs">✓ Potwierdzone w rejestrze</span>}
        </div>
        <div className="sc-body">
          <div className="sc-head sc-in" style={{ ["--i" as string]: 0 }}>
            <span className="sc-avatar">
              {f.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={optimizedImage(f.logoUrl, 136)} alt="" loading="lazy" referrerPolicy="no-referrer" decoding="async" />
              ) : (
                initials(f.name)
              )}
            </span>
            <div>
              <h3>{f.name}</h3>
              <p>
                {f.host ? `${f.host} · ` : ""}
                {f.cityName}
              </p>
            </div>
          </div>
          <div className="sc-score sc-in" style={{ ["--i" as string]: 1 }}>
            <b>
              {shown}
              <small>/100</small>
            </b>
            <div>
              <span className="sc-label">Wynik w rankingu</span>
              <span className="sc-bar" aria-hidden="true">
                <span style={{ width: `${shown}%` }} />
              </span>
              {f.googleRating != null && f.googleCount ? (
                <span className="sc-google">
                  <Stars value={f.googleRating} size={14} /> {f.googleRating.toFixed(1).replace(".", ",")} · {f.googleCount}{" "}
                  {opinie(f.googleCount)} w Google
                </span>
              ) : null}
            </div>
          </div>
          <ul className="sc-chips sc-in" style={{ ["--i" as string]: 2 }}>
            {f.sinceYear && <li className="y">Od {f.sinceYear} r.</li>}
            {f.offersCount > 0 && <li>{f.offersCount} {plural(f.offersCount, "aktualna oferta", "aktualne oferty", "aktualnych ofert")}</li>}
            {f.hasPublicPrices && <li className="ok">Jawny cennik</li>}
            {f.servicesCount > 0 && <li>{f.servicesCount} {plural(f.servicesCount, "usługa", "usługi", "usług")}</li>}
          </ul>
          <Link className="sc-cta sc-in" style={{ ["--i" as string]: 3 }} href={f.href}>
            Zobacz profil biura <span aria-hidden="true">→</span>
          </Link>
        </div>
        <svg className="sc-cursor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.7 L11.6 14 L18 14 Z"
            fill="#fff"
            stroke="#121211"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </article>
    </div>
  );
}
