import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { BLOG_POSTS, fmtInt, fmtRate, fmtRating, fmtShare, type BlogCategory } from "@/lib/blog";
import {
  buyerStats,
  cityPairs,
  loadBlogData,
  loadRates,
  ratingLeague,
  ratingOverview,
  reachStats,
  rentBrokerageStats,
  tenureStats,
} from "@/lib/blog-stats";
import { commissionReport } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { LOGO_FRAME_SIZE, LOGO_FRAME_STROKE, LOGO_HEIGHT, LOGO_LINE1, LOGO_LINE2, LOGO_RBN, LOGO_WIDTH } from "@/lib/logo-paths";
import { PRICE_STAT_MIN } from "@/lib/ranking";

/**
 * Okładki artykułów bloga (1200x630 PNG) generowane z kodu w stylu strony: kremowe tło, czarny tekst, żółty akcent,
 * jedna liczba z aktualnych danych i prosty rysunek zależny od kategorii. Bez zdjęć: nie mamy własnych, a stockowe
 * i generowane obniżałyby wiarygodność serwisu z danymi. Adres: /blog/okladka/<slug>.png albo porownanie-<para>.png.
 */

const SIZE = { width: 1200, height: 630 };

/** Czcionki serwisu (Archivo, IBM Plex Mono) z assets/fonts, ładowane raz na proces. Bez nich zostaje czcionka domyślna. */
type OgFont = { name: string; data: ArrayBuffer; weight: 500 | 600 | 800; style: "normal" };
let fontsPromise: Promise<OgFont[]> | null = null;
function loadFonts(): Promise<OgFont[]> {
  fontsPromise ??= (async () => {
    const files: [string, string, OgFont["weight"]][] = [
      ["Archivo", "archivo-800ExtraBold.woff", 800],
      ["Archivo", "archivo-500Medium.woff", 500],
      ["Plex Mono", "ibm-plex-mono-latin-600-normal.woff", 600],
      ["Plex Mono", "ibm-plex-mono-latin-ext-600-normal.woff", 600],
    ];
    const out: OgFont[] = [];
    for (const [name, file, weight] of files) {
      try {
        const buf = await readFile(join(process.cwd(), "assets/fonts", file));
        out.push({ name, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight, style: "normal" });
      } catch {
        // brak pliku: okładka i tak się wygeneruje z czcionką domyślną
      }
    }
    return out;
  })();
  return fontsPromise;
}
const INK = "#121211";
const CREAM = "#f2f1ed";
const YELLOW = "#f6cd2b";
const MUTED = "#66645e";

