import Link from "next/link";

import { FirmImage } from "@/components/FirmImage";

export type TopFirm = {
  key: string;
  href: string | null;
  name: string;
  score: number;
  position: number;
  logoUrl: string | null;
  /** Dodatkowa linia pod nazwą, np. miasto w rankingu ogólnopolskim. */
  sub?: string;
};

const MEDAL = ["1. miejsce", "2. miejsce", "3. miejsce"];

/** Trzy najwyżej ocenione biura jako karty (podium). Tekstowe podsumowanie zostaje obok dla czytelników i botów AI. */
export function TopThree({ firms }: { firms: TopFirm[] }) {
  return (
    <ol className="top3">
      {firms.map((f) => {
        const body = (
          <>
            <span className={`top3-rank r${f.position}`}>{MEDAL[f.position - 1] ?? `${f.position}. miejsce`}</span>
            <FirmImage src={f.logoUrl} kind="logo" name={f.name} alt={`Logo ${f.name}`} size="sm" />
            <b className="top3-name">{f.name}</b>
            {f.sub && <span className="top3-sub">{f.sub}</span>}
            <span className="top3-score">
              <span className="bar-track" aria-hidden="true">
                <span className="bar" style={{ width: `${f.score}%` }} />
              </span>
              <b>{f.score}</b>/100
            </span>
          </>
        );
        return (
          <li key={f.key}>
            {f.href ? (
              <Link href={f.href} className="top3-card">
                {body}
              </Link>
            ) : (
              <div className="top3-card">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
