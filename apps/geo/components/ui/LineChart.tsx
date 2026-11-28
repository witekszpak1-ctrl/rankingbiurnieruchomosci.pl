"use client";

import { useEffect, useId, useRef, useState } from "react";

import { countAxis, rateAxis, shortDate } from "@/lib/chart";

export type LinePoint = {
  /** Data "RRRR-MM-DD" (UTC); położenie na osi X wynika z daty, więc przerwy między pomiarami są widoczne. */
  date: string;
  value: number;
  /** Mała próba: punkt rysowany jako pusty okrąg. */
  hollow?: boolean;
  /** Opis do podpowiedzi (title) i czytników ekranu. */
  title?: string;
};

type Props = {
  points: LinePoint[];
  /** "pct": wartości 0-1 jako procenty; "int": liczby całkowite. */
  format?: "pct" | "int";
  height?: number;
  ariaLabel: string;
  /** Opis osi Y (nad wykresem). */
  yLabel?: string;
};

const PAD = { top: 14, right: 18, bottom: 30, left: 44 };

/**
 * Wykres liniowy w SVG (bez bibliotek), dopasowany do szerokości kontenera: rysujemy w pikselach, więc podpisy osi
 * mają stały rozmiar także na telefonie. Przed pomiarem szerokości (SSR) używamy szerokości domyślnej.
 */
export function LineChart({ points, format = "int", height = 240, ariaLabel, yLabel }: Props) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const times = points.map((p) => Date.parse(`${p.date}T00:00:00Z`));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const rawMax = Math.max(...points.map((p) => p.value), 0);
  const axis = format === "pct" ? rateAxis(rawMax) : countAxis(rawMax);
  const yMax = axis.max;
  const iw = w - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + (t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw);
  const y = (v: number) => PAD.top + ih - (v / yMax) * ih;
  const xy = points.map((p, i) => [x(times[i]), y(p.value)] as const);
  const line = xy.map(([a, b], i) => `${i ? "L" : "M"} ${a.toFixed(1)} ${b.toFixed(1)}`).join(" ");
  const area = `${line} L ${xy[xy.length - 1][0].toFixed(1)} ${PAD.top + ih} L ${xy[0][0].toFixed(1)} ${PAD.top + ih} Z`;
  const yTicks = axis.ticks;
  const fmtY = (v: number) => (format === "pct" ? `${Math.round(v * 100)}%` : String(Math.round(v * 10) / 10).replace(".", ","));

  // Podpisy osi X: pomijamy te, które by na siebie nachodziły.
  const labelW = 46;
  let lastX = -Infinity;
  const xLabels = xy
    .map(([px], i) => ({ px, text: shortDate(points[i].date), i }))
    .filter((l) => {
      if (l.px - lastX >= labelW) {
        lastX = l.px;
        return true;
      }
      return false;
    });

  return (
    <div className="chart" ref={ref}>
      {yLabel ? <div className="note" style={{ margin: "0 0 4px 0" }}>{yLabel}</div> : null}
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tv) => (
          <g key={tv}>
            <line className={tv === 0 ? "axis-line" : "grid-line"} x1={PAD.left} x2={w - PAD.right} y1={y(tv)} y2={y(tv)} />
            <text x={PAD.left - 8} y={y(tv) + 4} textAnchor="end">
              {fmtY(tv)}
            </text>
          </g>
        ))}
        {xy.length > 1 ? <path d={area} fill={`url(#area-${uid})`} /> : null}
        {xy.length > 1 ? <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {xy.map(([px, py], i) => (
          <circle
            key={points[i].date}
            cx={px}
            cy={py}
            r={xy.length > 40 ? 0 : xy.length > 14 ? 3 : 5}
            fill={points[i].hollow ? "var(--surface)" : "var(--brand)"}
            stroke="var(--brand)"
            strokeWidth="2.5"
          >
            <title>{points[i].title ?? `${shortDate(points[i].date)}: ${fmtY(points[i].value)}`}</title>
          </circle>
        ))}
        {xLabels.map((l) => (
          <text key={l.i} x={l.px} y={height - 8} textAnchor={l.px < PAD.left + 14 ? "start" : l.px > w - PAD.right - 14 ? "end" : "middle"}>
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
