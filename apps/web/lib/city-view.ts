/**
 * Widok strony miasta zapisany w adresie: cel klienta (?cel=), filtry (?filtr=) i numer strony (?strona=).
 * Strony z filtrami mają noindex i canonical na stronę miasta, kolejne strony listy własny canonical.
 */
export type SearchParams = Record<string, string | string[] | undefined>;

export const PER_PAGE = 20;
// Cel klienta filtruje biura po deklarowanych usługach (grupy z lib/city-content.ts).
export const GOALS = {
  sprzedaz: { label: "Chcę sprzedać", group: "sale" },
  kupno: { label: "Chcę kupić", group: "sale" },
  wynajem: { label: "Chcę wynająć", group: "rent" },
} as const;
export const FILTERS = {
  zarzadzanie: { label: "Zarządzanie najmem", group: "management" },
  cennik: { label: "Jawny cennik", group: null },
} as const;
export type Goal = keyof typeof GOALS;
export type Filter = keyof typeof FILTERS;
export type View = { page: number; goal: Goal | null; filters: Filter[] };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseView(sp: SearchParams): View {
  const page = Math.max(1, Number.parseInt(first(sp.strona) ?? "1", 10) || 1);
  const goal = (Object.keys(GOALS) as Goal[]).find((g) => g === first(sp.cel)) ?? null;
  const raw = ([] as string[]).concat(sp.filtr ?? []);
  const filters = (Object.keys(FILTERS) as Filter[]).filter((f) => raw.includes(f));
  return { page, goal, filters };
}

/** Adres widoku strony miasta; parametry zawsze w tej samej kolejności (cel, filtr, strona). */
export function viewHref(slug: string, v: View): string {
  const q = new URLSearchParams();
  if (v.goal) q.set("cel", v.goal);
  for (const f of v.filters) q.append("filtr", f);
  if (v.page > 1) q.set("strona", String(v.page));
  const qs = q.toString();
  return qs ? `/${slug}?${qs}` : `/${slug}`;
}
