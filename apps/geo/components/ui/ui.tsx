import Link from "next/link";
import { useId, type ReactNode } from "react";

import { arcPath, polar } from "@/lib/chart";
import { SCORE_BANDS, scoreBand, type ScoreBand, type Tone } from "@/lib/score";

import { Icon, type IconName } from "./Icon";

/** Komponenty systemu wyglądu GeoTrace (serwerowe, bez bibliotek wykresów). Opis: docs/geo/wyglad.md */

// ===== Pill =====

export function Pill({ tone = "brand", outline, lg, dot, children, title }: { tone?: Tone | "brand"; outline?: boolean; lg?: boolean; dot?: boolean; children: ReactNode; title?: string }) {
  const cls = ["pill", tone !== "brand" ? `t-${tone}` : "", outline ? "outline" : "", lg ? "lg" : ""].filter(Boolean).join(" ");
  return (
    <span className={cls} title={title}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}

// ===== Card =====

export function Card({
  title,
  sub,
  actions,
  children,
  className,
  flush,
  id,
  footer,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Bez wcięć w treści (tabele na całą szerokość karty). */
  flush?: boolean;
  id?: string;
  footer?: ReactNode;
}) {
  return (
    <section className={["card", flush ? "flush" : "", className ?? ""].filter(Boolean).join(" ")} id={id}>
      {title || actions ? (
        <header className="card-h">
          <div>
            {title ? <h3>{title}</h3> : null}
            {sub ? <p className="sub">{sub}</p> : null}
          </div>
          {actions ? <div className="card-act">{actions}</div> : null}
        </header>
      ) : null}
      <div className="card-b">{children}</div>
      {footer}
    </section>
  );
}

// ===== PageHeader =====

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-h">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {actions ? <div className="card-act">{actions}</div> : null}
    </div>
  );
}

// ===== StatTile =====

export function StatTile({
  label,
  value,
  unit,
  note,
  icon,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  icon?: IconName;
  tone?: "good" | "warn" | "bad" | "accent";
  href?: string;
}) {
  const body = (
    <>
      <div className="t-top">
        <span>{label}</span>
        {icon ? (
          <span className={`t-ic ${tone ?? ""}`}>
            <Icon name={icon} size={16} />
          </span>
        ) : null}
      </div>
      <div className="t-val">
        {value}
        {unit ? <small> {unit}</small> : null}
      </div>
      {note ? <div className="t-note">{note}</div> : null}
    </>
  );
  return href ? (
    <Link href={href} className="card tile t-link" style={{ textDecoration: "none", color: "inherit" }}>
      {body}
    </Link>
  ) : (
    <div className="card tile">{body}</div>
  );
}

// ===== SegmentedControl (linki z parametrem adresu) =====

