import Link from "next/link";
import { headers } from "next/headers";

import { blogAction } from "../../actions";
import { BLOG_POSTS, blogPath, getPost } from "@/lib/blog";
import { getBlogOverrides, withOverride } from "@/lib/blog-overrides";
import { analyzeBlogHtml, type SeoReport } from "@/lib/blog-seo";
import { cityPairs, loadBlogData } from "@/lib/blog-stats";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

type Row = {
  key: string;
  path: string;
  title: string;
  category: string;
  keyword?: string;
  published: string;
  codePublished: string;
  modified: string;
  hidden: boolean;
  dateOverridden: boolean;
  report: SeoReport | null;
  error: string | null;
};

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.SITE_URL ?? "https://rankingbiurnieruchomosci.pl");
}

/** Pobiera gotową stronę wpisu i liczy długość oraz ocenę SEO (ukryte wpisy zwracają 404, więc ich nie oceniamy). */
async function measure(base: string, row: Omit<Row, "report" | "error">): Promise<Row> {
  if (row.hidden) return { ...row, report: null, error: "ukryty" };
  try {
    const res = await fetch(`${base}${row.path}`, { cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "x-admin-seo-check": "1" } });
    if (!res.ok) return { ...row, report: null, error: `HTTP ${res.status}` };
    const html = await res.text();
    return { ...row, report: analyzeBlogHtml(html, { keyword: row.keyword, category: row.category, path: row.path }), error: null };
  } catch (e) {
    return { ...row, report: null, error: e instanceof Error ? e.message.slice(0, 80) : "błąd pobrania" };
  }
}

const tone = (score: number) => (score >= 85 ? "ok" : score >= 65 ? "warn" : "bad");

function SeoCell({ row }: { row: Row }) {
  if (!row.report) return <span className="badge">{row.error ?? "-"}</span>;
  const missing = row.report.checks.filter((c) => !c.ok);
  return (
    <details>
      <summary>
        <span className={`badge ${tone(row.report.score)}`}>{row.report.score}/100</span>
        {missing.length > 0 && <span className="sub"> {missing.length} do poprawy</span>}
      </summary>
      <ul className="sub">
        {row.report.checks.map((c) => (
          <li key={c.key}>
            {c.ok ? "✓" : "✗"} {c.label}: {c.detail} ({c.points}/{c.max})
          </li>
        ))}
      </ul>
    </details>
  );
}

function RowActions({ row }: { row: Row }) {
  return (
    <div className="row-actions">
      <form action={blogAction} className="inline-form">
        <input type="hidden" name="key" value={row.key} />
        <input type="date" name="published" defaultValue={row.published} aria-label="Data wpisu" />
        <button type="submit" name="action" value="date">
          Zapisz datę
        </button>
        {row.dateOverridden && (
          <button type="submit" name="action" value="date-reset" className="link-button">
            z kodu ({row.codePublished})
          </button>
        )}
      </form>
      <form action={blogAction}>
        <input type="hidden" name="key" value={row.key} />
        {row.hidden ? (
          <button type="submit" name="action" value="show">
            Pokaż wpis
          </button>
        ) : (
          <button type="submit" name="action" value="hide">
            Ukryj wpis
          </button>
        )}
      </form>
    </div>
  );
}

