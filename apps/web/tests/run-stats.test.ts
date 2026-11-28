import { describe, expect, it } from "vitest";

import { runStats, sumOf } from "@/lib/run-stats";

describe("statystyki przebiegu", () => {
  it("dzieli liczby na znalezione, pominięte i błędy", () => {
    const st = runStats({ ok: 28, firms: 30, reviews: 401, not_found: 2, litescrape_calls: 55 });
    expect(st.done).toEqual([{ label: "opinii pobranych", n: 401 }, { label: "firm z oceną z Map Google", n: 28 }]);
    expect(st.missed).toEqual([{ label: "firm bez profilu w Mapach", n: 2 }]);
    expect(st.errors).toEqual([]);
    expect(st.calls).toBe(55);
  });

  it("rozpoznaje klucze z przedrostkiem i nie gubi nieznanych", () => {
    const st = runStats({ pages: 8, skipped_robots: 2, refetch_failed_http_404: 1, nowy_klucz: 3, zero: 0, file: "x.json" });
    expect(st.missed[0].label).toBe("podstron pominiętych (robots)");
    expect(st.errors[0].label).toBe("stron niepobranych ponownie (http 404)");
    expect(st.other).toEqual([{ label: "nowy klucz", n: 3 }]);
    expect(sumOf(st.done)).toBe(8);
  });
});
