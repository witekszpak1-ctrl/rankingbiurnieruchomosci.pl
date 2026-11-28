/** Pomocnicze funkcje wykresów SVG (bez bibliotek): geometria łuków, skala osi, krótkie daty. */

export function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Ścieżka łuku okręgu od kąta a do b (stopnie, 0 = góra, zgodnie z ruchem wskazówek zegara). */
export function arcPath(cx: number, cy: number, r: number, a: number, b: number): string {
  const start = polar(cx, cy, r, a);
  const end = polar(cx, cy, r, b);
  const large = Math.abs(b - a) > 180 ? 1 : 0;
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M ${f(start.x)} ${f(start.y)} A ${r} ${r} 0 ${large} 1 ${f(end.x)} ${f(end.y)}`;
}

/** Górna granica osi: najbliższa "ładna" wartość (1, 2, 2,5, 5 x 10^n) nie mniejsza niż max. Dla max <= 0 zwraca 1. */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (max <= m * base + 1e-9) return m * base;
  }
  return 10 * base;
}

/** Podziałki osi od 0 do max w `count` równych krokach (count + 1 wartości). */
export function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max * i) / count);
}

export type Axis = { max: number; ticks: number[] };

/** Oś dla wskaźników 0-1 (procenty): górna granica 20%, 40%, 50% albo 100% z równymi, okrągłymi podziałkami. */
export function rateAxis(maxValue: number): Axis {
  const steps: [number, number][] = [
    [0.2, 4],
    [0.4, 4],
    [0.5, 5],
    [1, 4],
  ];
  const [max, n] = steps.find(([m]) => maxValue <= m + 1e-9) ?? [1, 4];
  return { max, ticks: Array.from({ length: n + 1 }, (_, i) => Math.round((max * i * 1e6) / n) / 1e6) };
}

/** Oś dla liczb całkowitych: "ładna" górna granica i podziałki będące liczbami całkowitymi (o ile się da). */
export function countAxis(maxValue: number): Axis {
  const max = Math.max(1, niceMax(maxValue));
  const n = [4, 5, 2, 3, 1].find((c) => Number.isInteger(max / c)) ?? 1;
  return { max, ticks: Array.from({ length: n + 1 }, (_, i) => (max * i) / n) };
}

const MONTHS =["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/** "2026-11-23" albo ISO -> "23 lis" (UTC). */
export function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Poniedziałek (UTC, 00:00) tygodnia, w którym leży data, jako "RRRR-MM-DD". */
export function weekStartUtc(d: Date): string {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = (new Date(t).getUTCDay() + 6) % 7; // poniedziałek = 0
  return new Date(t - dow * 86400000).toISOString().slice(0, 10);
}

/** Liczba z separatorem tysięcy (spacja niełamliwa). */
export function formatInt(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Ułamek (0-1) jako procent w polskim zapisie, np. 0,254 -> "25%" (digits = 0) albo "25,4%" (digits = 1). */
export function formatPct(x: number, digits = 0): string {
  const v = Math.round(x * 100 * 10 ** digits) / 10 ** digits;
  return `${v.toString().replace(".", ",")}%`;
}
