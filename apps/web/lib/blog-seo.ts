/**
 * Ocena SEO wpisu bloga w panelu (/admin/blog) liczona z gotowego HTML strony (tak, jak widzi ją wyszukiwarka).
 * Wynik 0-100 to suma punktów za konkretne kryteria; każde niespełnione kryterium trafia na listę uwag.
 * Progi długości są w instrukcji bloga (docs/blog.md). Testy: tests/blog-seo.test.ts.
 */

export type SeoCheck = { key: string; label: string; points: number; max: number; ok: boolean; detail: string };
export type SeoReport = {
  score: number;
  words: number;
  targetWords: number;
  title: string;
  description: string;
  checks: SeoCheck[];
};

/** Docelowa liczba słów treści artykułu według kategorii (instrukcja bloga). */
export const TARGET_WORDS: Record<string, number> = { Poradnik: 1800, Dane: 1300, "Porównania": 1300, "Porównanie miast": 900 };

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const strip = (html: string) =>
  decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<details class="viz-data"[\s\S]*?<\/details>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

/** Liczba słów (ciągi liter lub cyfr; liczby z przecinkiem liczą się jako jedno słowo). */
export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N},.%-]*/gu) ?? []).length;
}

function meta(html: string, name: string): string {
  const re = new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]*content="([^"]*)"`, "i");
  const re2 = new RegExp(`<meta[^>]+content="([^"]*)"[^>]*(?:name|property)="${name}"`, "i");
  return decode(html.match(re)?.[1] ?? html.match(re2)?.[1] ?? "");
}

const norm = (s: string) => s.toLocaleLowerCase("pl-PL");

export function analyzeBlogHtml(html: string, opts: { keyword?: string; category: string; path: string }): SeoReport {
  const article = html.match(/<article[^>]*class="blog-article"[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? "";
  const text = strip(article);
  const words = countWords(text);
  const targetWords = TARGET_WORDS[opts.category] ?? 1300;
  const title = decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const description = meta(html, "description");
  const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
  const h2 = (article.match(/<h2[\s>]/gi) ?? []).length;
  const links = [...article.matchAll(/<a[^>]+href="([^"]+)"/gi)].map((m) => m[1]);
  const internal = new Set(links.filter((h) => h.startsWith("/") && !h.startsWith("//") && h !== opts.path));
  const figures = (article.match(/<figure class="viz"/gi) ?? []).length;
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imgsNoAlt = imgs.filter((t) => !/\balt="[^"]*"/i.test(t)).length;
  const ogImage = meta(html, "og:image");
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ?? "";
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const ldTypes = ld.flatMap((j) => {
    try {
      const v = JSON.parse(j);
      return [v["@type"]].flat().filter(Boolean) as string[];
    } catch {
      return ["BŁĄD"];
    }
  });
  const kw = opts.keyword ? norm(opts.keyword) : null;
  const firstPara = strip(article.match(/<div class="answer">([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const longDash = /[–—]/.test(text);

  const checks: SeoCheck[] = [];
  const add = (key: string, label: string, max: number, ok: boolean | number, detail: string) => {
    const ratio = typeof ok === "number" ? Math.max(0, Math.min(1, ok)) : ok ? 1 : 0;
    checks.push({ key, label, max, points: Math.round(max * ratio), ok: ratio >= 1, detail });
  };
  add("words", "Długość treści", 25, words / targetWords, `${words} słów, cel ${targetWords}`);
  add("title", "Tytuł 30-65 znaków", 8, title.length >= 30 && title.length <= 65, `${title.length} znaków`);
  add("description", "Opis meta 70-160 znaków, bez urwania", 8, description.length >= 70 && description.length <= 160 && !description.endsWith("…"), `${description.length} znaków`);
  add("h1", "Dokładnie jeden nagłówek h1", 4, h1 === 1, `${h1}`);
  add("h2", "Co najmniej 6 sekcji h2", 8, h2 / 6, `${h2} sekcji`);
  add("links", "Co najmniej 6 linków wewnętrznych", 10, internal.size / 6, `${internal.size} różnych linków`);
  add("charts", "Co najmniej 2 wykresy z danych", 8, figures / 2, `${figures} wykresów`);
  add("cover", "Własna okładka (og:image)", 6, /\/blog\/okladka\//.test(ogImage), ogImage ? "jest" : "brak");
  add("alt", "Obrazy z tekstem alternatywnym", 3, imgsNoAlt === 0, imgsNoAlt ? `${imgsNoAlt} bez alt` : "wszystkie mają alt");
  add("canonical", "Adres kanoniczny", 4, canonical.endsWith(opts.path), canonical || "brak");
  add("article", "Dane strukturalne Article", 4, ldTypes.includes("Article"), ldTypes.join(", ") || "brak");
  add("faq", "Pytania i odpowiedzi (FAQPage)", 4, ldTypes.includes("FAQPage"), ldTypes.includes("FAQPage") ? "jest" : "brak");
  if (kw) {
    const places = [norm(title).includes(kw), norm(description).includes(kw), norm(firstPara).includes(kw)];
    add("keyword", `Fraza „${opts.keyword}” w tytule, opisie i wstępie`, 6, places.filter(Boolean).length / 3, `${places.filter(Boolean).length} z 3 miejsc`);
  }
  add("dash", "Bez długich myślników", 2, !longDash, longDash ? "w tekście jest — lub –" : "ok");
  const max = checks.reduce((s, c) => s + c.max, 0);
  const score = Math.round((100 * checks.reduce((s, c) => s + c.points, 0)) / max);
  return { score, words, targetWords, title, description, checks };
}
