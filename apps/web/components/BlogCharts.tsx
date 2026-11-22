/**
 * Wykresy do artykułów bloga: proste SVG renderowane na serwerze z danych katalogu (odświeżają się razem ze stroną).
 * Zasady (dataviz): słupki od zera, cienkie (najwyżej 24 px) z zaokrąglonym końcem; oceny jako kropki na osi, która
 * nie musi zaczynać się od zera; jedna seria bez legendy, dwie z legendą i etykietami; tekst zawsze w kolorach tekstu,
 * nie w kolorze serii. Kolory serii (niebieski, pomarańczowy) sprawdzone walidatorem palety na tle karty #fbfbf9.
 * Każdy wykres ma podpowiedź po najechaniu (element <title>) i rozwijaną tabelę z danymi.
 */

export type ChartRow = { label: string; value: number | null; note?: string };

const W = 680; // szerokość w jednostkach viewBox; SVG skaluje się do szerokości kolumny
const LABEL_W = 170;
const VALUE_W = 64;
const ROW_H = 30;
const BAR_H = 16;
const PAD_TOP = 8;

/** Prostokąt z zaokrąglonym tylko prawym końcem (koniec danych), kwadratowy przy osi. */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, w / 2, h / 2);
  if (w <= 0) return "";
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
}