export default async function AdminBlogPage({ searchParams }: Props) {
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : null;
  const error = typeof params.error === "string" ? params.error : null;
  const [overrides, data, base] = await Promise.all([getBlogOverrides(), loadBlogData().catch(() => null), origin()]);
  const postRows = BLOG_POSTS.map((p) => {
    const o = withOverride(p, overrides);
    return {
      key: p.slug,
      path: blogPath(p.slug),
      title: p.h1,
      category: p.category,
      keyword: p.keyword,
      published: o.published,
      codePublished: p.published,
      modified: o.modified,
      hidden: overrides[p.slug]?.hidden === true,
      dateOverridden: Boolean(overrides[p.slug]?.published),
    };
  });
  const pairRows = (data ? cityPairs(data.cities) : []).map((p) => {
    const key = `porownanie-${p.slug}`;
    const codePublished = "2026-11-21";
    const published = overrides[key]?.published ?? codePublished;
    return {
      key,
      path: blogPath(`porownanie/${p.slug}`),
      title: `${p.a.name} czy ${p.b.name}?`,
      category: "Porównanie miast",
      keyword: `${p.a.name} czy ${p.b.name}`,
      published,
      codePublished,
      modified: published,
      hidden: overrides[key]?.hidden === true,
      dateOverridden: Boolean(overrides[key]?.published),
    };
  });
  const [posts, pairs] = await Promise.all([
    Promise.all(postRows.map((r) => measure(base, r))),
    Promise.all(pairRows.map((r) => measure(base, r))),
  ]);
  const measured = [...posts, ...pairs].filter((r) => r.report);
  const avgScore = measured.length ? Math.round(measured.reduce((s, r) => s + (r.report?.score ?? 0), 0) / measured.length) : null;
  const avgWords = posts.filter((r) => r.report).length
    ? Math.round(posts.reduce((s, r) => s + (r.report?.words ?? 0), 0) / posts.filter((r) => r.report).length)
    : null;
  const keywordOf = (key: string) => (key.startsWith("porownanie-") ? null : getPost(key).keyword);

  const table = (rows: Row[], label: string) => (
    <div className="tablewrap">
      <table className="tight">
        <thead>
          <tr>
            <th>{label}</th>
            <th>Data wpisu</th>
            <th className="num">Długość</th>
            <th>Ocena SEO</th>
            <th>Status i zmiany</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>
                <a href={r.path} target="_blank" rel="noreferrer">
                  {r.title}
                </a>
                <div className="sub">
                  {r.category}
                  {keywordOf(r.key) ? ` · fraza: „${keywordOf(r.key)}”` : ""}
                </div>
              </td>
              <td>
                {formatDate(r.published)}
                {r.dateOverridden && <span className="badge mini">z panelu</span>}
                {r.modified > r.published && <div className="sub">zmiana treści {formatDate(r.modified)}</div>}
              </td>
              <td className="num">
                {r.report ? (
                  <>
                    {r.report.words.toLocaleString("pl-PL")} słów
                    <div className="sub">cel {r.report.targetWords.toLocaleString("pl-PL")}</div>
                  </>
                ) : (
                  "-"
                )}
              </td>
              <td>
                <SeoCell row={r} />
              </td>
              <td>
                {r.hidden ? <span className="badge bad">ukryty</span> : <span className="badge ok">widoczny</span>}
                <RowActions row={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Blog</h1>
          <p className="page-sub">
            Wpisy bloga z datą, długością i oceną SEO liczoną na żywo z gotowej strony. Treść wpisów jest w kodzie (app/blog),
            a zasady pisania w instrukcji bloga (docs/blog.md w repozytorium). Tutaj zmienisz datę wpisu i ukryjesz wpis.
          </p>
        </div>
      </div>
      {ok && <div className="alert ok">{ok}</div>}
      {error && <div className="alert bad">{error}</div>}

      <div className="kpis compact">
        <div className="kpi">
          <b>{BLOG_POSTS.length}</b>
          <span>artykułów</span>
        </div>
        <div className="kpi">
          <b>{pairRows.length}</b>
          <span>porównań miast</span>
        </div>
        <div className="kpi">
          <b>{avgWords != null ? avgWords.toLocaleString("pl-PL") : "-"}</b>
          <span>średnio słów w artykule</span>
        </div>
        <div className="kpi">
          <b>{avgScore != null ? `${avgScore}/100` : "-"}</b>
          <span>średnia ocena SEO</span>
        </div>
      </div>

      <h2>Artykuły</h2>
      {table(posts, "Artykuł")}

      <h2>Porównania miast</h2>
      <p className="page-sub">Strony powstają automatycznie dla par największych miast. Możesz ukryć wybrane porównanie.</p>
      {table(pairs, "Porównanie")}

      <h2>Jak liczymy ocenę SEO</h2>
      <ul className="sub">
        <li>Długość treści artykułu względem celu: poradnik 1800 słów, dane i porównania 1300, porównanie miast 900 (25 pkt).</li>
        <li>Tytuł 30-65 znaków, opis meta 70-160 znaków bez urwania, jeden h1, co najmniej 6 sekcji h2.</li>
        <li>Co najmniej 6 linków wewnętrznych, 2 wykresy z danych, własna okładka, teksty alternatywne obrazów.</li>
        <li>Adres kanoniczny, dane strukturalne Article i FAQPage, główna fraza w tytule, opisie i wstępie, brak długich myślników.</li>
        <li>
          Ocena sprawdza budowę strony, nie jakość tekstu ani pozycję w Google. Pozycje zobaczysz w Google Search Console.{" "}
          <Link href="/blog">Otwórz blog</Link>.
        </li>
      </ul>
    </>
  );
}
