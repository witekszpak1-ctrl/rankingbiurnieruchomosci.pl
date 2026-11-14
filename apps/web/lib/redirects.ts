/**
 * Przekierowania z rozwiązanymi łańcuchami: gdy wpis docelowy został później wycofany i sam ma przekierowanie
 * (np. /kluczbork/strona-glowna -> /kluczbork/murzynski-nieruchomosci, a ten wpis przeniesiono do Warszawy),
 * stary adres prowadzi od razu do żywego profilu. Przekierowania kończące się na wycofanym wpisie pomijamy.
 */
export function resolveRedirects(rows: { from: string; to: string; published: boolean }[]): Record<string, string> {
  const byFrom = new Map(rows.map((r) => [r.from, r]));
  const map: Record<string, string> = {};
  for (const r of rows) {
    let to = r.to;
    let published = r.published;
    for (let hops = 0; !published && hops < 5; hops++) {
      const next = byFrom.get(to);
      if (!next) break;
      to = next.to;
      published = next.published;
    }
    if (published && r.from !== to) map[r.from] = to;
  }
  return map;
}