function cut(label: string, max = 24): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function DataTable({ rows, valueHeader, format }: { rows: ChartRow[]; valueHeader: string; format: (v: number) => string }) {
  return (
    <details className="viz-data">
      <summary>Pokaż dane w tabeli</summary>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th />
              <th className="num">{valueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{r.value == null ? "-" : format(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Poziome słupki jednej serii (np. odsetek biur z cennikiem w miastach). Wartości od zera; `max` domyślnie
 * największa wartość. Etykieta wartości przy końcu słupka.
 */
export function BarList({
  title,
  caption,
  rows,
  format,
  max,
  valueHeader = "Wartość",
}: {
  title: string;
  caption?: string;
  rows: ChartRow[];
  format: (v: number) => string;
  max?: number;
  valueHeader?: string;
}) {
  const data = rows.filter((r) => r.value != null) as (ChartRow & { value: number })[];
  if (data.length === 0) return null;
  const top = max ?? Math.max(...data.map((r) => r.value), 0);
  const plotW = W - LABEL_W - VALUE_W;
  const h = PAD_TOP * 2 + data.length * ROW_H;
  const scale = (v: number) => (top > 0 ? (Math.max(0, v) / top) * plotW : 0);
  return (
    <figure className="viz">
      <figcaption className="viz-title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`${title}. ${data.map((r) => `${r.label}: ${format(r.value)}`).join(", ")}`}>
        <line x1={LABEL_W} x2={LABEL_W} y1={PAD_TOP / 2} y2={h - PAD_TOP / 2} className="viz-axis" />
        {data.map((r, i) => {
          const y = PAD_TOP + i * ROW_H;
          const bw = scale(r.value);
          return (
            <g key={r.label} className="viz-row">
              <title>{`${r.label}: ${format(r.value)}${r.note ? ` (${r.note})` : ""}`}</title>
              <rect x={0} y={y} width={W} height={ROW_H} className="viz-hit" />
              <text x={LABEL_W - 10} y={y + ROW_H / 2} className="viz-label" textAnchor="end" dominantBaseline="central">
                {cut(r.label)}
              </text>
              <path d={barPath(LABEL_W, y + (ROW_H - BAR_H) / 2, Math.max(bw, 2), BAR_H)} className="viz-bar s1" />
              <text x={LABEL_W + Math.max(bw, 2) + 8} y={y + ROW_H / 2} className="viz-value" dominantBaseline="central">
                {format(r.value)}
              </text>
            </g>
          );
        })}
      </svg>
      {caption && <p className="viz-caption">{caption}</p>}
      <DataTable rows={data} valueHeader={valueHeader} format={format} />
    </figure>
  );
}

/**
 * Kropki na wspólnej osi (np. średnia ocena Google w miastach). Oś nie zaczyna się od zera, bo kropka koduje
 * położenie, a nie długość; zakres [min, max] dobierany do danych z zaokrągleniem do `step`.
 */
export function DotPlot({
  title,
  caption,
  rows,
  format,
  step = 0.1,
  reference,
  valueHeader = "Wartość",
}: {
  title: string;
  caption?: string;
  rows: ChartRow[];
  format: (v: number) => string;
  step?: number;
  /** Pionowa linia odniesienia, np. średnia katalogu. */
  reference?: { value: number; label: string };
  valueHeader?: string;
}) {
  const data = rows.filter((r) => r.value != null) as (ChartRow & { value: number })[];
  if (data.length === 0) return null;
  const values = [...data.map((r) => r.value), ...(reference ? [reference.value] : [])];
  const lo = Math.floor(Math.min(...values) / step) * step;
  const hi = Math.ceil(Math.max(...values) / step) * step || lo + step;
  const span = hi - lo || step;
  const AXIS_H = 26;
  const plotW = W - LABEL_W - VALUE_W;
  const h = PAD_TOP + data.length * ROW_H + AXIS_H;
  const x = (v: number) => LABEL_W + ((v - lo) / span) * plotW;
  const ticks: number[] = [];
  const tickStep = span / step > 8 ? step * Math.ceil(span / step / 6) : step;
  for (let t = lo; t <= hi + 1e-9; t += tickStep) ticks.push(Math.round(t / step) * step);
  const plotBottom = PAD_TOP + data.length * ROW_H;
  return (
    <figure className="viz">
      <figcaption className="viz-title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`${title}. ${data.map((r) => `${r.label}: ${format(r.value)}`).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={PAD_TOP / 2} y2={plotBottom} className="viz-grid" />
            <text x={x(t)} y={plotBottom + 16} className="viz-tick" textAnchor="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {reference && (
          <g>
            <line x1={x(reference.value)} x2={x(reference.value)} y1={PAD_TOP / 2} y2={plotBottom} className="viz-ref" />
            <title>{`${reference.label}: ${format(reference.value)}`}</title>
          </g>
        )}
        {data.map((r, i) => {
          const y = PAD_TOP + i * ROW_H + ROW_H / 2;
          return (
            <g key={r.label} className="viz-row">
              <title>{`${r.label}: ${format(r.value)}${r.note ? ` (${r.note})` : ""}`}</title>
              <rect x={0} y={y - ROW_H / 2} width={W} height={ROW_H} className="viz-hit" />
              <text x={LABEL_W - 10} y={y} className="viz-label" textAnchor="end" dominantBaseline="central">
                {cut(r.label)}
              </text>
              <line x1={LABEL_W} x2={x(r.value)} y1={y} y2={y} className="viz-stem" />
              <circle cx={x(r.value)} cy={y} r={6} className="viz-dot s1" />
              <text x={W - VALUE_W + 12} y={y} className="viz-value" dominantBaseline="central">
                {format(r.value)}
              </text>
            </g>
          );
        })}
      </svg>
      {(caption || reference) && (
        <p className="viz-caption">
          {reference ? `Pionowa linia: ${reference.label} (${format(reference.value)}). ` : ""}
          {caption}
        </p>
      )}
      <DataTable rows={data} valueHeader={valueHeader} format={format} />
    </figure>
  );
}

/** Pionowe kolumny jednej serii (rozkład, np. liczba biur w przedziałach ocen). */
export function Columns({
  title,
  caption,
  rows,
  format,
  valueHeader = "Wartość",
}: {
  title: string;
  caption?: string;
  rows: ChartRow[];
  format: (v: number) => string;
  valueHeader?: string;
}) {
  const data = rows.filter((r) => r.value != null) as (ChartRow & { value: number })[];
  if (data.length === 0) return null;
  const H = 240;
  const top = Math.max(...data.map((r) => r.value), 0);
  const band = W / data.length;
  const colW = Math.min(48, band * 0.6);
  const base = H - 34;
  const plotH = base - 28;
  return (
    <figure className="viz">
      <figcaption className="viz-title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${data.map((r) => `${r.label}: ${format(r.value)}`).join(", ")}`}>
        <line x1={0} x2={W} y1={base} y2={base} className="viz-axis" />
        {data.map((r, i) => {
          const ch = top > 0 ? (r.value / top) * plotH : 0;
          const cx = i * band + band / 2;
          const x0 = cx - colW / 2;
          const y0 = base - ch;
          const rr = Math.min(4, colW / 2, ch / 2);
          const d =
            ch > 0
              ? `M${x0},${base} V${y0 + rr} Q${x0},${y0} ${x0 + rr},${y0} H${x0 + colW - rr} Q${x0 + colW},${y0} ${x0 + colW},${y0 + rr} V${base} Z`
              : "";
          return (
            <g key={r.label} className="viz-row">
              <title>{`${r.label}: ${format(r.value)}${r.note ? ` (${r.note})` : ""}`}</title>
              <rect x={i * band} y={0} width={band} height={H} className="viz-hit" />
              {d && <path d={d} className="viz-bar s1" />}
              <text x={cx} y={y0 - 8} className="viz-value" textAnchor="middle">
                {format(r.value)}
              </text>
              <text x={cx} y={base + 18} className="viz-tick" textAnchor="middle">
                {r.label}
              </text>
            </g>
          );
        })}
      </svg>
      {caption && <p className="viz-caption">{caption}</p>}
      <DataTable rows={data} valueHeader={valueHeader} format={format} />
    </figure>
  );
}

export type PairRow = { label: string; a: number | null; b: number | null };

/**
 * Dwie serie obok siebie (miasto A i miasto B) dla wskaźników w tej samej jednostce (procenty 0-100).
 * Legenda nad wykresem, wartość przy każdym słupku (tylko dwie serie, więc etykiety się nie tłoczą).
 */
export function PairBars({
  title,
  caption,
  nameA,
  nameB,
  rows,
  format,
  max = 100,
}: {
  title: string;
  caption?: string;
  nameA: string;
  nameB: string;
  rows: PairRow[];
  format: (v: number) => string;
  max?: number;
}) {
  const data = rows.filter((r) => r.a != null || r.b != null);
  if (data.length === 0) return null;
  const GROUP_H = 50;
  const PB = 14;
  const plotW = W - LABEL_W - VALUE_W;
  const h = PAD_TOP * 2 + data.length * GROUP_H;
  const scale = (v: number) => (Math.max(0, Math.min(v, max)) / max) * plotW;
  return (
    <figure className="viz">
      <figcaption className="viz-title">{title}</figcaption>
      <p className="viz-legend">
        <span className="viz-key s1" aria-hidden="true" /> {nameA}
        <span className="viz-key s2" aria-hidden="true" /> {nameB}
      </p>
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`${title}. ${data.map((r) => `${r.label}: ${nameA} ${r.a == null ? "brak danych" : format(r.a)}, ${nameB} ${r.b == null ? "brak danych" : format(r.b)}`).join("; ")}`}>
        <line x1={LABEL_W} x2={LABEL_W} y1={PAD_TOP / 2} y2={h - PAD_TOP / 2} className="viz-axis" />
        {data.map((r, i) => {
          const y = PAD_TOP + i * GROUP_H + 6;
          const bars = [
            { v: r.a, cls: "s1", name: nameA, dy: 0 },
            { v: r.b, cls: "s2", name: nameB, dy: PB + 2 },
          ];
          return (
            <g key={r.label} className="viz-row">
              <title>{`${r.label}: ${nameA} ${r.a == null ? "brak danych" : format(r.a)}, ${nameB} ${r.b == null ? "brak danych" : format(r.b)}`}</title>
              <rect x={0} y={y - 6} width={W} height={GROUP_H} className="viz-hit" />
              <text x={LABEL_W - 10} y={y + PB} className="viz-label" textAnchor="end" dominantBaseline="central">
                {cut(r.label)}
              </text>
              {bars.map((b) => (
                <g key={b.cls}>
                  {b.v != null && <path d={barPath(LABEL_W, y + b.dy, Math.max(scale(b.v), 2), PB)} className={`viz-bar ${b.cls}`} />}
                  <text x={LABEL_W + (b.v != null ? Math.max(scale(b.v), 2) : 0) + 8} y={y + b.dy + PB / 2} className="viz-value" dominantBaseline="central">
                    {b.v == null ? "brak danych" : format(b.v)}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      {caption && <p className="viz-caption">{caption}</p>}
      <details className="viz-data">
        <summary>Pokaż dane w tabeli</summary>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th />
                <th className="num">{nameA}</th>
                <th className="num">{nameB}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="num">{r.a == null ? "-" : format(r.a)}</td>
                  <td className="num">{r.b == null ? "-" : format(r.b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