export function Segmented({ items, label }: { items: { label: string; href: string; active: boolean }[]; label: string }) {
  return (
    <nav className="seg" aria-label={label}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} scroll={false} aria-current={i.active ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

// ===== DataTable =====

export type Column<T> = { header: ReactNode; cell: (row: T, index: number) => ReactNode; num?: boolean };

export function DataTable<T>({ columns, rows, rowKey, empty, rowClass }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T, index: number) => string; empty?: ReactNode; rowClass?: (row: T) => string | undefined }) {
  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={c.num ? "num" : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, ri) => (
              <tr key={rowKey(r, ri)} className={rowClass?.(r)}>
                {columns.map((c, i) => (
                  <td key={i} className={c.num ? "num" : undefined}>
                    {c.cell(r, ri)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="muted">
                {empty ?? "Brak danych."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ===== BarList =====

export type BarItem = { key: string; label: ReactNode; sub?: ReactNode; valueText: ReactNode; ratio: number; badge?: ReactNode; highlight?: boolean };

export function BarList({ items, ranked, empty }: { items: BarItem[]; ranked?: boolean; empty?: ReactNode }) {
  if (!items.length) return <p className="muted small">{empty ?? "Brak danych."}</p>;
  return (
    <ul className="barlist">
      {items.map((it, i) => (
        <li key={it.key} className={`bl-row${it.highlight ? " hl" : ""}`}>
          <div className="bl-top">
            <span className="bl-label">
              {ranked ? <span className="bl-rank">{i + 1}</span> : null}
              <span>
                {it.label}
                {it.sub ? <span className="bl-sub"> {it.sub}</span> : null}
              </span>
              {it.badge}
            </span>
            <span className="bl-val">{it.valueText}</span>
          </div>
          <div className="bl-track" role="presentation">
            <div className="bl-fill" style={{ width: `${Math.max(0, Math.min(1, it.ratio)) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ===== EmptyState =====

export function EmptyState({ icon = "info", title, children, action }: { icon?: IconName; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="e-ic">
        <Icon name={icon} size={22} />
      </span>
      <h4>{title}</h4>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

// ===== Checklist (kółka jak w onboardingu) =====

export type CheckItem = { key: string; title: ReactNode; hint?: ReactNode; done?: boolean; href?: string; action?: string; tone?: Tone; icon?: IconName };

export function Checklist({ items, mode = "steps" }: { items: CheckItem[]; mode?: "steps" | "attention" }) {
  return (
    <ul className="checklist">
      {items.map((it) => (
        <li key={it.key} className={`cl-item${it.done ? " done" : ""}`}>
          {mode === "steps" ? (
            <span className="cl-radio" aria-label={it.done ? "zrobione" : "do zrobienia"}>
              {it.done ? <Icon name="check" size={14} strokeWidth={3} /> : null}
            </span>
          ) : (
            <span className={`cl-ic ${it.tone ?? "neutral"}`}>
              <Icon name={it.icon ?? (it.tone === "bad" || it.tone === "warn" ? "alert" : "info")} size={20} />
            </span>
          )}
          <div className="cl-body">
            <div className="cl-title">{it.title}</div>
            {it.hint ? <div className="cl-hint">{it.hint}</div> : null}
          </div>
          {it.href && it.action ? (
            <Link className="cl-act" href={it.href}>
              {it.action}
              <Icon name="arrow" size={14} />
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ===== Gauge (wskaźnik pierścieniowy 0-100) =====

const GAUGE_START = -135;
const GAUGE_SWEEP = 270;
const toneVar: Record<Tone, string> = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)", neutral: "var(--muted)" };

export function Gauge({
  value,
  bands = SCORE_BANDS,
  size = "md",
  emptyLabel = "za mało danych",
  legend = true,
}: {
  value: number | null;
  bands?: readonly ScoreBand[];
  size?: "md" | "sm";
  emptyLabel?: string;
  legend?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const cx = 100;
  const cy = 100;
  const r = 80;
  const sw = 16;
  const angle = (v: number) => GAUGE_START + (GAUGE_SWEEP * v) / 100;
  const band = scoreBand(value);
  const v = value === null ? null : Math.max(0, Math.min(100, Math.round(value)));
  const color = band ? toneVar[band.tone] : "var(--muted)";
  const end = v === null ? null : polar(cx, cy, r, angle(v));
  return (
    <div className={`gauge ${size}`}>
      <div className="gauge-box">
        <svg viewBox="0 0 200 200" role="img" aria-label={v === null ? `Wynik: ${emptyLabel}` : `Wynik ${v} na 100, ${band?.label ?? ""}`}>
          <defs>
            <pattern id={`stripe-${uid}`} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
              <rect width="3.5" height="7" fill="var(--line-strong)" />
            </pattern>
          </defs>
          {v === null ? (
            <path d={arcPath(cx, cy, r, angle(0), angle(100))} fill="none" stroke={`url(#stripe-${uid})`} strokeWidth={sw} strokeLinecap="butt" opacity="0.9" />
          ) : (
            bands.map((b) => (
              <path
                key={b.key}
                d={arcPath(cx, cy, r, angle(b.from) + (b.from === 0 ? 0 : 1.2), angle(b.to === 100 ? 100 : b.to + 1) - (b.to === 100 ? 0 : 1.2))}
                fill="none"
                stroke={toneVar[b.tone]}
                strokeWidth={sw}
                strokeLinecap="butt"
                opacity="0.2"
              />
            ))
          )}
          {v !== null && v > 0 ? <path d={arcPath(cx, cy, r, angle(0), angle(v))} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" /> : null}
          {end ? <circle cx={end.x} cy={end.y} r={6.5} fill="var(--surface)" stroke={color} strokeWidth={3.5} /> : null}
        </svg>
        <div className="gauge-mid">
          {v === null ? (
            <div className="gauge-empty">{emptyLabel}</div>
          ) : (
            <>
              <div className="gauge-num">
                {v}
                <small>/100</small>
              </div>
              {band ? (
                <Pill tone={band.tone} lg={size === "md"} dot>
                  {band.label}
                </Pill>
              ) : null}
            </>
          )}
        </div>
      </div>
      {legend ? (
        <div className="gauge-legend">
          {bands.map((b) => (
            <Pill key={b.key} tone={b.tone} outline>
              {b.label} {b.from}-{b.to}
            </Pill>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ===== Donut (podział na kategorie) =====

export type DonutSegment = { label: string; value: number; color?: string };
const CAT_COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];

export function Donut({ segments, centerLabel, centerValue, formatValue = (n) => String(n) }: { segments: DonutSegment[]; centerLabel?: string; centerValue?: ReactNode; formatValue?: (n: number) => string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 58;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <div className="donut-box">
        <svg viewBox="0 0 150 150" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
          <circle cx="75" cy="75" r={r} fill="none" stroke="var(--sunken)" strokeWidth="16" />
          {total > 0
            ? segments.map((s, i) => {
                const len = (s.value / total) * C;
                const gap = segments.length > 1 && len > 3 ? 2 : 0;
                const el = (
                  <circle
                    key={s.label}
                    cx="75"
                    cy="75"
                    r={r}
                    fill="none"
                    stroke={s.color ?? CAT_COLORS[i % CAT_COLORS.length]}
                    strokeWidth="16"
                    strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 75 75)"
                  />
                );
                offset += len;
                return el;
              })
            : null}
        </svg>
        <div className="donut-mid">
          <b>{centerValue ?? total}</b>
          {centerLabel ? <span>{centerLabel}</span> : null}
        </div>
      </div>
      <div className="donut-legend">
        {segments.map((s, i) => (
          <div key={s.label}>
            <i style={{ background: s.color ?? CAT_COLORS[i % CAT_COLORS.length] }} />
            <span>{s.label}</span>
            <b>{formatValue(s.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Sparkline =====

export function Sparkline({ values, width = 120, height = 32, label }: { values: number[]; width?: number; height?: number; label?: string }) {
  const uid = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const max = Math.max(...values, 1e-9);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => [pad + (i * (width - 2 * pad)) / (values.length - 1), height - pad - ((v - min) / span) * (height - 2 * pad)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? "wykres trendu"}>
      <defs>
        <linearGradient id={`sp-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.3" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${pts[pts.length - 1][0].toFixed(1)} ${height} L ${pts[0][0].toFixed(1)} ${height} Z`} fill={`url(#sp-${uid})`} />
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