const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}" fill="${INK}">` +
    `<rect x="${LOGO_FRAME_STROKE / 2}" y="${LOGO_FRAME_STROKE / 2}" width="${LOGO_FRAME_SIZE - LOGO_FRAME_STROKE}" ` +
    `height="${LOGO_FRAME_SIZE - LOGO_FRAME_STROKE}" fill="none" stroke="${INK}" stroke-width="${LOGO_FRAME_STROKE}"/>` +
    `<path d="${LOGO_RBN}"/><path d="${LOGO_LINE1}"/><path d="${LOGO_LINE2}"/></svg>`,
)}`;

const HOUSE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">` +
    `<path d="M40 140 L150 50 L260 140" fill="none" stroke="${INK}" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<rect x="70" y="130" width="160" height="130" fill="none" stroke="${INK}" stroke-width="14" stroke-linejoin="round"/>` +
    `<rect x="95" y="160" width="45" height="45" fill="${YELLOW}" stroke="${INK}" stroke-width="8"/>` +
    `<rect x="165" y="190" width="40" height="70" fill="${INK}"/>` +
    `</svg>`,
)}`;

type Cover = { eyebrow: string; title: string; stat?: string; statLabel?: string; art: BlogCategory; pair?: [string, string, number, number] };

async function coverFor(key: string): Promise<Cover | null> {
  if (key.startsWith("porownanie-")) {
    const slug = key.slice("porownanie-".length);
    const data = await loadBlogData().catch(() => null);
    const pair = data ? cityPairs(data.cities).find((p) => p.slug === slug) : null;
    if (!pair) return { eyebrow: "Porównanie miast", title: "Biura nieruchomości w dwóch miastach", art: "Porównania" };
    return {
      eyebrow: "Porównanie miast",
      title: `${pair.a.name} czy ${pair.b.name}? Biura nieruchomości w liczbach`,
      stat: `${pair.a.firms} : ${pair.b.firms}`,
      statLabel: "biur w katalogu",
      art: "Porównania",
      pair: [pair.a.name, pair.b.name, pair.a.firms, pair.b.firms],
    };
  }
  const post = BLOG_POSTS.find((p) => p.slug === key);
  if (!post) return null;
  const base: Cover = { eyebrow: post.category === "Dane" ? "Dane z katalogu" : post.category, title: post.h1, art: post.category };
  try {
    switch (key) {
      case "oceny-biur-nieruchomosci-w-miastach": {
        const best = ratingLeague((await loadBlogData()).cities)[0];
        return best ? { ...base, stat: fmtRating(best.avgRating), statLabel: `średnia ocena biur ${inCity(best.name)}` } : base;
      }
      case "biura-nieruchomosci-w-najwiekszych-miastach": {
        const first = (await loadBlogData()).cities[0];
        return first ? { ...base, stat: fmtInt(first.firms), statLabel: `biur w katalogu ${inCity(first.name)}` } : base;
      }
      case "sprzedaz-mieszkania-z-biurem-czy-samemu":
      case "czy-kupujacy-placi-prowizje-biuru-nieruchomosci": {
        if (key === "czy-kupujacy-placi-prowizje-biuru-nieruchomosci") {
          const b = buyerStats(await loadRates());
          if (b.paid.n >= PRICE_STAT_MIN && b.paid.median != null) return { ...base, stat: fmtRate(b.paid.median), statLabel: "mediana stawki dla kupującego w cennikach biur" };
        }
        const r = await commissionReport();
        return r.n >= PRICE_STAT_MIN && r.median != null ? { ...base, stat: fmtRate(r.median), statLabel: "mediana stawki za sprzedaż w cennikach biur" } : base;
      }
      case "prowizja-za-wynajem-mieszkania": {
        const rent = rentBrokerageStats(await loadRates());
        return rent.n >= PRICE_STAT_MIN && rent.median != null ? { ...base, stat: fmtRate(rent.median), statLabel: "czynszu: typowa stawka za wynajem w cennikach" } : base;
      }
      case "ocena-5-w-google-biuro-nieruchomosci": {
        const o = ratingOverview((await loadBlogData()).firms);
        return o.share5Few != null ? { ...base, stat: fmtShare(o.share5Few), statLabel: "biur z mniej niż 10 opiniami ma ocenę 5,0" } : base;
      }
      case "siec-czy-lokalne-biuro-nieruchomosci": {
        const d = await loadBlogData();
        const s = reachStats(d.firms, d.citiesByBrand, d.now);
        return s.multiShare != null ? { ...base, stat: fmtShare(s.multiShare), statLabel: "firm z katalogu działa w kilku miastach" } : base;
      }
      case "najdluzej-dzialajace-biura-nieruchomosci": {
        const d = await loadBlogData();
        const t = tenureStats(d.firms, d.now);
        return t.share10y != null ? { ...base, stat: fmtShare(t.share10y), statLabel: "biur jest w rejestrze 10 lat lub dłużej" } : base;
      }
      default:
        return base;
    }
  } catch {
    return base;
  }
}

function Art({ cover }: { cover: Cover }) {
  if (cover.art === "Porównania" && cover.pair) {
    const [a, b, na, nb] = cover.pair;
    const max = Math.max(na, nb, 1);
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 36, height: 330 }}>
        {[
          { name: a, n: na, bg: YELLOW },
          { name: b, n: nb, bg: INK },
        ].map((c) => (
          <div key={c.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 110, height: Math.max(40, (c.n / max) * 260), background: c.bg, borderRadius: "10px 10px 0 0" }} />
            <div style={{ fontSize: 26, fontWeight: 700, color: INK, maxWidth: 170, textAlign: "center" }}>{c.name}</div>
          </div>
        ))}
      </div>
    );
  }
  if (cover.art === "Poradnik") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={HOUSE} width={300} height={300} alt="" />;
  }
  const bars = [0.45, 0.7, 0.55, 0.95, 0.8];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 300, borderBottom: `6px solid ${INK}`, paddingBottom: 0 }}>
      {bars.map((h, i) => (
        <div key={i} style={{ width: 44, height: h * 280, background: i === 3 ? INK : YELLOW, borderRadius: "8px 8px 0 0" }} />
      ))}
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const key = file.replace(/\.png$/, "");
  if (!/^[a-z0-9-]+$/.test(key)) return new Response("Nie znaleziono", { status: 404 });
  const cover = await coverFor(key);
  if (!cover) return new Response("Nie znaleziono", { status: 404 });
  const titleSize = cover.title.length > 70 ? 50 : cover.title.length > 45 ? 58 : 66;
  const fonts = await loadFonts();
  const mono = fonts.some((f) => f.name === "Plex Mono") ? "Plex Mono" : undefined;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, color: INK, padding: "56px 64px", fontFamily: "Archivo" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 760, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} width={LOGO_WIDTH * 0.8} height={LOGO_HEIGHT * 0.8} alt="" />
            <div style={{ fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: MUTED, display: "flex", fontFamily: mono }}>Blog</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex" }}>
              <div style={{ fontSize: 22, letterSpacing: 5, textTransform: "uppercase", fontWeight: 600, borderBottom: `6px solid ${YELLOW}`, paddingBottom: 4, fontFamily: mono }}>
                {cover.eyebrow}
              </div>
            </div>
            <div style={{ fontSize: titleSize, fontWeight: 800, lineHeight: 1.06, letterSpacing: -1.5, display: "flex" }}>{cover.title}</div>
          </div>
          {cover.stat ? (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ background: YELLOW, padding: "6px 18px", borderRadius: 12, fontSize: 54, fontWeight: 800, display: "flex" }}>{cover.stat}</div>
              <div style={{ fontSize: 26, color: INK, maxWidth: 440, lineHeight: 1.2, display: "flex", fontWeight: 500 }}>{cover.statLabel}</div>
            </div>
          ) : (
            <div style={{ fontSize: 26, color: MUTED, display: "flex" }}>rankingbiurnieruchomosci.pl</div>
          )}
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Art cover={cover} />
        </div>
      </div>
    ),
    { ...SIZE, fonts: fonts.length ? fonts : undefined, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
